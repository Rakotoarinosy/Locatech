from django.db import models

# Create your models here.
class Client(models.Model):
    nom = models.CharField(max_length=100)
    email = models.EmailField()
    telephone = models.CharField(max_length=20)
    adresse = models.CharField(max_length=200)
    cni = models.ImageField(upload_to='cnis/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)