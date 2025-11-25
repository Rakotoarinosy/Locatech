from django.db import models

from apps.reservations.models import Reservation

# Create your models here.
class Facture(models.Model):
    reservation = models.OneToOneField(Reservation, on_delete=models.CASCADE)
    montant = models.DecimalField(max_digits=10, decimal_places=2)
    pdf = models.FileField(upload_to='factures/')
    created_at = models.DateTimeField(auto_now_add=True)
