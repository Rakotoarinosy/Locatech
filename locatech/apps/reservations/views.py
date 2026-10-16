
import logging

from datetime import date, timedelta
from decimal import Decimal

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.users.permissions import IsStaffUser
from rest_framework.response import Response

from .models import Reservation, LigneReservation
from django.db.models import Q

from .serializers import ReservationSerializer, MaReservationSerializer

from apps.factures.models import Facture
from apps.factures.views import _generate_pdf
from apps.notifications.services.email_service import EmailService
from apps.automation.n8n_service import N8nService

logger = logging.getLogger(__name__)

class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().order_by('-id')
    serializer_class = ReservationSerializer
    permission_classes = (IsStaffUser,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['client__nom', 'lignes__materiel__nom', 'statut']

    def get_queryset(self):
        queryset = super().get_queryset()
        aujourd_hui = date.today()

        Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut='confirmee'
        ).update(statut='en_attente_retour')

        retards = Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut='en_attente_retour'
        )
        for r in retards:
            r.retard_jours = (aujourd_hui - r.date_fin).days
            r.save()

        statut    = self.request.query_params.get('statut')
        client_id = self.request.query_params.get('client')

        if statut:
            queryset = queryset.filter(statut=statut)
        if client_id:
            queryset = queryset.filter(client_id=client_id)

        return queryset

    @action(detail=True, methods=['patch'], url_path='statut')
    def update_statut(self, request, pk=None):
        reservation = self.get_object()
        new_statut  = request.data.get('statut')
        valid = ['en_attente', 'confirmee', 'en_attente_retour', 'terminee', 'annulee']
        if new_statut not in valid:
            return Response(
                {'error': f'Statut invalide. Valeurs : {valid}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Facturer : génère la facture, reste en_attente ───────────────
        if new_statut == 'confirmee':
            if not hasattr(reservation, 'facture'):
                facture = Facture.objects.create(
                    reservation=reservation,
                    montant=reservation.prix_total,
                    statut='en_attente'
                )
                EmailService.nouvelle_reservation(reservation)
            else:
                facture = reservation.facture
                # Note: _generate_pdf appelé séparément si besoin
            _generate_pdf(facture)
            # Le statut reste 'en_attente' — c'est le paiement qui confirmera
            reservation.save()
            return Response({
                'message': 'Facture générée. En attente de paiement.',
                'reservation': ReservationSerializer(reservation).data
            })

        # ── Annulation ───────────────────────────────────────────────────
        elif new_statut == 'annulee':
            reservation.statut = 'annulee'
            for ligne in reservation.lignes.all():
                ligne.materiel.statut = 'disponible'
                ligne.materiel.save()
            if hasattr(reservation, 'facture'):
                facture = reservation.facture
                if facture.statut != 'payee':
                    facture.statut = 'annulee'
                    facture.save()

        else:
            reservation.statut = new_statut

        reservation.save()
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=['patch'], url_path='confirmer-retour')
    def confirmer_retour(self, request, pk=None):
        reservation = self.get_object()

        if reservation.statut not in ['confirmee', 'en_attente_retour']:
            return Response(
                {'error': "La réservation n'est pas en attente de retour."},
                status=status.HTTP_400_BAD_REQUEST
            )

        aujourd_hui = date.today()
        retard = max(0, (aujourd_hui - reservation.date_fin).days)

        reservation.retard_jours = retard
        reservation.statut = 'terminee'

        for ligne in reservation.lignes.all():
            ligne.materiel.statut = 'disponible'
            ligne.materiel.save()

        reservation.save()

        if hasattr(reservation, 'facture'):
            facture = reservation.facture

            if retard > 0:
                penalite = sum(
                    l.prix_unitaire * l.quantite * Decimal("1.5") * Decimal(retard)
                    for l in reservation.lignes.all()
                )

                facture.montant = reservation.prix_total + penalite
                facture.statut = "a_payer"

            else:
                facture.statut = "payee"

            facture.save()
            _generate_pdf(facture)

        # Envoi de l'email UNE SEULE FOIS
        try:
            if retard > 0:
                EmailService.retard_constate(reservation)
            else:
                EmailService.reservation_terminee(reservation)
        except Exception as e:
            logging.getLogger(__name__).error(f"Erreur email : {e}")

        return Response(ReservationSerializer(reservation).data)

    @action(detail=False, methods=['get'], url_path='en-retard')
    def en_retard(self, request):
        aujourd_hui = date.today()
        retards = Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut__in=['confirmee', 'en_attente_retour']
        )
        for r in retards:
            r.retard_jours = (aujourd_hui - r.date_fin).days
            r.save()
        return Response(ReservationSerializer(retards, many=True).data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        total = Reservation.objects.count()
        par_statut = {}
        for s in ['en_attente', 'confirmee', 'en_attente_retour', 'terminee', 'annulee']:
            par_statut[s] = Reservation.objects.filter(statut=s).count()
        return Response({'total': total, 'par_statut': par_statut})

    @action(detail=False, methods=['get'], url_path='mes-reservations', permission_classes=[IsAuthenticated])
    def mes_reservations(self, request):
        """Espace client : réservations passées par ce compte ou au nom de son email (vérifié par Google)."""
        user = request.user
        filtre = Q(cree_par=user)
        if user.email:
            filtre |= Q(client__email__iexact=user.email)
        reservations = (
            Reservation.objects.filter(filtre)
            .select_related('facture')
            .prefetch_related('lignes__materiel')
            .order_by('-created_at')
            .distinct()
        )
        return Response(MaReservationSerializer(reservations, many=True, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='b2c', permission_classes=[AllowAny])
    def creer_b2c(self, request):
        """Crée client + réservation multi-matériels publique (panier du site)."""
        from django.db import transaction
        from django.utils.dateparse import parse_date
        from apps.clients.models import Client
        from apps.materials.models import Materiel
        from apps.paiements import carte, gateway
        from apps.paiements.services import lien_paiement, jeton_paiement, verifier_disponibilite

        data = request.data
        required = ['client_nom', 'client_email', 'date_debut', 'date_fin']
        for field in required:
            if not data.get(field):
                return Response({'error': f'{field} requis.'}, status=status.HTTP_400_BAD_REQUEST)

        debut, fin = parse_date(str(data['date_debut'])), parse_date(str(data['date_fin']))
        if not debut or not fin or fin < debut:
            return Response({'error': 'Période de location invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if debut < date.today():
            return Response({'error': 'La date de début est déjà passée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Quantités regroupées par matériel
        quantites = {}
        try:
            for ligne in data.get('lignes') or []:
                materiel_id, quantite = int(ligne['materiel_id']), int(ligne.get('quantite', 1))
                if quantite < 1:
                    raise ValueError
                quantites[materiel_id] = quantites.get(materiel_id, 0) + quantite
        except (KeyError, TypeError, ValueError):
            return Response({'error': 'Lignes de matériel invalides.'}, status=status.HTTP_400_BAD_REQUEST)
        if not quantites:
            return Response({'error': 'Au moins une ligne de matériel requise.'}, status=status.HTTP_400_BAD_REQUEST)

        mode = data.get('mode_paiement') or 'especes'
        if mode not in ('especes', 'carte'):
            return Response({'error': 'Mode de paiement invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if mode == 'carte' and not gateway.est_configuree():
            return Response({'error': 'Le paiement par carte n’est pas disponible pour le moment.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Verrou sur les matériels : deux paniers simultanés ne peuvent pas prendre la même dernière unité
            materiels = {m.id: m for m in Materiel.objects.select_for_update().filter(pk__in=quantites)}
            manquants = set(quantites) - set(materiels)
            if manquants:
                return Response({'error': f"Matériel {min(manquants)} introuvable."}, status=status.HTTP_404_NOT_FOUND)

            indisponibles = verifier_disponibilite({materiels[i]: q for i, q in quantites.items()}, debut, fin)
            if indisponibles:
                return Response({'error': 'Stock insuffisant sur cette période.', 'indisponibles': indisponibles},
                                status=status.HTTP_409_CONFLICT)

            client, _ = Client.objects.get_or_create(
                email=data['client_email'],
                defaults={'nom': data['client_nom'], 'telephone': data.get('client_telephone', '')}
            )
            reservation = Reservation.objects.create(
                client=client,
                date_debut=debut,
                date_fin=fin,
                statut='en_attente',
                notes=data.get('notes', ''),
                mode_paiement=mode,
                cree_par=request.user if request.user.is_authenticated else None,
            )
            for materiel_id, quantite in quantites.items():
                LigneReservation.objects.create(
                    reservation=reservation, materiel=materiels[materiel_id],
                    quantite=quantite, prix_unitaire=materiels[materiel_id].prix_journalier,
                )

        reservation.refresh_from_db()

        paiement = {'mode': mode, 'jeton': jeton_paiement(reservation)}
        if mode == 'carte':
            try:
                paiement['checkout_url'] = carte.demarrer(reservation).checkout_url
            except (gateway.PasserelleIndisponible, carte.PaiementImpossible) as e:
                logger.error(f"Paiement carte non démarré pour la réservation {reservation.id}: {e}")
                paiement['erreur'] = ('Votre réservation est enregistrée, mais le paiement par carte est '
                                      'momentanément indisponible. Utilisez le lien reçu par email pour réessayer.')

        if not N8nService.reservation_created(reservation):
            logger.warning(f"Workflow n8n non déclenché pour la réservation {reservation.id}")

        try:
            EmailService.nouvelle_reservation(reservation, lien_paiement=lien_paiement(reservation) if mode == 'carte' else '')
        except Exception as e:
            logger.error(f"Email B2C échoué: {e}")

        return Response({**ReservationSerializer(reservation).data, 'paiement': paiement}, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='calendar')
    def calendrier(self, request):
        """Retourne les réservations pour un calendrier."""
        reservations = Reservation.objects.select_related('client').prefetch_related('lignes__materiel').exclude(statut='annulee')
        events = []
        for reservation in reservations:
            materiels = [
                ligne.materiel.nom for ligne in reservation.lignes.all()
            ]
            
            events.append({
                "id": reservation.id,

                "title": f"{reservation.client.nom} - {materiels}",

                "start": reservation.date_debut.isoformat(),

                # Date exclusive pour le calendrier
                "end": (
                    reservation.date_fin + timedelta(days=1)
                ).isoformat(),

                "statut": reservation.statut,

                "client": {
                    "id": reservation.client.id,
                    "nom": reservation.client.nom,
                    "email": reservation.client.email,
                },

                "materiels": [
                    {
                        "id": ligne.materiel.id,
                        "nom": ligne.materiel.nom,
                        "quantite": ligne.quantite,
                    }
                    for ligne in reservation.lignes.all()
                ]
            })

        return Response(events)