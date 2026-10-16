from rest_framework import serializers

from .models import ContactRequest


class ContactRequestSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='nom', max_length=100)

    class Meta:
        model = ContactRequest
        fields = ('name', 'email', 'message')
