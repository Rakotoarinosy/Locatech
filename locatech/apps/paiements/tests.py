import hashlib
import hmac
import json
import time
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.clients.models import Client
from apps.factures.models import Facture
from apps.materials.models import Categorie, Materiel
from apps.reservations.models import LigneReservation, Reservation

from .models import PaiementCarte
from .services import jeton_paiement, quantite_disponible

SECRET = 'secret-webhook-test'
GATEWAY = dict(
    PAYMENT_GATEWAY_URL='https://passerelle.test',
    PAYMENT_GATEWAY_API_KEY='cle-test',
    PAYMENT_GATEWAY_WEBHOOK_SECRET=SECRET,
    PUBLIC_FRONTEND_URL='https://locatech.test',
)
B2C = '/reservations/reservations/b2c/'
JOUR = date.today() + timedelta(days=10)


def intent(intent_id='pi_1', reference='1', montant=60000, statut='pending'):
    return {'id': intent_id, 'merchant_reference': reference, 'amount': montant, 'currency': 'MGA',
            'status': statut, 'checkout_url': f'https://passerelle.test/checkout/{intent_id}'}


def signe(corps: bytes, secret=SECRET, t=None):
    t = int(time.time()) if t is None else t
    return f"t={t},v1={hmac.new(secret.encode(), f'{t}.'.encode() + corps, hashlib.sha256).hexdigest()}"


class Base(TestCase):
    def setUp(self):
        self.api = APIClient()
        # Pas d'appel réel au workflow n8n pendant les tests
        n8n = patch('apps.reservations.views.N8nService.reservation_created', return_value=True)
        n8n.start()
        self.addCleanup(n8n.stop)
        self.tente = Materiel.objects.create(nom='Tente', categorie=Categorie.objects.create(nom='Tente'),
                                             prix_journalier=30000, quantite=2)

    def panier(self, quantite=1, mode='especes', debut=JOUR, fin=None):
        return self.api.post(B2C, {
            'client_nom': 'Rasoa', 'client_email': 'rasoa@gmail.com', 'client_telephone': '034',
            'date_debut': str(debut), 'date_fin': str(fin or debut + timedelta(days=1)),
            'mode_paiement': mode, 'lignes': [{'materiel_id': self.tente.id, 'quantite': quantite}],
        }, format='json')


class StockParPeriodeTests(Base):
    def test_overlapping_reservations_reduce_stock(self):
        self.assertEqual(self.panier(quantite=2).status_code, 201)
        response = self.panier(quantite=1)
        self.assertEqual(response.status_code, 409)
        self.assertIn('Tente', response.data['indisponibles'][0])

    def test_other_dates_stay_available(self):
        self.panier(quantite=2)
        self.assertEqual(self.panier(quantite=2, debut=JOUR + timedelta(days=5)).status_code, 201)

    def test_cancelled_reservation_frees_stock(self):
        self.panier(quantite=2)
        Reservation.objects.update(statut='annulee')
        self.assertEqual(quantite_disponible(self.tente, JOUR, JOUR), 2)

    def test_maintenance_blocks_everything(self):
        self.tente.statut = 'maintenance'
        self.tente.save()
        self.assertEqual(self.panier().status_code, 409)

    def test_rejects_past_start_date(self):
        self.assertEqual(self.panier(debut=date.today() - timedelta(days=1)).status_code, 400)

    def test_cash_reservation_has_no_card_payment(self):
        response = self.panier(mode='especes')
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('checkout_url', response.data['paiement'])
        self.assertEqual(Reservation.objects.get().mode_paiement, 'especes')

    @override_settings(PAYMENT_GATEWAY_URL='', PAYMENT_GATEWAY_API_KEY='')
    def test_card_refused_when_gateway_not_configured(self):
        self.assertEqual(self.panier(mode='carte').status_code, 400)


@override_settings(**GATEWAY)
class PaiementCarteTests(Base):
    def reserver_carte(self, intent_id='pi_1'):
        with patch('apps.paiements.gateway.creer_intent', side_effect=lambda **kw: intent(intent_id, kw['reference'], kw['montant'])) as creer:
            response = self.panier(mode='carte')
        return response, creer

    def test_card_checkout_returns_gateway_url(self):
        response, creer = self.reserver_carte()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['paiement']['checkout_url'], 'https://passerelle.test/checkout/pi_1')
        kwargs = creer.call_args.kwargs
        self.assertEqual(kwargs['montant'], 60000)  # 30 000 Ar × 2 jours
        self.assertTrue(kwargs['success_url'].startswith('https://locatech.test/paiement?jeton='))
        self.assertEqual(sum(l['unit_amount'] * l['quantity'] for l in kwargs['lignes']), 60000)
        self.assertEqual(PaiementCarte.objects.get().statut, 'pending')

    def test_gateway_down_keeps_reservation(self):
        from .gateway import PasserelleIndisponible
        with patch('apps.paiements.gateway.creer_intent', side_effect=PasserelleIndisponible('down')):
            response = self.panier(mode='carte')
        self.assertEqual(response.status_code, 201)
        self.assertIn('erreur', response.data['paiement'])
        self.assertEqual(Reservation.objects.count(), 1)

    def webhook(self, data, signature=None):
        corps = json.dumps({'id': 'evt_1', 'type': 'payment_intent.succeeded', 'data': data}).encode()
        return self.api.post('/paiements/webhook/', corps, content_type='application/json',
                             HTTP_X_GATEWAY_SIGNATURE=signature or signe(corps))

    def test_signed_success_webhook_confirms_reservation(self):
        self.reserver_carte()
        reservation = Reservation.objects.get()
        with patch('apps.factures.views._generate_pdf'):
            response = self.webhook(intent('pi_1', str(reservation.id), 60000, 'success'))
            self.webhook(intent('pi_1', str(reservation.id), 60000, 'success'))  # rejoué : sans effet
        self.assertEqual(response.status_code, 204)
        reservation.refresh_from_db()
        self.assertEqual(reservation.statut, 'confirmee')
        self.assertEqual(reservation.mode_paiement, 'carte')
        self.assertEqual(Facture.objects.get().statut, 'payee')
        self.assertEqual(PaiementCarte.objects.get().statut, 'success')

    def test_forged_webhook_rejected(self):
        self.reserver_carte()
        corps = json.dumps({'data': intent('pi_1', '1', 60000, 'success')}).encode()
        response = self.webhook(intent('pi_1', '1', 60000, 'success'), signature=signe(corps, secret='faux'))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Facture.objects.exists())

    def test_stale_webhook_rejected(self):
        self.reserver_carte()
        data = intent('pi_1', str(Reservation.objects.get().id), 60000, 'success')
        corps = json.dumps({'id': 'evt_1', 'type': 'payment_intent.succeeded', 'data': data}).encode()
        response = self.webhook(data, signature=signe(corps, t=int(time.time()) - 3600))
        self.assertEqual(response.status_code, 400)

    def test_wrong_amount_ignored(self):
        self.reserver_carte()
        self.webhook(intent('pi_1', str(Reservation.objects.get().id), 100, 'success'))
        self.assertEqual(Reservation.objects.get().statut, 'en_attente')
        self.assertEqual(PaiementCarte.objects.get().statut, 'pending')

    def test_failed_payment_can_be_retried_with_token(self):
        self.reserver_carte()
        reservation = Reservation.objects.get()
        self.webhook(intent('pi_1', str(reservation.id), 60000, 'failed'))
        self.assertEqual(PaiementCarte.objects.get().statut, 'failed')

        with patch('apps.paiements.gateway.creer_intent', return_value=intent('pi_2', str(reservation.id), 60000)):
            response = self.api.post('/paiements/carte/', {'jeton': jeton_paiement(reservation)}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['checkout_url'], 'https://passerelle.test/checkout/pi_2')

    def test_status_page_refreshes_pending_payment(self):
        self.reserver_carte()
        reservation = Reservation.objects.get()
        with patch('apps.paiements.gateway.lire_intent', return_value=intent('pi_1', str(reservation.id), 60000, 'success')), \
             patch('apps.factures.views._generate_pdf'):
            response = self.api.get('/paiements/statut/', {'jeton': jeton_paiement(reservation)})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['payee'])
        self.assertEqual(response.data['statut'], 'confirmee')

    def test_customer_can_switch_to_cash(self):
        self.reserver_carte()
        reservation = Reservation.objects.get()
        response = self.api.post('/paiements/especes/', {'jeton': jeton_paiement(reservation)}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['mode_paiement'], 'especes')
        self.assertEqual(Reservation.objects.get().mode_paiement, 'especes')

    def test_invalid_token(self):
        self.assertEqual(self.api.get('/paiements/statut/', {'jeton': 'faux'}).status_code, 404)
        self.assertEqual(self.api.post('/paiements/carte/', {'jeton': 'faux'}, format='json').status_code, 404)


class PaiementBackOfficeTests(Base):
    def test_staff_cash_payment_still_confirms(self):
        staff = get_user_model().objects.create_user('staff', 'staff@locatech.mg', 'x', role='staff')
        client = Client.objects.create(nom='Rasoa', email='rasoa@gmail.com', telephone='034', adresse='Tana')
        reservation = Reservation.objects.create(client=client, date_debut=JOUR, date_fin=JOUR)
        LigneReservation.objects.create(reservation=reservation, materiel=self.tente, quantite=1, prix_unitaire=30000)
        facture = Facture.objects.create(reservation=reservation, montant=30000)

        self.api.force_authenticate(staff)
        with patch('apps.factures.views._generate_pdf'):
            response = self.api.patch(f'/factures/factures/{facture.id}/payer/', {'mode_paiement': 'especes'}, format='json')
        self.assertEqual(response.status_code, 200)
        reservation.refresh_from_db()
        self.assertEqual(reservation.statut, 'confirmee')
        self.assertEqual(reservation.mode_paiement, 'especes')


class FactureClientTests(Base):
    """Le client télécharge sa facture par lien signé (avec ou sans compte Google)."""

    def setUp(self):
        super().setUp()
        import tempfile
        self.media = override_settings(MEDIA_ROOT=tempfile.mkdtemp())
        self.media.enable()
        self.addCleanup(self.media.disable)
        client = Client.objects.create(nom='Rasoa', email='rasoa@gmail.com', telephone='034', adresse='Tana')
        self.reservation = Reservation.objects.create(client=client, date_debut=JOUR, date_fin=JOUR)
        LigneReservation.objects.create(reservation=self.reservation, materiel=self.tente, quantite=1, prix_unitaire=30000)
        self.facture = Facture.objects.create(reservation=self.reservation, montant=30000)

    def test_signed_link_downloads_pdf(self):
        from .services import jeton_facture
        response = self.api.get('/paiements/facture/', {'jeton': jeton_facture(self.facture)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn(f'facture-{self.facture.numero}.pdf', response['Content-Disposition'])
        self.assertTrue(b''.join(response.streaming_content).startswith(b'%PDF'))

    def test_invalid_or_cancelled_link_refused(self):
        from .services import jeton_facture
        self.assertEqual(self.api.get('/paiements/facture/', {'jeton': 'faux'}).status_code, 404)
        # un jeton de paiement ne doit pas ouvrir une facture (sels différents)
        self.assertEqual(self.api.get('/paiements/facture/', {'jeton': jeton_paiement(self.reservation)}).status_code, 404)
        self.facture.statut = 'annulee'
        self.facture.save()
        self.assertEqual(self.api.get('/paiements/facture/', {'jeton': jeton_facture(self.facture)}).status_code, 404)

    def test_mes_reservations_exposes_pdf_link(self):
        user = get_user_model().objects.create_user('rasoa', 'rasoa@gmail.com', role='client')
        self.api.force_authenticate(user)
        response = self.api.get('/reservations/reservations/mes-reservations/')
        url = response.data[0]['facture']['url_pdf']
        self.assertIn('/paiements/facture/?jeton=', url)
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get(url).status_code, 200)
