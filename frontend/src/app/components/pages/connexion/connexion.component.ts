import { AfterViewInit, Component, ElementRef, NgZone, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../layout/navbar/navbar.component';
import { CompteService } from '../../../services/compte.service';
import { RuntimeConfigService } from '../../../services/runtime-config.service';

declare const google: any;

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

@Component({
  selector: 'app-connexion',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="connexion-page d-flex align-items-center justify-content-center px-3">
      <div class="connexion-card card border-0 shadow-sm p-4 p-sm-5 text-center">
        <div class="icon-box mx-auto mb-3 bg-primary-subtle text-primary rounded-circle">
          <i class="bi bi-person-circle" aria-hidden="true"></i>
        </div>
        <h1 class="h4 fw-bold text-dark mb-2">Mon espace client</h1>
        <p class="text-secondary mb-4">Connectez-vous pour suivre vos réservations et retrouver vos factures.</p>

        <div #boutonGoogle class="d-flex justify-content-center" [class.d-none]="!boutonPret()"></div>

        <div *ngIf="!boutonPret() && !erreur()" class="text-secondary font-sm py-2" role="status">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Chargement…
        </div>
        <div *ngIf="enCours()" class="text-secondary font-sm mt-3" role="status">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Connexion en cours…
        </div>
        <div *ngIf="erreur()" class="alert alert-warning font-sm mt-3 mb-0" role="alert">{{ erreur() }}</div>

        <p class="text-muted font-xs mt-4 mb-0">
          Vous avez réservé sans compte ? Connectez-vous avec la même adresse email :
          vos réservations apparaîtront automatiquement.
        </p>
      </div>
    </main>
  `,
  styles: [`
    .connexion-page { min-height: 100vh; padding-top: 96px; background: #f8fafc; }
    .connexion-card { width: 100%; max-width: 420px; border-radius: 1.25rem; }
    .icon-box { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; }
    .font-sm { font-size: 0.875rem; }
    .font-xs { font-size: 0.75rem; }
  `]
})
export class ConnexionComponent implements AfterViewInit {
  @ViewChild('boutonGoogle') boutonGoogle!: ElementRef<HTMLDivElement>;

  private compte = inject(CompteService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  private runtimeConfig = inject(RuntimeConfigService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly boutonPret = signal(false);
  readonly enCours = signal(false);
  readonly erreur = signal('');

  private get retour(): string {
    const retour = this.route.snapshot.queryParamMap.get('retour') ?? '';
    // Uniquement des chemins internes, pour éviter toute redirection ouverte
    return retour.startsWith('/') && !retour.startsWith('//') ? retour : '/mes-reservations';
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    if (this.compte.connecte()) {
      this.router.navigateByUrl(this.retour);
      return;
    }
    this.runtimeConfig.charger().then(({ googleClientId }) => {
      if (!googleClientId) {
        this.erreur.set('La connexion Google n’est pas encore configurée. Contactez-nous pour suivre votre réservation.');
        return;
      }
      this.chargerScript()
        .then(() => this.afficherBouton(googleClientId))
        .catch(() => this.erreur.set('Impossible de charger la connexion Google. Vérifiez votre connexion internet puis rechargez la page.'));
    });
  }

  private chargerScript(): Promise<void> {
    if (typeof google !== 'undefined' && google.accounts?.id) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }

  private afficherBouton(clientId: string): void {
    google.accounts.id.initialize({
      client_id: clientId,
      // Le rappel Google s'exécute hors de la zone Angular
      callback: (reponse: { credential: string }) => this.zone.run(() => this.surIdentifiant(reponse.credential)),
    });
    google.accounts.id.renderButton(this.boutonGoogle.nativeElement, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      locale: 'fr',
      width: 300,
    });
    this.boutonPret.set(true);
  }

  private surIdentifiant(credential: string): void {
    this.enCours.set(true);
    this.erreur.set('');
    this.compte.connexionGoogle(credential).subscribe({
      next: () => this.router.navigateByUrl(this.retour),
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(err.error?.error ?? 'La connexion a échoué. Réessayez.');
      },
    });
  }
}
