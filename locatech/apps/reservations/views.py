from datetime import date
from django.db import models as django_models
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Reservation
from .serializers import ReservationSerializer
from decimal import Decimal
from apps.factures.models import Facture
from apps.factures.views import _generate_pdf


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().order_by('-id')
    serializer_class = ReservationSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['client__nom', 'materiel__nom', 'statut']

    def get_queryset(self):
        queryset = super().get_queryset()
        aujourd_hui = date.today()

        # Réservations confirmées dont la date_fin est dépassée
        # → passent automatiquement en "en_attente_retour"
        Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut='confirmee'
        ).update(statut='en_attente_retour')

        # Calcul des retards sur les réservations en attente de retour
        retards = Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut='en_attente_retour'
        )
        for r in retards: 
            r.retard_jours = ( aujourd_hui - r.date_fin ).days 
            r.save()

        statut = self.request.query_params.get('statut')
        client_id = self.request.query_params.get('client')
        materiel_id = self.request.query_params.get('materiel')

        if statut:
            queryset = queryset.filter(statut=statut)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if materiel_id:
            queryset = queryset.filter(materiel_id=materiel_id)

        return queryset

    @action(detail=True, methods=['patch'], url_path='statut')
    def update_statut(self, request, pk=None):
        reservation = self.get_object()
        new_statut = request.data.get('statut')
        valid = ['en_attente', 'en cours', 'confirmee', 'en_attente_retour', 'terminee', 'annulee']
        if new_statut not in valid:
            return Response(
                {'error': f'Statut invalide. Valeurs : {valid}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        reservation.statut = new_statut

        # ── ÉTAPE 1 : Confirmation → facture en_attente ──────────────
        if new_statut == 'confirmee':
            if not hasattr(reservation, 'facture'):
                facture = Facture.objects.create(
                    reservation=reservation,
                    montant=reservation.prix_total,
                    statut='en_attente'          # ← pas encore payée
                )
                _generate_pdf(facture)
            return Response({
                'message': 'Facture générée. En attente de paiement.',
                'reservation': ReservationSerializer(reservation).data
            })

        # ── ÉTAPE 2 : Terminée → calcul retard + facture a_payer ─────
        elif new_statut == 'terminee':
            reservation.statut = 'terminee'
            aujourd_hui = date.today()
            reservation.materiel.statut = 'disponible'
            reservation.materiel.save()

            # Calcul retard
            retard = max(0, (aujourd_hui - reservation.date_fin).days)
            reservation.retard_jours = retard

            # Mise à jour facture
            if hasattr(reservation, 'facture'):
                facture = reservation.facture
                penalite = Decimal(0)
                if retard > 0:
                    penalite = (
                        reservation.materiel.prix_journalier
                        * Decimal(retard)
                        * Decimal('1.5')
                    )
                facture.montant = reservation.prix_total + penalite
                facture.statut = 'a_payer'
                facture.save()
                _generate_pdf(facture)   # régénère le PDF avec pénalité

        # ── ÉTAPE 3 : Annulation ──────────────────────────────────────
        elif new_statut == 'annulee':
            reservation.statut = 'annulee'
            reservation.materiel.statut = 'disponible'
            reservation.materiel.save()
            if hasattr(reservation, 'facture'):
                facture = reservation.facture
                if facture.statut != 'payee':
                    facture.statut = 'annulee'
                    facture.save()
            
        else:        
            reservation.statut = new_statut 

        reservation.save()
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
        for s in ['en_attente', 'en cours', 'confirmee', 'en_attente_retour', 'terminee', 'annulee']:
            par_statut[s] = Reservation.objects.filter(statut=s).count()
        return Response({'total': total, 'par_statut': par_statut})
    
    @action(detail=True, methods=['patch'], url_path='confirmer-retour')
    def confirmer_retour(self, request, pk=None):
        reservation = self.get_object()

        if reservation.statut not in ['confirmee', 'en_attente_retour']:
            return Response(
                {'error': 'La réservation n\'est pas en attente de retour.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        aujourd_hui = date.today()
        retard = max(0, (aujourd_hui - reservation.date_fin).days)
        reservation.retard_jours = retard
        reservation.statut = 'terminee'
        reservation.materiel.statut = 'disponible'
        reservation.materiel.save()
        reservation.save()

        # Si retard → régénère la facture avec pénalités
        if hasattr(reservation, 'facture'):
            facture = reservation.facture
            penalite = Decimal(0)
            if retard > 0 :
                penalite = (
                    reservation.materiel.prix_journalier
                    * Decimal(retard)
                    * Decimal('1.5')
                )
            facture.montant = reservation.prix_total + penalite
            facture.statut = 'payee'  # redevient à payer pour les pénalités
            facture.save()
            _generate_pdf(facture)

        return Response(ReservationSerializer(reservation).data)