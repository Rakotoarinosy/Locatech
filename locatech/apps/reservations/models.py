from django.db import models

from apps.clients.models import Client
from apps.materials.models import Materiel

# Create your models here.
class Reservation(models.Model):
    STATUT_CHOICES = [
        ('en cours',  'En cours'),
        ('confirmee', 'Confirmée'),
        ('terminee',  'Terminée'),
        ('annulee',   'Annulée'),
    ]
    client = models.ForeignKey(Client, on_delete=models.CASCADE)
    materiel = models.ForeignKey(Materiel, on_delete=models.CASCADE)
    date_debut = models.DateField()
    date_fin = models.DateField()
    prix_total = models.DecimalField(max_digits=10, decimal_places=2)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en cours')
    retard_jours = models.PositiveIntegerField(default=0)
    quantite = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.client.nom} — {self.materiel.nom} ({self.date_debut} → {self.date_fin})"
