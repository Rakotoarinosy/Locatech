from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Categorie, Materiel
from .serializers import CategorieSerializer, MaterielSerializer


class MaterielViewSet(viewsets.ModelViewSet):
    queryset = Materiel.objects.all().order_by('-created_at')
    serializer_class = MaterielSerializer
    permission_classes = (IsAuthenticated,)
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
    permission_classes = [IsAuthenticated]
