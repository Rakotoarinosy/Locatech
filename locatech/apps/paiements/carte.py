"""Paiement par carte : création de l'intent et application de son statut (webhook ou vérification au retour)."""
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from . import gateway
from .models import PaiementCarte
from .services import enregistrer_paiement, est_payee, facture_de, jeton_paiement

logger = logging.getLogger(__name__)


class PaiementImpossible(Exception):
    """La réservation ne peut pas (ou plus) être payée par carte."""


def _duree(reservation) -> int:
    return (reservation.date_fin - reservation.date_debut).days + 1


def montant_ariary(reservation) -> int:
    facture = getattr(reservation, 'facture', None)
    return int(Decimal(facture.montant if facture else reservation.prix_total))


def _lignes(reservation, montant: int) -> list[dict] | None:
    """Détail affiché sur la page de paiement ; omis si l'arrondi ne retombe pas exactement sur le total."""
    duree = _duree(reservation)
    lignes = [
        {'name': f"{l.materiel.nom} ({duree} j)"[:120], 'unit_amount': int(l.prix_unitaire * duree), 'quantity': l.quantite}
        for l in reservation.lignes.select_related('materiel')
    ]
    total = sum(l['unit_amount'] * l['quantity'] for l in lignes)
    return lignes if lignes and total == montant and all(l['unit_amount'] > 0 for l in lignes) else None


def demarrer(reservation) -> PaiementCarte:
    """Crée un nouvel intent (la passerelle annule le précédent encore en cours) et renvoie la tentative."""
    if reservation.statut != 'en_attente' or est_payee(reservation):
        raise PaiementImpossible('Cette réservation ne peut plus être payée en ligne.')

    montant = montant_ariary(reservation)
    retour = f"{settings.PUBLIC_FRONTEND_URL.rstrip('/')}/paiement?jeton={jeton_paiement(reservation)}"
    intent = gateway.creer_intent(
        reference=str(reservation.id),
        montant=montant,
        description=f"Location LocaTech n° {reservation.id}",
        client_nom=reservation.client.nom,
        client_email=reservation.client.email,
        lignes=_lignes(reservation, montant),
        success_url=f"{retour}&retour=success",
        cancel_url=f"{retour}&retour=cancelled",
    )

    with transaction.atomic():
        reservation.paiements_carte.filter(statut='pending').update(statut='cancelled')
        reservation.mode_paiement = 'carte'
        reservation.save(update_fields=['mode_paiement'])
        return PaiementCarte.objects.create(
            reservation=reservation, intent_id=intent['id'], montant=montant,
            statut='pending', checkout_url=intent['checkout_url'],
        )


def actualiser(paiement: PaiementCarte) -> PaiementCarte:
    """Relit l'intent auprès de la passerelle (source de vérité) puis applique son statut."""
    if paiement.statut == 'pending':
        appliquer(paiement, gateway.lire_intent(paiement.intent_id))
        paiement.refresh_from_db()
    return paiement


@transaction.atomic
def appliquer(paiement: PaiementCarte, intent: dict) -> None:
    """Applique le statut d'un intent ; idempotent (webhook et vérification peuvent arriver tous les deux)."""
    paiement = PaiementCarte.objects.select_for_update().get(pk=paiement.pk)
    reservation = paiement.reservation

    if intent.get('id') != paiement.intent_id or str(intent.get('merchant_reference')) != str(reservation.id):
        logger.warning("Intent %s ignoré : ne correspond pas à la réservation %s", intent.get('id'), reservation.id)
        return
    if intent.get('amount') is not None and int(intent['amount']) != paiement.montant:
        logger.error("Intent %s ignoré : montant %s ≠ %s attendu", paiement.intent_id, intent.get('amount'), paiement.montant)
        return

    statut = intent.get('status')
    if statut == 'success':
        if paiement.statut != 'success':
            # Un succès arrivé tard (après un « annulé » local) reste pris en compte : l'argent est encaissé
            paiement.statut = 'success'
            paiement.save(update_fields=['statut', 'updated_at'])
        if est_payee(reservation):
            return
        if reservation.statut == 'annulee':
            logger.error("Paiement carte %s reçu pour la réservation annulée %s : remboursement manuel à prévoir",
                         paiement.intent_id, reservation.id)
            return
        enregistrer_paiement(facture_de(reservation, paiement.montant), mode='carte', montant=paiement.montant)
    elif statut in ('failed', 'cancelled') and paiement.statut == 'pending':
        paiement.statut = statut
        paiement.save(update_fields=['statut', 'updated_at'])
