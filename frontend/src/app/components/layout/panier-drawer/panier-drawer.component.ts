import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PanierService } from '../../../services/panier.service';
import { LandingPageService } from '../../../services/landing-page.service';
import { CompteService } from '../../../services/compte.service';
import { ModePaiement, PaiementService } from '../../../services/paiement.service';

type Etape = 'panier' | 'infos' | 'confirmation';

@Component({
  selector: 'app-panier-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './panier-drawer.component.html',
  styleUrl: './panier-drawer.component.scss'
})
export class PanierDrawerComponent {
  readonly panier = inject(PanierService);
  readonly compte = inject(CompteService);
  private landingPageService = inject(LandingPageService);
  private paiementService = inject(PaiementService);

  readonly etape = signal<Etape>('panier');
  readonly envoiEnCours = signal(false);
  readonly erreur = signal('');
  /** Matériels refusés par le serveur faute de stock sur la période choisie. */
  readonly indisponibles = signal<string[]>([]);
  readonly modePaiement = signal<ModePaiement>('especes');
  readonly carteDisponible = signal(false);
  /** Réservation enregistrée mais paiement par carte non démarré (passerelle indisponible). */
  readonly avertissementPaiement = signal('');

  readonly aujourdHui = this.formatDate(new Date());
  form = {
    date_debut: '',
    date_fin: '',
    client_nom: '',
    client_email: '',
    client_telephone: '',
    notes: ''
  };

  private readonly dates = signal({ debut: '', fin: '' });

  /** Durée en jours, bornes incluses (même règle que le backend). */
  readonly duree = computed(() => {
    const { debut, fin } = this.dates();
    if (!debut || !fin) {
      return 0;
    }
    const jours = Math.round((Date.parse(fin) - Date.parse(debut)) / 86_400_000) + 1;
    return jours > 0 ? jours : 0;
  });

  readonly totalEstime = computed(() => this.panier.totalJournalier() * Math.max(this.duree(), 1));

  trackById(_: number, ligne: { produit: { id: number } }): number {
    return ligne.produit.id;
  }

  /** Saisie clavier de la quantité ; le champ est réaligné si la valeur a été bornée (ex. 0 → 1). */
  saisirQuantite(index: number, event: Event): void {
    const champ = event.target as HTMLInputElement;
    champ.value = String(this.panier.definirQuantite(index, champ.valueAsNumber));
  }

  majDates(): void {
    if (this.form.date_fin && this.form.date_debut && this.form.date_fin < this.form.date_debut) {
      this.form.date_fin = this.form.date_debut;
    }
    this.dates.set({ debut: this.form.date_debut, fin: this.form.date_fin });
  }

  fermer(): void {
    this.panier.ouvert.set(false);
    if (this.etape() === 'confirmation') {
      this.etape.set('panier');
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panier.ouvert()) {
      this.fermer();
    }
  }

  continuer(): void {
    this.erreur.set('');
    this.paiementService.config().subscribe({
      next: (config) => {
        this.carteDisponible.set(config.carte);
        if (!config.carte) this.modePaiement.set('especes');
      },
      error: () => this.carteDisponible.set(false),
    });
    const u = this.compte.utilisateur();
    if (u) {
      this.form.client_nom ||= this.compte.nomAffiche();
      this.form.client_email ||= u.email;
    }
    this.etape.set('infos');
  }

  envoyer(ngForm: NgForm): void {
    if (ngForm.invalid || this.duree() === 0 || this.envoiEnCours()) {
      ngForm.control.markAllAsTouched();
      return;
    }

    this.envoiEnCours.set(true);
    this.erreur.set('');
    this.indisponibles.set([]);
    this.avertissementPaiement.set('');
    this.landingPageService.creerReservation({
      ...this.form,
      mode_paiement: this.modePaiement(),
      lignes: this.panier.lignes().map((l) => ({ materiel_id: l.produit.id, quantite: l.quantite }))
    }, this.compte.enTetes()).subscribe({
      next: (reponse) => {
        this.panier.vider();
        if (reponse.paiement?.checkout_url) {
          // Carte : on quitte le site pour la page de paiement sécurisée, le retour se fait sur /paiement
          this.paiementService.redirigerVers(reponse.paiement.checkout_url);
          return;
        }
        this.avertissementPaiement.set(reponse.paiement?.erreur ?? '');
        this.form = { date_debut: '', date_fin: '', client_nom: '', client_email: '', client_telephone: '', notes: '' };
        this.dates.set({ debut: '', fin: '' });
        this.etape.set('confirmation');
        this.envoiEnCours.set(false);
      },
      error: (err) => {
        this.indisponibles.set(err.error?.indisponibles ?? []);
        this.erreur.set(err.error?.error ?? err.error?.detail ?? 'La réservation n’a pas pu être envoyée. Réessayez dans quelques instants.');
        this.envoiEnCours.set(false);
      }
    });
  }

  private formatDate(d: Date): string {
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const jour = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mois}-${jour}`;
  }
}
