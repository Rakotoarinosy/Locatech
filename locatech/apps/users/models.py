from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.

class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=[('admin', 'Admin'), ('staff', 'Staff'), ('client', 'Client')],
        default='staff'
    )
    # Identifiant Google (claim "sub") pour la connexion « Continuer avec Google »
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)
