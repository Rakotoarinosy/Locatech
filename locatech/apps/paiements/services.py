"""
Règles métier partagées par le back-office (paiement en espèces, MVola…) et le paiement par carte.
"""
import logging
from datetime import date

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.db.models import Sum

from apps.factures.models import Facture
from apps.reservations.models import LigneReservation, Reservation

logger = logging.getLogger(__name__)

# Réservations qui immobilisent du matériel sur leur période
STATUTS_ACTIFS = ('en_attente', 'en cours', 'confirmee', 'en_attente_retour')
# Matériel retiré de la location, quelle que soit la date
STATUTS_INDISPONIBLES = ('maintenance', 'casse')

JETON_SALT = 'locatech.paiement'
JETON_DUREE = 60 * 60 * 24 * 30  # 30 jours
JETON_FACTURE_SALT = 'locatech.facture'
JETON_FACTURE_DUREE = 60 * 60 * 24 * 365  # 1 an : le client garde l'accès à sa facture


# ── Stock par période ─────────────────────────────────────────────────

def quantite_disponible(materiel, debut, fin, exclure_reservation_id=None) -> int:
    """Unités libres sur toute la période [debut, fin] (bornes incluses)."""
    if materiel.statut in STATUTS_INDISPONIBLES:
        return 0
    occupees = (
        LigneReservation.objects
        .filter(materiel=materiel, reservation__statut__in=STATUTS_ACTIFS,
                reservation__date_debut__lte=fin, reservation__date_fin__gte=debut)
        .exclude(reservation_id=exclure_reservation_id)
        .aggregate(total=Sum('quantite'))['total'] or 0
    )
    return max(materiel.quantite - occupees, 0)


def verifier_disponibilite(demandes: dict, debut, fin) -> list[str]:
    """`demandes` = {materiel: quantité}. Renvoie les messages d'indisponibilité (liste vide = tout est libre)."""
    erreurs = []
    for materiel, quantite in demandes.items():
        libre = quantite_disponible(materiel, debut, fin)
        if quantite > libre:
            erreurs.append(
                f"{materiel.nom} : {libre} disponible(s) sur cette période" if libre
                else f"{materiel.nom} : indisponible sur cette période"
            )
    return erreurs


# ── Lien de paiement (sans compte) ────────────────────────────────────

def jeton_paiement(reservation) -> str:
    return signing.dumps({'r': reservation.id}, salt=JETON_SALT)


def reservation_depuis_jeton(jeton: str):
    """Renvoie la réservation du jeton, ou None s'il est invalide ou expiré."""
    try:
        data = signing.loads(jeton, salt=JETON_SALT, max_age=JETON_DUREE)
    except signing.BadSignature:
        return None
    return Reservation.objects.filter(pk=data.get('r')).first()


def lien_paiement(reservation) -> str:
    return f"{settings.PUBLIC_FRONTEND_URL.rstrip('/')}/paiement?jeton={jeton_paiement(reservation)}"


# ── Lien de téléchargement de facture (sans compte) ──────────────────

def jeton_facture(facture) -> str:
    return signing.dumps({'f': facture.id}, salt=JETON_FACTURE_SALT)


def facture_depuis_jeton(jeton: str):
    try:
        data = signing.loads(jeton, salt=JETON_FACTURE_SALT, max_age=JETON_FACTURE_DUREE)
    except signing.BadSignature:
        return None
    return Facture.objects.select_related('reservation').filter(pk=data.get('f')).first()


def url_facture(request, facture) -> str:
    """URL absolue du PDF, téléchargeable par le client sans être connecté."""
    return request.build_absolute_uri(f"/paiements/facture/?jeton={jeton_facture(facture)}")


# ── Facture et encaissement ───────────────────────────────────────────

def facture_de(reservation, montant=None) -> Facture:
    """Facture de la réservation, créée (avec son PDF) si elle n'existe pas encore."""
    facture = getattr(reservation, 'facture', None)
    if facture is None:
        from apps.factures.views import _generate_pdf
        facture = Facture.objects.create(
            reservation=reservation, montant=montant or reservation.prix_total, statut='en_attente'
        )
        _generate_pdf(facture)
    return facture


def est_payee(reservation) -> bool:
    facture = getattr(reservation, 'facture', None)
    return bool(facture and facture.statut == 'payee')


@transaction.atomic
def enregistrer_paiement(facture, mode: str, montant=None) -> Reservation:
    """
    Encaisse la facture : même effet que « Marquer payée » dans le back-office.
    La réservation passe en « confirmée » (ou « en attente de retour » si la période est déjà passée).
    """
    from apps.factures.views import _generate_pdf

    facture.statut = 'payee'
    facture.save()

    reservation = facture.reservation
    aujourd_hui = date.today()
    reservation.montant_recu = montant or facture.montant
    reservation.mode_paiement = mode
    reservation.date_paiement = aujourd_hui

    if aujourd_hui <= reservation.date_fin:
        reservation.statut = 'confirmee'
        for ligne in reservation.lignes.all():
            ligne.materiel.statut = 'loue'
            ligne.materiel.save()
    else:
        reservation.statut = 'en_attente_retour'
    reservation.save()

    _generate_pdf(facture)
    transaction.on_commit(lambda: _email_confirmation(reservation))
    return reservation


def _email_confirmation(reservation):
    try:
        from apps.notifications.services.email_service import EmailService
        EmailService.reservation_confirmee(reservation)
    except Exception as e:
        logger.error(f"Email reservation_confirmee échoué: {e}")
