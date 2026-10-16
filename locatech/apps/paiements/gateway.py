"""
Client de la passerelle de paiement ecommerce_monitoring (même passerelle que BazarStore).

Appels serveur à serveur uniquement : le navigateur ne parle jamais à la passerelle,
il est seulement redirigé vers la page de paiement (`checkout_url`).
"""
import hashlib
import hmac
import time

import requests
from django.conf import settings

SIGNATURE_TOLERANCE_SECONDS = 300
TIMEOUT_SECONDS = 10


class PasserelleIndisponible(Exception):
    """Passerelle non configurée ou injoignable."""


class SignatureInvalide(Exception):
    """Webhook non signé par la passerelle, ou trop ancien (rejeu)."""


def est_configuree() -> bool:
    return bool(settings.PAYMENT_GATEWAY_URL and settings.PAYMENT_GATEWAY_API_KEY)


def _appel(methode: str, chemin: str, **kwargs) -> dict:
    if not est_configuree():
        raise PasserelleIndisponible('Passerelle de paiement non configurée.')
    url = f"{settings.PAYMENT_GATEWAY_URL.rstrip('/')}/v1{chemin}"
    try:
        reponse = requests.request(
            methode, url, timeout=TIMEOUT_SECONDS,
            headers={'Authorization': f'Bearer {settings.PAYMENT_GATEWAY_API_KEY}'},
            **kwargs,
        )
        reponse.raise_for_status()
        return reponse.json()
    except (requests.RequestException, ValueError) as exc:
        raise PasserelleIndisponible(str(exc)) from exc


def creer_intent(*, reference: str, montant: int, description: str, client_nom: str, client_email: str,
                 lignes: list[dict] | None, success_url: str, cancel_url: str) -> dict:
    payload = {
        'merchant_reference': reference,
        'amount': montant,
        'currency': 'MGA',
        'description': description[:120],
        'order_reference': reference[:40],
        'customer_name': client_nom,
        'customer_email': client_email,
        'success_url': success_url,
        'cancel_url': cancel_url,
    }
    if lignes:
        payload['lines'] = lignes
    return _appel('POST', '/payment-intents', json=payload)


def lire_intent(intent_id: str) -> dict:
    return _appel('GET', f'/payment-intents/{intent_id}')


def verifier_signature(corps_brut: bytes, entete: str, maintenant: float | None = None) -> None:
    """En-tête `X-Gateway-Signature: t=<unix>,v1=<hex>` ; v1 = HMAC-SHA256(secret, "<t>." + corps brut)."""
    secret = settings.PAYMENT_GATEWAY_WEBHOOK_SECRET
    if not secret:
        raise PasserelleIndisponible('Secret de webhook non configuré.')
    try:
        parties = dict(p.split('=', 1) for p in (entete or '').split(','))
        horodatage = int(parties['t'])
        recue = parties['v1']
    except (KeyError, ValueError) as exc:
        raise SignatureInvalide('En-tête de signature illisible.') from exc

    maintenant = time.time() if maintenant is None else maintenant
    if abs(maintenant - horodatage) > SIGNATURE_TOLERANCE_SECONDS:
        raise SignatureInvalide('Webhook trop ancien.')

    attendue = hmac.new(secret.encode(), f'{horodatage}.'.encode() + corps_brut, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(attendue, recue):
        raise SignatureInvalide('Signature invalide.')
