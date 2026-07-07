import logging
import os

import requests


logger = logging.getLogger(__name__)


class N8nService:

    BASE_URL = os.getenv("N8N_INTERNAL_URL", "http://n8n:5678")

    @classmethod
    def reservation_created(cls, reservation):
        payload = {
            "event": "reservation.created",
            "reservation_id": reservation.id,
            "client": {
                "id": reservation.client.id,
                "nom": reservation.client.nom,
                "email": reservation.client.email,
            },
            "date_debut": str(reservation.date_debut),
            "date_fin": str(reservation.date_fin),
            "statut": reservation.statut,
            "prix_total": float(reservation.prix_total),
            "lignes": [
                {
                    "materiel_id": ligne.materiel.id,
                    "materiel": ligne.materiel.nom,
                    "quantite": ligne.quantite,
                    "prix_unitaire": float(ligne.prix_unitaire),
                }
                for ligne in reservation.lignes.all()
            ],
        }

        try:
            response = requests.post(
                f"{cls.BASE_URL}/webhook/reservation-created",
                json=payload,
                timeout=5,
            )

            response.raise_for_status()

            return True

        except requests.RequestException as exc:
            logger.error(
                "Erreur lors de l'appel du workflow n8n : %s",
                exc,
            )

            return False