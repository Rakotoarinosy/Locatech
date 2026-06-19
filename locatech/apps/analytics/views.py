from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from datetime import date, timedelta
from apps.clients.models import Client
from apps.materials.models import Materiel
from apps.reservations.models import Reservation
from apps.factures.models import Facture
from django.utils import timezone


class DashboardStatsView(APIView):
    """Stats globales pour les 4 cartes du dashboard."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        aujourd_hui = timezone.now()
        debut_mois = aujourd_hui.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_clients = Client.objects.count()
        total_materiels = Materiel.objects.count()
        materiels_dispo = Materiel.objects.filter(statut='disponible').count()

        reservations_actives = Reservation.objects.filter(
            statut__in=['confirmee', 'en_attente_retour']
        ).count()

        revenus_total = Facture.objects.aggregate(
            total=Sum('montant')
        )['total'] or 0

        revenus_mois = Facture.objects.filter(
            created_at__gte=debut_mois
        ).aggregate(total=Sum('montant'))['total'] or 0

        reservations_en_retard = Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut__in=['confirmee', 'en_attente_retour']
        ).count()

        return Response({
            'total_clients': total_clients,
            'total_materiels': total_materiels,
            'materiels_disponibles': materiels_dispo,
            'taux_disponibilite': round(materiels_dispo / total_materiels * 100, 1) if total_materiels else 0,
            'reservations_actives': reservations_actives,
            'reservations_en_retard': reservations_en_retard,
            'revenus_total': str(revenus_total),
            'revenus_mois_courant': str(revenus_mois),
        })


class RevenusParMoisView(APIView):
    """Revenus agrégés par mois — pour le graphique line/bar du dashboard."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        data = (
            Facture.objects
            .annotate(mois=TruncMonth('created_at'))
            .values('mois')
            .annotate(total=Sum('montant'), nb_factures=Count('id'))
            .order_by('mois')
        )
        return Response([
            {
                'mois': item['mois'].strftime('%Y-%m'),
                'total_revenus': str(item['total']),
                'nb_factures': item['nb_factures'],
            }
            for item in data
        ])


class MaterielsStatsView(APIView):
    """Répartition des matériels par statut et par catégorie."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        par_statut = {}
        for statut, _ in Materiel.STATUT_CHOICES:
            par_statut[statut] = Materiel.objects.filter(statut=statut).count()

        par_categorie = (
            Materiel.objects
            .values('categorie')
            .annotate(total=Count('id'))
            .order_by('-total')
        )

        return Response({
            'par_statut': par_statut,
            'par_categorie': list(par_categorie),
        })


class ReservationsParMoisView(APIView):
    """Nombre de réservations par mois — pour graphique."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        data = (
            Reservation.objects
            .annotate(mois=TruncMonth('date_debut'))
            .values('mois')
            .annotate(total=Count('id'))
            .order_by('mois')
        )
        return Response([
            {
                'mois': item['mois'].strftime('%Y-%m'),
                'total_reservations': item['total'],
            }
            for item in data
        ])


class TopClientsView(APIView):
    """Top 5 clients par nombre de réservations."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        top = (
            Reservation.objects
            .values('client__id', 'client__nom', 'client__email')
            .annotate(nb_reservations=Count('id'))
            .order_by('-nb_reservations')[:5]
        )
        return Response(list(top))
