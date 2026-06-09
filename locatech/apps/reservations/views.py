from datetime import date
from django.db import models as django_models
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Reservation
from .serializers import ReservationSerializer


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all().order_by('-id')
    serializer_class = ReservationSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['client__nom', 'materiel__nom', 'statut']

    def get_queryset(self):
        queryset = super().get_queryset()
        aujourd_hui = date.today()

        # Auto-calcul retard_jours sur les réservations en cours dépassées
        Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut__in=['en cours', 'confirmee']
        ).update(
            retard_jours=django_models.ExpressionWrapper(
                django_models.Value(aujourd_hui) - django_models.F('date_fin'),
                output_field=django_models.IntegerField()
            )
        )

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
        valid = ['en cours', 'confirmee', 'terminee', 'annulee']
        if new_statut not in valid:
            return Response(
                {'error': f'Statut invalide. Valeurs : {valid}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        reservation.statut = new_statut
        if new_statut in ['terminee', 'annulee']:
            reservation.materiel.statut = 'disponible'
            reservation.materiel.save()
        reservation.save()
        return Response(ReservationSerializer(reservation).data)

    @action(detail=False, methods=['get'], url_path='en-retard')
    def en_retard(self, request):
        aujourd_hui = date.today()
        retards = Reservation.objects.filter(
            date_fin__lt=aujourd_hui,
            statut__in=['en cours', 'confirmee']
        )
        for r in retards:
            r.retard_jours = (aujourd_hui - r.date_fin).days
            r.save()
        return Response(ReservationSerializer(retards, many=True).data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        total = Reservation.objects.count()
        par_statut = {}
        for s in ['en cours', 'confirmee', 'terminee', 'annulee']:
            par_statut[s] = Reservation.objects.filter(statut=s).count()
        return Response({'total': total, 'par_statut': par_statut})