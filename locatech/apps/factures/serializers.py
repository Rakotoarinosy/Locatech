from rest_framework import serializers
from .models import Facture
from apps.reservations.serializers import ReservationSerializer


class FactureSerializer(serializers.ModelSerializer):
    reservation_detail = ReservationSerializer(source='reservation', read_only=True)

    class Meta:
        model = Facture
        fields = '__all__'
        read_only_fields = ('id', 'montant', 'pdf', 'created_at')

    def validate_reservation(self, reservation):
        # Une facture ne peut être créée que si la réservation est terminée ou confirmée
        if reservation.statut not in ['terminee', 'confirmee']:
            raise serializers.ValidationError(
                "Une facture ne peut être générée que pour une réservation confirmée ou terminée."
            )
        # Vérifier qu'une facture n'existe pas déjà
        if hasattr(reservation, 'facture'):
            raise serializers.ValidationError(
                "Une facture existe déjà pour cette réservation."
            )
        return reservation
