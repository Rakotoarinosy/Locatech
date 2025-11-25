from django.db import models

from apps.clients.models import Client
from apps.materials.models import Materiel

# Create your models here.
class Reservation(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    materiel = models.ForeignKey(Materiel, on_delete=models.CASCADE)
    date_debut = models.DateField()
    date_fin = models.DateField()
    prix_total = models.DecimalField(max_digits=10, decimal_places=2)
    statut = models.CharField(default="en cours", max_length=20)
    retard_jours = models.PositiveIntegerField(default=0)
