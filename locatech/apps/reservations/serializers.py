from rest_framework import serializers
from .models import Reservation
from apps.clients.serializers import ClientSerializer
from apps.materials.serializers import MaterielSerializer


class ReservationSerializer(serializers.ModelSerializer):
    client_detail = ClientSerializer(source='client', read_only=True)
    materiel_detail = MaterielSerializer(source='materiel', read_only=True)

    class Meta:
        model = Reservation
        fields = '__all__'
        read_only_fields = ('id', 'prix_total', 'retard_jours')

    def validate(self, data):
        date_debut = data.get('date_debut')
        date_fin = data.get('date_fin')
        materiel = data.get('materiel')
        if date_debut and date_fin and date_debut >= date_fin:
            raise serializers.ValidationError(
                "La date de fin doit être après la date de début."
            )
        if date_debut and date_fin and materiel:
            qs = Reservation.objects.filter(
                materiel=materiel,
                statut__in=['en cours', 'confirmee'],
                date_debut__lt=date_fin,
                date_fin__gt=date_debut,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Ce matériel est déjà réservé sur cette période."
                )
        return data

    def create(self, validated_data):
        materiel = validated_data['materiel']
        date_debut = validated_data['date_debut']
        date_fin = validated_data['date_fin']
        nb_jours = (date_fin - date_debut).days
        validated_data['prix_total'] = materiel.prix_journalier * nb_jours
        materiel.statut = 'reserve'
        materiel.save()
        return super().create(validated_data)
