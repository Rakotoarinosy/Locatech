from django.http import HttpResponse
from django.shortcuts import render
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .serializers import UserSerializer
from rest_framework.permissions import IsAuthenticated

User = get_user_model()

# Create your views here.
def index(request):
    return HttpResponse("Hello, world. You're at the polls index.")

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.AllowAny,)
    
class MeView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        serialiser = UserSerializer(request.user)
        return Response(serialiser.data)