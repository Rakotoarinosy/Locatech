from rest_framework import serializers
from .models import Facture
from apps.reservations.serializers import ReservationSerializer


class FactureSerializer(serializers.ModelSerializer):
    reservation_detail = ReservationSerializer(
        source='reservation',
        read_only=True
    )

    class Meta:
        model = Facture
        fields = '__all__'
        read_only_fields = (
            'id',
            'numero',
            'montant',
            'pdf',
            'created_at'
        )

    def validate_reservation(self, reservation):

        # Une réservation annulée ne peut pas être facturée
        if reservation.statut == 'annulee':
            raise serializers.ValidationError(
                "Impossible de créer une facture pour une réservation annulée."
            )

        # Une facture existe déjà
        if hasattr(reservation, 'facture'):
            raise serializers.ValidationError(
                "Une facture existe déjà pour cette réservation."
            )
        return reservation