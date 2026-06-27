from rest_framework import serializers
from .models import LigneReservation, Reservation
from apps.clients.serializers import ClientSerializer
from apps.materials.serializers import MaterielSerializer
from apps.factures.models import Facture
from django.db.models import Sum


class LigneReservationSerializer(serializers.ModelSerializer):
    materiel_detail = MaterielSerializer(source='materiel', read_only=True)
    prix_total      = serializers.ReadOnlyField()

    class Meta:
        model  = LigneReservation
        fields = ['id', 'materiel', 'materiel_detail', 'quantite', 'prix_unitaire', 'prix_total']

class ReservationSerializer(serializers.ModelSerializer):
    lignes         = LigneReservationSerializer(many=True)
    client_detail  = ClientSerializer(source='client', read_only=True)
    prix_total     = serializers.ReadOnlyField()
    facture_id     = serializers.SerializerMethodField()

    class Meta:
        model  = Reservation
        fields = [
            'id', 'client', 'client_detail', 'lignes',
            'date_debut', 'date_fin', 'statut', 'retard_jours',
            'prix_total', 'notes', 'created_at',
            'montant_recu', 'mode_paiement', 'date_paiement', 'facture_id'
        ]

    def get_facture_id(self, obj):
        facture = getattr(obj, 'facture', None)
        return facture.id if facture else None

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes')
        reservation = Reservation.objects.create(**validated_data)
        for ligne in lignes_data:
            LigneReservation.objects.create(reservation=reservation, **ligne)
        return reservation

    def update(self, instance, validated_data):
        lignes_data = validated_data.pop('lignes', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if lignes_data is not None:
            instance.lignes.all().delete()
            for ligne in lignes_data:
                LigneReservation.objects.create(reservation=instance, **ligne)
        return instance   