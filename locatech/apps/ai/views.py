from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.users.permissions import IsStaffUser
from .services.gemini_service import ask_gemini
from .models import MessageHistory
import json
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.users.authentication import JWTOptionnel

class AssistantAPIView(APIView):
    # Public : un jeton invalide est ignoré, un jeton valide garde l'historique de l'utilisateur
    authentication_classes = [JWTOptionnel]
    permission_classes = [AllowAny]

    def post(self, request):
        question = request.data.get("question")

        if not question:
            return Response(
                {"error": "Question obligatoire"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 💾 Si l'utilisateur est connecté, on sauvegarde son message
        if request.user and request.user.is_authenticated:
            MessageHistory.objects.create(
                user=request.user,
                sender='user',
                text=question
            )

        # Appel au service Gemini
        data = ask_gemini(question)

        # 💾 Si l'utilisateur est connecté, on sauvegarde la réponse structurée de l'IA
        if request.user and request.user.is_authenticated:
            MessageHistory.objects.create(
                user=request.user,
                sender='ai',
                text=data.get("resume", ""),
                recommendation=data # Sauvegarde le dictionnaire/JSON complet directement
            )

        return Response(data)


class AssistantHistoryAPIView(APIView):
    # Seuls les utilisateurs authentifiés (B2B) ont accès à l'historique persistent
    permission_classes = [IsStaffUser]

    def get(self, request):
        # Récupération de tous les messages de l'utilisateur connecté
        history = MessageHistory.objects.filter(user=request.user)
        
        # Formatage au format attendu par l'interface Angular (Interface Message)
        data = []
        for msg in history:
            data.append({
                "id": str(msg.id),
                "sender": msg.sender,
                "text": msg.text,
                "timestamp": msg.timestamp,
                "recommendation": msg.recommendation # Reconstruit le bloc carte/tableau si existant
            })
            
        return Response(data, status=status.HTTP_200_OK)