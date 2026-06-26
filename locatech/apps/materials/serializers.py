from rest_framework import serializers
from .models import Categorie, Materiel

class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ['id', 'nom']

class MaterielSerializer(serializers.ModelSerializer):
    categorie = CategorieSerializer(read_only=True)
    categorie_id = serializers.PrimaryKeyRelatedField(
        queryset=Categorie.objects.all(),
        source='categorie',
        write_only=True
    )

    class Meta:
        model = Materiel
        fields = [
            'id', 'nom', 'categorie', 'categorie_id',
            'prix_journalier', 'statut', 'photo',
            'description', 'quantite', 'created_at'
        ]