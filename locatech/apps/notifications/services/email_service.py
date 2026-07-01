from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Service centralisé d'envoi d'emails pour LocaTech."""

    FROM = settings.DEFAULT_FROM_EMAIL

    @classmethod
    def _send(cls, subject: str, to_email: str, html_content: str) -> bool:
        """Méthode privée d'envoi commune."""
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=cls._html_to_text(html_content),
                from_email=cls.FROM,
                to=[to_email]
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            logger.info(f"[EMAIL] Envoyé à {to_email} — {subject}")
            return True
        except Exception as e:
            logger.error(f"[EMAIL] Erreur envoi à {to_email} : {e}")
            return False

    @classmethod
    def _html_to_text(cls, html: str) -> str:
        """Fallback texte simple."""
        import re
        return re.sub(r'<[^>]+>', '', html)

    # ── Templates inline ─────────────────────────────────────────────

    @classmethod
    def _base_template(cls, title: str, body: str, cta_url: str = '', cta_label: str = '') -> str:
        cta_html = f"""
            <div style="text-align:center; margin: 32px 0;">
              <a href="{cta_url}" style="
                background-color:#1A56DB; color:#ffffff;
                padding:14px 32px; border-radius:50px;
                text-decoration:none; font-weight:700; font-size:15px;">
                {cta_label}
              </a>
            </div>
        """ if cta_url else ''

        return f"""
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0; padding:0; background-color:#f8fafc; font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0"
                     style="background:#ffffff; border-radius:16px;
                            box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1A56DB,#1d4ed8);
                              padding:32px 40px; text-align:center;">
                    <h1 style="margin:0; color:#fff; font-size:26px; font-weight:800;">
                      ● <span style="color:#000;">Loca</span><span style="color:#0e6fff;">Tech</span>
                    </h1>
                    <p style="margin:8px 0 0; color:rgba(255,255,255,0.8); font-size:13px;">
                      Plateforme de gestion de location · Madagascar
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 20px; color:#0f172a; font-size:20px;">{title}</h2>
                    {body}
                    {cta_html}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f1f5f9; padding:24px 40px; text-align:center;">
                    <p style="margin:0; color:#94a3b8; font-size:12px;">
                      LocaTech Madagascar · Immeuble Cyber, Ankorondrano, Antananarivo<br>
                      <a href="https://locatech-mada.rakotoarinosy.com"
                         style="color:#1A56DB; text-decoration:none;">
                        locatech-mada.rakotoarinosy.com
                      </a>
                    </p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """

    # ── Emails métier ─────────────────────────────────────────────────

    @classmethod
    def nouvelle_reservation(cls, reservation) -> bool:
        """📧 Email au client quand une réservation est créée."""
        lignes_html = ''.join([
            f"""<tr>
                  <td style="padding:8px 12px; border-bottom:1px solid #f1f5f9;">
                    {l.materiel.nom}
                  </td>
                  <td style="padding:8px 12px; border-bottom:1px solid #f1f5f9; text-align:center;">
                    ×{l.quantite}
                  </td>
                  <td style="padding:8px 12px; border-bottom:1px solid #f1f5f9; text-align:right;">
                    {int(l.prix_unitaire):,} Ar/j
                  </td>
                </tr>"""
            for l in reservation.lignes.all()
        ])

        body = f"""
            <p style="color:#374151; line-height:1.7;">
              Bonjour <strong>{reservation.client.nom}</strong>,<br><br>
              Votre demande de réservation a bien été reçue.
              Notre équipe la traitera dans les plus brefs délais.
            </p>

            <div style="background:#f8fafc; border-radius:12px; padding:20px; margin:20px 0;">
              <h3 style="margin:0 0 12px; color:#1A56DB; font-size:15px;">
                📋 Récapitulatif de votre réservation
              </h3>
              <p style="margin:4px 0; color:#374151; font-size:14px;">
                <strong>Période :</strong>
                {reservation.date_debut.strftime('%d/%m/%Y')} →
                {reservation.date_fin.strftime('%d/%m/%Y')}
              </p>

              <table width="100%" style="margin-top:12px; border-collapse:collapse;">
                <thead>
                  <tr style="background:#e2e8f0;">
                    <th style="padding:8px 12px; text-align:left; font-size:12px; color:#64748b;">
                      Matériel
                    </th>
                    <th style="padding:8px 12px; text-align:center; font-size:12px; color:#64748b;">
                      Qté
                    </th>
                    <th style="padding:8px 12px; text-align:right; font-size:12px; color:#64748b;">
                      Prix unitaire
                    </th>
                  </tr>
                </thead>
                <tbody>{lignes_html}</tbody>
              </table>

              <div style="margin-top:16px; padding-top:12px;
                          border-top:2px solid #1A56DB; text-align:right;">
                <strong style="color:#1A56DB; font-size:18px;">
                  Total : {int(reservation.prix_total):,} Ar
                </strong>
              </div>
            </div>

            <p style="color:#64748b; font-size:13px;">
              Vous recevrez une confirmation dès que le paiement sera validé.
            </p>
        """
        return cls._send(
            subject=f"✅ Réservation reçue — LocaTech",
            to_email=reservation.client.email,
            html_content=cls._base_template(
                title="Votre réservation a été reçue !",
                body=body
            )
        )

    @classmethod
    def reservation_confirmee(cls, reservation) -> bool:
        """📧 Email quand la réservation est confirmée (paiement reçu)."""
        body = f"""
            <p style="color:#374151; line-height:1.7;">
              Bonjour <strong>{reservation.client.nom}</strong>,<br><br>
              Votre paiement a été reçu et votre réservation est maintenant
              <strong style="color:#16a34a;">confirmée</strong> ! 🎉
            </p>

            <div style="background:#f0fdf4; border:1px solid #bbf7d0;
                        border-radius:12px; padding:20px; margin:20px 0;">
              <p style="margin:4px 0; color:#374151;">
                <strong>📅 Période :</strong>
                {reservation.date_debut.strftime('%d/%m/%Y')} →
                {reservation.date_fin.strftime('%d/%m/%Y')}
              </p>
              <p style="margin:8px 0 0; color:#374151;">
                <strong>💰 Montant confirmé :</strong>
                {int(reservation.prix_total):,} Ar
              </p>
            </div>

            <p style="color:#374151; line-height:1.7;">
              Le matériel sera à votre disposition à partir du
              <strong>{reservation.date_debut.strftime('%d/%m/%Y')}</strong>.
              Merci de votre confiance !
            </p>
        """
        return cls._send(
            subject="🎉 Réservation confirmée — LocaTech",
            to_email=reservation.client.email,
            html_content=cls._base_template(
                title="Votre réservation est confirmée !",
                body=body
            )
        )

    @classmethod
    def facture_generee(cls, facture) -> bool:
        """📧 Email avec lien de téléchargement de la facture."""
        r = facture.reservation
        pdf_url = f"https://locatech-mada.rakotoarinosy.com/api/factures/factures/{facture.id}/download/"

        body = f"""
            <p style="color:#374151; line-height:1.7;">
              Bonjour <strong>{r.client.nom}</strong>,<br><br>
              Votre facture <strong>N° {facture.numero}</strong> est disponible.
            </p>

            <div style="background:#f8fafc; border-radius:12px;
                        padding:20px; margin:20px 0; text-align:center;">
              <p style="font-size:32px; font-weight:800; color:#1A56DB; margin:0;">
                {int(facture.montant):,} Ar
              </p>
              <p style="color:#64748b; font-size:13px; margin:8px 0 0;">
                Statut : <strong>{facture.get_statut_display()}</strong>
              </p>
            </div>
        """
        return cls._send(
            subject=f"🧾 Facture {facture.numero} — LocaTech",
            to_email=r.client.email,
            html_content=cls._base_template(
                title=f"Votre facture est disponible",
                body=body,
                cta_url=pdf_url,
                cta_label="📄 Télécharger la facture"
            )
        )

    @classmethod
    def rappel_retour_demain(cls, reservation) -> bool:
        """📧 Rappel J-1 avant la date de retour."""
        body = f"""
            <p style="color:#374151; line-height:1.7;">
              Bonjour <strong>{reservation.client.nom}</strong>,<br><br>
              Petit rappel : le retour de votre matériel est prévu
              <strong>demain, le {reservation.date_fin.strftime('%d/%m/%Y')}</strong>.
            </p>

            <div style="background:#fffbeb; border:1px solid #fde68a;
                        border-radius:12px; padding:20px; margin:20px 0;">
              <h3 style="margin:0 0 10px; color:#d97706;">⚠️ Matériels à retourner</h3>
              {''.join([f"<p style='margin:4px 0; color:#374151;'>• {l.materiel.nom} ×{l.quantite}</p>" for l in reservation.lignes.all()])}
            </div>

            <p style="color:#374151; line-height:1.7;">
              En cas de retard, des <strong style="color:#dc2626;">pénalités de 150%</strong>
              du tarif journalier seront appliquées par jour de retard.
            </p>
        """
        return cls._send(
            subject="⏰ Rappel : retour du matériel demain — LocaTech",
            to_email=reservation.client.email,
            html_content=cls._base_template(
                title="Retour du matériel prévu demain",
                body=body
            )
        )

    @classmethod
    def retard_constate(cls, reservation) -> bool:
        """📧 Email quand un retard est détecté."""
        from datetime import date
        from decimal import Decimal
        jours_retard = max(0, (date.today() - reservation.date_fin).days)
        
        if jours_retard == 0:
            return False  # ← pas de retard, on n'envoie rien
        
        penalites = sum(
            l.prix_unitaire * l.quantite * Decimal('1.5') * Decimal(jours_retard)
            for l in reservation.lignes.all()
        )

        body = f"""
            <p style="color:#374151; line-height:1.7;">
              Bonjour <strong>{reservation.client.nom}</strong>,<br><br>
              Nous constatons que le matériel loué n'a pas encore été retourné alors que
              la date prévue était le <strong>{reservation.date_fin.strftime('%d/%m/%Y')}</strong>.
            </p>

            <div style="background:#fef2f2; border:1px solid #fecaca;
                        border-radius:12px; padding:20px; margin:20px 0;">
              <h3 style="margin:0 0 10px; color:#dc2626;">
                🚨 Retard de {jours_retard} jour(s)
              </h3>
              {''.join([f"<p style='margin:4px 0; color:#374151;'>• {l.materiel.nom} ×{l.quantite}</p>" for l in reservation.lignes.all()])}
              <p style="margin:12px 0 0; color:#dc2626; font-weight:700;">
                Pénalités : {int(penalites):,} Ar
              </p>
            </div>

            <p style="color:#374151;">
              Merci de procéder au retour dans les plus brefs délais.
              Contactez-nous au <strong>+261 32 841 9170</strong>.
            </p>
        """
        return cls._send(
            subject=f"🚨 Retard de {jours_retard}j — Merci de retourner le matériel",
            to_email=reservation.client.email,
            html_content=cls._base_template(
                title="Matériel en retard de retour",
                body=body
            )
        )
        
    @classmethod
    def reservation_terminee(cls, reservation) -> bool:
        """📧 Email lorsque le matériel a été retourné dans les délais."""

        body = f"""
            <p style="color:#374151; line-height:1.7;">
                Bonjour <strong>{reservation.client.nom}</strong>,<br><br>

                Nous vous confirmons que le retour de votre matériel a bien été enregistré.
                Votre réservation est désormais <strong style="color:#16a34a;">terminée</strong>.
            </p>

            <div style="
                background:#f0fdf4;
                border:1px solid #bbf7d0;
                border-radius:12px;
                padding:20px;
                margin:20px 0;">

                <h3 style="margin:0 0 10px; color:#16a34a;">
                    ✅ Retour enregistré
                </h3>

                <p><strong>Date de retour :</strong> {reservation.date_fin.strftime('%d/%m/%Y')}</p>

                <p><strong>Matériels retournés :</strong></p>

                {''.join([
                    f"<p style='margin:4px 0;'>• {l.materiel.nom} ×{l.quantite}</p>"
                    for l in reservation.lignes.all()
                ])}

            </div>

            <p style="color:#374151;">
                Nous vous remercions pour votre confiance et espérons vous revoir bientôt
                chez <strong>LocaTech</strong>.
            </p>
        """

        return cls._send(
            subject="✅ Retour confirmé — Merci pour votre confiance",
            to_email=reservation.client.email,
            html_content=cls._base_template(
                title="Votre réservation est terminée",
                body=body
            )
        )