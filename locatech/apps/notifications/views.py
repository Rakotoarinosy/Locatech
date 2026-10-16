from rest_framework import generics
from rest_framework.permissions import AllowAny
from apps.users.authentication import JWTOptionnel
from rest_framework.throttling import AnonRateThrottle

from .serializers import ContactRequestSerializer


class ContactRequestThrottle(AnonRateThrottle):
    scope = 'contact_request'
    rate = '5/hour'


class ContactRequestView(generics.CreateAPIView):
    serializer_class = ContactRequestSerializer
    authentication_classes = [JWTOptionnel]
    permission_classes = [AllowAny]
    throttle_classes = [ContactRequestThrottle]
