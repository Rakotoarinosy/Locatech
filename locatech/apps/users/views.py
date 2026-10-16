from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from .serializers import UserSerializer
from .permissions import IsAdminRole
from rest_framework.permissions import IsAuthenticated

User = get_user_model()

# Create your views here.
def index(request):
    return HttpResponse("Hello, world. You're at the polls index.")

class RegisterView(generics.CreateAPIView):
    """Création d'un compte de l'équipe LocaTech : réservée aux administrateurs."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (IsAdminRole,)

class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        serialiser = UserSerializer(request.user)
        return Response(serialiser.data)


class GoogleLoginThrottle(AnonRateThrottle):
    scope = 'google_login'
    rate = '20/min'


class GoogleLoginView(APIView):
    """
    Connexion client « Continuer avec Google ».
    Le front envoie l'ID token renvoyé par Google Identity Services ; on le vérifie
    (signature, audience, expiration) puis on renvoie nos propres jetons JWT.
    """
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (GoogleLoginThrottle,)

    def post(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            return Response({'error': 'Connexion Google non configurée.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        credential = request.data.get('credential')
        if not credential:
            return Response({'error': 'credential requis.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        except ValueError:
            return Response({'error': 'Jeton Google invalide ou expiré.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not info.get('email_verified'):
            return Response({'error': 'Votre adresse Google n’est pas vérifiée.'}, status=status.HTTP_401_UNAUTHORIZED)

        sub = info['sub']
        email = info['email'].strip().lower()

        user = User.objects.filter(google_sub=sub).first()
        if user is None:
            user = User.objects.filter(email__iexact=email).first()
            if user is not None:
                # Les comptes de l'équipe gardent la connexion par identifiant / mot de passe
                if user.is_superuser or user.role != 'client':
                    return Response(
                        {'error': 'Cette adresse appartient à un compte LocaTech : connectez-vous depuis l’espace équipe.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if user.google_sub and user.google_sub != sub:
                    return Response({'error': 'Ce compte est lié à un autre compte Google.'}, status=status.HTTP_403_FORBIDDEN)
                user.google_sub = sub
                user.save(update_fields=['google_sub'])
            else:
                user = User(
                    username=f'google_{sub}',
                    email=email,
                    first_name=info.get('given_name', '')[:150],
                    last_name=info.get('family_name', '')[:150],
                    role='client',
                    google_sub=sub,
                )
                user.set_unusable_password()
                user.save()

        if not user.is_active:
            return Response({'error': 'Ce compte est désactivé.'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })
