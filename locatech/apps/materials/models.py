from django.db import models

# Create your models here.
class Materiel(models.Model):
    nom = models.CharField(max_length=100)
    categorie = models.CharField(max_length=50)
    prix_journalier = models.DecimalField(max_digits=10, decimal_places=2)
    statut = models.CharField(max_length=20, default="disponible")
    photo = models.ImageField(upload_to='materiels/', null=True, blank=True)
