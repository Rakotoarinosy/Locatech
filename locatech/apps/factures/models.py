from django.db import models
from apps.reservations.models import Reservation
from django.utils import timezone

class Facture(models.Model):

    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('a_payer', 'À payer'),
        ('payee', 'Payée'),
        ('annulee', 'Annulée'),
    ]

    numero = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
        null=True
    )

    reservation = models.OneToOneField(
        Reservation,
        on_delete=models.CASCADE,
        related_name='facture'
    )

    montant = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='en_attente'
    )

    pdf = models.FileField(
        upload_to='factures/',
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def save(self, *args, **kwargs):
    
        if not self.numero:

            today = timezone.now().strftime('%Y%m%d')

            derniere_facture = (
                Facture.objects
                .filter(numero__startswith=f'FAC-{today}')
                .order_by('-id')
                .first()
            )

            if derniere_facture:
                dernier_numero = int(
                    derniere_facture.numero.split('-')[-1]
                ) + 1
            else:
                dernier_numero = 1

            self.numero = (
                f'FAC-{today}-{dernier_numero:04d}'
            )

        super().save(*args, **kwargs)
        
    def __str__(self):
        return f"{self.numero}"