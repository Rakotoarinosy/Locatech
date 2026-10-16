from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.users.permissions import IsStaffUser
from apps.users.authentication import JWTOptionnel
from rest_framework.response import Response
from .models import Categorie, Materiel
from .serializers import (
    CategorieSerializer,
    MaterielSerializer,
    PublicMaterielSerializer,
)


class MaterielViewSet(viewsets.ModelViewSet):
    queryset = Materiel.objects.all().order_by('-created_at')
    serializer_class = MaterielSerializer
    permission_classes = (IsStaffUser,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'categorie']

    def get_queryset(self):
        queryset = super().get_queryset()
        statut = self.request.query_params.get('statut')
        categorie = self.request.query_params.get('categorie')
        if statut:
            queryset = queryset.filter(statut=statut)
        if categorie:
            queryset = queryset.filter(categorie__icontains=categorie)
        return queryset

    @action(
        detail=False,
        methods=['get'],
        url_path='catalogue',
        permission_classes=[AllowAny],
        authentication_classes=[JWTOptionnel],
    )
    def catalogue(self, request):
        # Le stock est vérifié par période à la réservation : un matériel loué sur d'autres dates
        # reste réservable. Seuls la maintenance et la casse le retirent du catalogue.
        materiels = self.get_queryset().exclude(statut__in=('maintenance', 'casse')).filter(quantite__gt=0)
        serializer = PublicMaterielSerializer(
            materiels,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        total = Materiel.objects.count()
        par_statut = {}
        for statut, _ in Materiel.STATUT_CHOICES:
            par_statut[statut] = Materiel.objects.filter(statut=statut).count()
        return Response({'total': total, 'par_statut': par_statut})

    @action(detail=True, methods=['patch'], url_path='statut')
    def update_statut(self, request, pk=None):
        materiel = self.get_object()
        new_statut = request.data.get('statut')
        valid = [s[0] for s in Materiel.STATUT_CHOICES]
        if new_statut not in valid:
            return Response(
                {'error': f'Statut invalide. Valeurs acceptées : {valid}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        materiel.statut = new_statut
        materiel.save()
        return Response(MaterielSerializer(materiel).data)
    
class CategorieViewSet(viewsets.ModelViewSet):
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer
    permission_classes = [IsStaffUser]
