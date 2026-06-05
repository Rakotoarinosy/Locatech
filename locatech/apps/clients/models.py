from django.db import models

# Create your models here.
class Client(models.Model):
    nom = models.CharField(max_length=100)
    type_client = models.CharField(max_length=50, choices=[('particulier', 'Particulier'), ('entreprise', 'Entreprise')], default='particulier')
    email = models.EmailField()
    telephone = models.CharField(max_length=20)
    adresse = models.CharField(max_length=200)
    cni = models.ImageField(upload_to='cnis/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=[('actif', 'Actif'), ('inactif', 'Inactif')], default='actif')
    
    def __str__(self):
        return f"{self.nom} ({self.email})"