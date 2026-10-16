import json
import logging
import os

from django.conf import settings
from django.http import FileResponse

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from . import carte, gateway
from .models import PaiementCarte
from .services import est_payee, facture_depuis_jeton, reservation_depuis_jeton, url_facture

logger = logging.getLogger(__name__)

MODES = {'especes': 'Espèces', 'carte': 'Carte bancaire', 'mvola': 'MVola', 'orange': 'Orange Money', 'virement': 'Virement'}


class PaiementPublicThrottle(AnonRateThrottle):
    scope = 'paiement_public'
    rate = '30/min'


class _VuePublique(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (PaiementPublicThrottle,)


def _resume(reservation, paiement: PaiementCarte | None, request=None) -> dict:
    payee = est_payee(reservation)
    facture = getattr(reservation, 'facture', None)
    return {
        'reservation': reservation.id,
        'date_debut': reservation.date_debut,
        'date_fin': reservation.date_fin,
        'statut': reservation.statut,
        'statut_label': reservation.get_statut_display(),
        'montant': carte.montant_ariary(reservation),
        'lignes': [{'nom': l.materiel.nom, 'quantite': l.quantite} for l in reservation.lignes.select_related('materiel')],
        'mode_paiement': reservation.mode_paiement,
        'mode_paiement_label': MODES.get(reservation.mode_paiement or '', ''),
        'payee': payee,
        'paiement_carte': paiement.statut if paiement else None,
        'peut_payer_carte': gateway.est_configuree() and not payee and reservation.statut == 'en_attente',
        'facture': {'numero': facture.numero, 'url_pdf': url_facture(request, facture)} if facture and request else None,
    }


class ConfigView(_VuePublique):
    """Modes de paiement proposés au panier."""

    def get(self, request):
        return Response({'especes': True, 'carte': gateway.est_configuree()})


class StatutView(_VuePublique):
    """Page de retour / lien reçu par email : état de la réservation et de son paiement."""

    def get(self, request):
        reservation = reservation_depuis_jeton(request.query_params.get('jeton', ''))
        if reservation is None:
            return Response({'error': 'Lien de paiement invalide ou expiré.'}, status=status.HTTP_404_NOT_FOUND)

        paiement = reservation.paiements_carte.first()
        if paiement and paiement.statut == 'pending':
            try:
                paiement = carte.actualiser(paiement)
            except gateway.PasserelleIndisponible as e:
                logger.warning("Vérification du paiement %s impossible : %s", paiement.intent_id, e)
        reservation.refresh_from_db()
        return Response(_resume(reservation, paiement, request))


class PayerCarteView(_VuePublique):
    """(Re)lance un paiement par carte et renvoie l'URL de la page de paiement."""

    def post(self, request):
        reservation = reservation_depuis_jeton(request.data.get('jeton', ''))
        if reservation is None:
            return Response({'error': 'Lien de paiement invalide ou expiré.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            paiement = carte.demarrer(reservation)
        except carte.PaiementImpossible as e:
            return Response({'error': str(e)}, status=status.HTTP_409_CONFLICT)
        except gateway.PasserelleIndisponible as e:
            logger.error("Création du paiement carte impossible (réservation %s) : %s", reservation.id, e)
            return Response(
                {'error': 'Le paiement par carte est momentanément indisponible. Réessayez plus tard ou payez en espèces.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({'checkout_url': paiement.checkout_url}, status=status.HTTP_201_CREATED)


class PayerEspecesView(_VuePublique):
    """Le client renonce à la carte : la réservation sera réglée en espèces au retrait ou à la livraison."""

    def post(self, request):
        reservation = reservation_depuis_jeton(request.data.get('jeton', ''))
        if reservation is None:
            return Response({'error': 'Lien de paiement invalide ou expiré.'}, status=status.HTTP_404_NOT_FOUND)
        if reservation.statut != 'en_attente' or est_payee(reservation):
            return Response({'error': 'Cette réservation ne peut plus changer de mode de paiement.'},
                            status=status.HTTP_409_CONFLICT)
        # Une tentative carte encore ouverte reste vérifiable : si elle aboutit quand même, le paiement est pris en compte
        reservation.mode_paiement = 'especes'
        reservation.save(update_fields=['mode_paiement'])
        return Response(_resume(reservation, reservation.paiements_carte.first(), request))


class FactureView(_VuePublique):
    """Téléchargement du PDF de la facture par le client (lien signé, valable 1 an)."""

    def get(self, request):
        facture = facture_depuis_jeton(request.query_params.get('jeton', ''))
        if facture is None or facture.statut == 'annulee':
            return Response({'error': 'Lien de facture invalide ou expiré.'}, status=status.HTTP_404_NOT_FOUND)

        chemin = os.path.join(settings.MEDIA_ROOT, str(facture.pdf)) if facture.pdf else ''
        if not chemin or not os.path.exists(chemin):
            # PDF absent (média perdu, facture ancienne) : on le régénère
            from apps.factures.views import _generate_pdf
            _generate_pdf(facture)
            facture.refresh_from_db()
            chemin = os.path.join(settings.MEDIA_ROOT, str(facture.pdf)) if facture.pdf else ''
            if not chemin or not os.path.exists(chemin):
                return Response({'error': 'Facture momentanément indisponible.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return FileResponse(open(chemin, 'rb'), as_attachment=True, filename=f"facture-{facture.numero}.pdf",
                            content_type='application/pdf')


class WebhookView(APIView):
    """Notification signée envoyée par la passerelle quand un paiement aboutit (ou échoue)."""
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        corps = request.body  # corps brut : la signature porte sur les octets exacts reçus
        try:
            gateway.verifier_signature(corps, request.headers.get('X-Gateway-Signature', ''))
        except gateway.PasserelleIndisponible:
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except gateway.SignatureInvalide as e:
            logger.warning("Webhook de paiement rejeté : %s", e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            intent = json.loads(corps)['data']
        except (ValueError, KeyError, TypeError):
            return Response({'error': 'Corps illisible.'}, status=status.HTTP_400_BAD_REQUEST)

        paiement = PaiementCarte.objects.filter(intent_id=intent.get('id')).first()
        if paiement is None:
            # Intent inconnu ou remplacé par une nouvelle tentative : rien à faire
            return Response(status=status.HTTP_204_NO_CONTENT)
        carte.appliquer(paiement, intent)
        return Response(status=status.HTTP_204_NO_CONTENT)
