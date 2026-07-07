
import logging

from datetime import date
from decimal import Decimal

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Reservation, LigneReservation
from .serializers import ReservationSerializer

from apps.factures.models import Facture
from apps.factures.views import _generate_pdf
from apps.notifications.services.email_service import EmailService
from apps.automation.n8n_service import N8nService

logger = logging.getLogger(__name__)

class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().order_by('-id')
    serializer_class = ReservationSerializer
    permission_classes = (IsAuthenticated,)
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

    @action(detail=False, methods=['post'], url_path='b2c', permission_classes=[AllowAny])
    def creer_b2c(self, request):
        """Crée client + réservation multi-matériels publique."""
        data   = request.data
        lignes = data.get('lignes', [])

        required = ['client_nom', 'client_email', 'date_debut', 'date_fin']
        for field in required:
            if not data.get(field):
                return Response({'error': f'{field} requis.'}, status=status.HTTP_400_BAD_REQUEST)
        if not lignes:
            return Response({'error': 'Au moins une ligne de matériel requise.'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.clients.models import Client
        from apps.materials.models import Materiel

        client, _ = Client.objects.get_or_create(
            email=data['client_email'],
            defaults={'nom': data['client_nom'], 'telephone': data.get('client_telephone', '')}
        )

        reservation = Reservation.objects.create(
            client     = client,
            date_debut=data['date_debut'],
            date_fin=data['date_fin'],
            statut='en_attente',
            notes=data.get('notes', '')
        )
        reservation.refresh_from_db()
        
        for ligne in lignes:
            try:
                materiel = Materiel.objects.get(pk=ligne['materiel_id'])
            except Materiel.DoesNotExist:
                reservation.delete()
                return Response({'error': f"Matériel {ligne['materiel_id']} introuvable."}, status=status.HTTP_404_NOT_FOUND)
            LigneReservation.objects.create(
                reservation   = reservation,
                materiel      = materiel,
                quantite      = ligne.get('quantite', 1),
                prix_unitaire = materiel.prix_journalier
            )
            
        reservation.refresh_from_db()
        
        workflow_triggered = N8nService.reservation_created(reservation)

        if not workflow_triggered:
            logger.warning(
                f"Workflow n8n non déclenché pour la réservation {reservation.id}"
            )

        try:
            EmailService.nouvelle_reservation(reservation)
        except Exception as e:
            logger.error(f"Email B2C échoué: {e}")

        return Response(ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)