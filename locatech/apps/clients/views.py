from rest_framework import  viewsets,permissions,filters
from rest_framework.permissions import IsAuthenticated 
from .serializers import ClientSerializer
from .models import Client
from django.shortcuts import render

# Create your views here.
class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')
    serializer_class = ClientSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom', 'email', 'telephone']
    