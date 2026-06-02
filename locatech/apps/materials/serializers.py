from rest_framework import serializers
from .models import Materiel

class MaterielSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materiel
        fields = '__all__'
        read_only_fields = ('id', 'created_at')