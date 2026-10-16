from django.db import models

from apps.reservations.models import Reservation


class PaiementCarte(models.Model):
    """Tentative de paiement par carte via la passerelle ecommerce_monitoring (un « payment intent »)."""

    STATUT_CHOICES = [
        ('pending', 'En cours'),
        ('success', 'Réussi'),
        ('failed', 'Refusé'),
        ('cancelled', 'Annulé'),
    ]
    FINAUX = ('success', 'failed', 'cancelled')

    reservation  = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name='paiements_carte')
    intent_id    = models.CharField(max_length=64, unique=True)
    montant      = models.PositiveIntegerField(help_text='Montant en ariary (MGA, sans décimales)')
    statut       = models.CharField(max_length=20, choices=STATUT_CHOICES, default='pending')
    checkout_url = models.URLField(max_length=500)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.intent_id} · réservation {self.reservation_id} · {self.statut}"
