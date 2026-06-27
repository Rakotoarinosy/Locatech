from django.db import models
from datetime import datetime
from apps.clients.models import Client
from apps.materials.models import Materiel

# Create your models here.
class Reservation(models.Model):
    STATUT_CHOICES = [
        ('en_attente',        'En attente de paiement'),
        ('en cours',          'En cours'),
        ('confirmee',         'Confirmée — Matériel sorti'),
        ('en_attente_retour', 'En attente de retour'),
        ('terminee',          'Terminée'),
        ('annulee',           'Annulée'),
    ]
    client      = models.ForeignKey(Client, on_delete=models.CASCADE)
    date_debut  = models.DateField()
    date_fin    = models.DateField()
    statut      = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    retard_jours = models.PositiveIntegerField(default=0)
    notes       = models.TextField(blank=True, default='')
    created_at  = models.DateTimeField(auto_now_add=True)
    montant_recu   = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    mode_paiement  = models.CharField(max_length=50, choices=[
        ('especes', 'Espèces'), ('mvola', 'MVola'),
        ('orange', 'Orange Money'), ('virement', 'Virement'),
    ], null=True, blank=True)
    date_paiement = models.DateField(null=True, blank=True)

    @property
    def prix_total(self):
        """Somme des prix_total de toutes les lignes."""
        return sum(l.prix_total for l in self.lignes.all())

    def __str__(self):
        return f"{self.client.nom} ({self.date_debut} → {self.date_fin})"


class LigneReservation(models.Model):
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name='lignes')
    materiel    = models.ForeignKey(Materiel, on_delete=models.CASCADE)
    quantite    = models.PositiveIntegerField(default=1)
    prix_unitaire = models.DecimalField(max_digits=10, decimal_places=2)  # snapshot du prix au moment de la résa

    @property
    def prix_total(self):
        from decimal import Decimal

        debut = self.reservation.date_debut
        fin = self.reservation.date_fin

        if isinstance(debut, str):
            debut = datetime.strptime(debut, "%Y-%m-%d").date()

        if isinstance(fin, str):
            fin = datetime.strptime(fin, "%Y-%m-%d").date()

        duree = (fin - debut).days + 1

        return self.prix_unitaire * self.quantite * Decimal(duree)