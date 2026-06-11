from rest_framework import serializers
from .models import Reservation
from apps.clients.serializers import ClientSerializer
from apps.materials.serializers import MaterielSerializer
from apps.factures.models import Facture
from django.db.models import Sum


class ReservationSerializer(serializers.ModelSerializer):
    client_detail   = ClientSerializer(source='client',   read_only=True)
    materiel_detail = MaterielSerializer(source='materiel', read_only=True)
    
    facture_id = serializers.SerializerMethodField()

    def get_facture_id(self, obj):
        if hasattr(obj, 'facture'):
            return obj.facture.id
        return None

    class Meta:
        model = Reservation
        fields = '__all__'
        read_only_fields = ('id', 'prix_total', 'retard_jours', 'facture_id')

    def validate(self, data):
        date_debut = data.get('date_debut')
        date_fin   = data.get('date_fin')
        materiel   = data.get('materiel')
        quantite   = data.get('quantite', 1)

        # 1. Dates cohérentes
        if date_debut and date_fin and date_debut >= date_fin:
            raise serializers.ValidationError(
                "La date de fin doit être après la date de début."
            )

        if date_debut and date_fin and materiel:

            # 2. Quantité ne dépasse pas le stock total du matériel
            if quantite > materiel.quantite:
                raise serializers.ValidationError(
                    f"Quantité demandée ({quantite}) supérieure au stock disponible ({materiel.quantite})."
                )

            # 3. Quantité déjà réservée sur la même période
            reservations_chevauchantes = Reservation.objects.filter(
                materiel=materiel,
                statut__in=['en cours', 'confirmee'],
                date_debut__lt=date_fin,
                date_fin__gt=date_debut,
            )
            if self.instance:
                reservations_chevauchantes = reservations_chevauchantes.exclude(
                    pk=self.instance.pk
                )

            # Somme des quantités déjà réservées sur cette période
            quantite_deja_reservee = reservations_chevauchantes.aggregate(
                total=Sum('quantite')
            )['total'] or 0

            quantite_disponible = materiel.quantite - quantite_deja_reservee

            if quantite > quantite_disponible:
                raise serializers.ValidationError(
                    f"Stock insuffisant sur cette période. "
                    f"Disponible : {quantite_disponible} / {materiel.quantite}. "
                    f"Déjà réservé : {quantite_deja_reservee}."
                )

        return data

    def create(self, validated_data):
        materiel   = validated_data['materiel']
        date_debut = validated_data['date_debut']
        date_fin   = validated_data['date_fin']
        quantite   = validated_data.get('quantite', 1)

        nb_jours = (date_fin - date_debut).days

        validated_data['prix_total'] = (
            materiel.prix_journalier
            * nb_jours
            * quantite
        )

        reservation = super().create(validated_data)

        # Facture.objects.create(
        #     reservation=reservation,
        #     montant=reservation.prix_total
        # )

        return reservation
    
    def update(self, instance, validated_data):
        materiel = validated_data.get('materiel', instance.materiel)
        date_debut = validated_data.get('date_debut', instance.date_debut)
        date_fin = validated_data.get('date_fin', instance.date_fin)
        quantite = validated_data.get('quantite', instance.quantite)

        nb_jours = (date_fin - date_debut).days

        instance.prix_total = (
            materiel.prix_journalier *
            nb_jours *
            quantite
        )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        return instance