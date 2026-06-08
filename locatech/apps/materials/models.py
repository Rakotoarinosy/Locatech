from django.db import models

# Create your models here.
class Materiel(models.Model):
    STATUT_CHOICES = [
        ('disponible', 'Disponible'),
        ('reserve', 'Réservé'),
        ('loue', 'Loué'),
        ('maintenance', 'Maintenance'),
        ('casse', 'Cassé'),
    ]
    nom = models.CharField(max_length=100)
    categorie = models.CharField(max_length=50)
    prix_journalier = models.DecimalField(max_digits=10, decimal_places=2)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="disponible")
    photo = models.ImageField(upload_to='materiels/', null=True, blank=True)
    description = models.TextField(blank=True)
    quantite = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.nom
