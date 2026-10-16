import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../layout/navbar/navbar.component';
import { PaiementService, StatutPaiement } from '../../../services/paiement.service';

const VERIFICATIONS_MAX = 5;
const INTERVALLE_MS = 2500;

/**
 * Page de retour de la passerelle et cible du lien envoyé par email.
 * Le jeton signé de l'URL identifie la réservation : aucun compte n'est nécessaire.
 */
@Component({
  selector: 'app-paiement',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './paiement.component.html',
  styleUrl: './paiement.component.scss'
})
export class PaiementComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private paiementService = inject(PaiementService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly statut = signal<StatutPaiement | null>(null);
  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly redirection = signal(false);
  /** Retour de la page de paiement : « success » (paiement validé côté passerelle) ou « cancelled ». */
  readonly retour = signal('');

  private jeton = '';
  private verifications = 0;
  private minuteur?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const params = this.route.snapshot.queryParamMap;
    this.jeton = params.get('jeton') ?? '';
    this.retour.set(params.get('retour') ?? '');
    if (!this.jeton) {
      this.chargement.set(false);
      this.erreur.set('Lien de paiement incomplet. Utilisez le lien reçu par email.');
      return;
    }
    this.charger();
  }

  ngOnDestroy(): void {
    clearTimeout(this.minuteur);
  }

  charger(): void {
    this.paiementService.statut(this.jeton).subscribe({
      next: (statut) => {
        this.statut.set(statut);
        this.chargement.set(false);
        this.erreur.set('');
        // La passerelle a redirigé avant que son webhook ne soit traité : on revérifie quelques fois
        if (this.retour() === 'success' && !statut.payee && statut.paiement_carte === 'pending'
            && this.verifications++ < VERIFICATIONS_MAX) {
          this.minuteur = setTimeout(() => this.charger(), INTERVALLE_MS);
        }
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(err.error?.error ?? 'Impossible de charger votre réservation. Réessayez dans quelques instants.');
      }
    });
  }

  verifierEncore(): void {
    this.verifications = 0;
    this.chargement.set(true);
    this.charger();
  }

  payerCarte(): void {
    this.redirection.set(true);
    this.erreur.set('');
    this.paiementService.payerCarte(this.jeton).subscribe({
      next: ({ checkout_url }) => this.paiementService.redirigerVers(checkout_url),
      error: (err) => {
        this.redirection.set(false);
        this.erreur.set(err.error?.error ?? 'Le paiement par carte est momentanément indisponible.');
      }
    });
  }

  payerEspeces(): void {
    this.erreur.set('');
    this.paiementService.payerEspeces(this.jeton).subscribe({
      next: (statut) => {
        this.retour.set('');
        this.statut.set(statut);
      },
      error: (err) => this.erreur.set(err.error?.error ?? 'Le changement de mode de paiement a échoué. Réessayez.'),
    });
  }

  /** Le client peut encore choisir les espèces (réservation non payée, pas déjà en espèces). */
  peutPasserEnEspeces(s: StatutPaiement): boolean {
    return !s.payee && s.statut === 'en_attente' && s.mode_paiement !== 'especes' && !this.enVerification(s);
  }

  enVerification(s: StatutPaiement): boolean {
    return !s.payee && s.paiement_carte === 'pending' && this.retour() === 'success';
  }
}
