from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class JWTOptionnel(JWTAuthentication):
    """
    Pour les vues publiques : un jeton valide identifie l'utilisateur (ex. réservation rattachée au compte),
    mais un jeton expiré ou signé avec une ancienne clé est ignoré au lieu de renvoyer 401.
    Sans cela, un visiteur ayant un vieux jeton dans son navigateur ne voit plus le catalogue.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, AuthenticationFailed):
            return None
