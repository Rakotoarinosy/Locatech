import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ModalPayementComponent } from '../modal-payement/modal-payement.component';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

interface LigneForm {
  id?: number;
  materiel: number;
  quantite: number;
  prix_unitaire: number;
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalPayementComponent],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss'
})
export class ReservationsComponent implements OnInit {
  private http = inject(HttpClient);
  private searchSubject = new Subject<string>();

  // ── Données ───────────────────────────────────────────────────────
  reservations: any[] = [];
  clients: any[] = [];
  materiels: any[] = [];
  stats = { total: 0, par_statut: {} as any };

  // ── Filtres ───────────────────────────────────────────────────────
  searchTerm = '';
  selectedStatut = '';

  // ── Modals ────────────────────────────────────────────────────────
  showModal = false;
  showDetailsModal = false;
  showPaiementModal = false;
  isEditMode = false;
  errorMessage = '';
  selectedReservation: any = null;
  reservationSelectionnee: any = null;

  // ── Formulaire réservation ────────────────────────────────────────
  newReservation: any = {
    id: undefined, client: undefined,
    date_debut: '', date_fin: '', notes: ''
  };
  lignesForm: LigneForm[] = [];
  prixEstime = 0;
  nbJours = 1;

  // ── Statuts ───────────────────────────────────────────────────────
  readonly STATUTS = [
    { value: 'en_attente',        label: 'En attente',        css: 'warning'   },
    { value: 'confirmee',         label: 'Confirmée',         css: 'success'   },
    { value: 'en_attente_retour', label: 'Retour attendu',    css: 'purple'    },
    { value: 'terminee',          label: 'Terminée',          css: 'secondary' },
    { value: 'annulee',           label: 'Annulée',           css: 'danger'    },
  ];

  readonly MODES_PAIEMENT = [
    { value: 'especes',  label: 'Espèces'      },
    { value: 'mvola',    label: 'MVola'         },
    { value: 'orange',   label: 'Orange Money'  },
    { value: 'virement', label: 'Virement'      },
  ];

  // ── URLs API ──────────────────────────────────────────────────────
  private get apiResa() { return `${environment.apiUrl}/reservations/reservations/`; }
  private get apiFactures() { return `${environment.apiUrl}/factures/factures/`; }

  // ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadReservations());
  }

  loadAll(): void {
    this.loadReservations();
    this.http.get<any[]>(`${environment.apiUrl}/clients/clients/`)
      .subscribe(d => this.clients = d);
    this.http.get<any[]>(`${environment.apiUrl}/materiels/materiels/`)
      .subscribe(d => this.materiels = d);
  }

  loadReservations(): void {
    let url = `${this.apiResa}`;
    const params: string[] = [];
    if (this.selectedStatut) params.push(`statut=${this.selectedStatut}`);
    if (this.searchTerm)     params.push(`search=${this.searchTerm}`);
    if (params.length)       url += '?' + params.join('&');

    this.http.get<any[]>(url).subscribe({
      next: d => { this.reservations = d; this.calculerStats(); },
      error: e => console.error('Erreur chargement réservations', e)
    });
  }

  calculerStats(): void {
    this.stats.total = this.reservations.length;
    this.stats.par_statut = {};
    this.reservations.forEach(r => {
      this.stats.par_statut[r.statut] = (this.stats.par_statut[r.statut] || 0) + 1;
    });
  }

  // ── Filtres ───────────────────────────────────────────────────────
  onSearch(): void   { this.searchSubject.next(this.searchTerm); }
  onFilterChange(): void { this.loadReservations(); }

  // ── Création / Édition ────────────────────────────────────────────
  openCreate(): void {
    this.isEditMode = false;
    this.errorMessage = '';
    this.newReservation = {
      id: undefined, client: undefined,
      date_debut: this.today(), date_fin: this.today(), notes: ''
    };
    this.lignesForm = [{ materiel: 0, quantite: 1, prix_unitaire: 0 }];
    this.prixEstime = 0;
    this.nbJours = 1;
    this.showModal = true;
  }

  openEdit(r: any): void {
    this.isEditMode = true;
    this.errorMessage = '';
    this.newReservation = {
      id: r.id, client: r.client,
      date_debut: r.date_debut, date_fin: r.date_fin, notes: r.notes
    };
    this.lignesForm = (r.lignes || []).map((l: any) => ({
      id: l.id,
      materiel: l.materiel,
      quantite: l.quantite,
      prix_unitaire: parseFloat(l.prix_unitaire)
    }));
    this.onDatesOrMaterielChange();
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  ajouterLigne(): void {
    this.lignesForm.push({ materiel: 0, quantite: 1, prix_unitaire: 0 });
  }

  supprimerLigne(i: number): void {
    if (this.lignesForm.length > 1) {
      this.lignesForm.splice(i, 1);
      this.calculerPrixTotal();
    }
  }

  onMaterielLigneChange(i: number): void {
    const ligne = this.lignesForm[i];
    const mat = this.materiels.find(m => m.id == ligne.materiel);
    if (mat) ligne.prix_unitaire = parseFloat(mat.prix_journalier);
    this.calculerPrixTotal();
  }

  onDatesOrMaterielChange(): void {
    if (this.newReservation.date_debut && this.newReservation.date_fin) {
      const d1 = new Date(this.newReservation.date_debut);
      const d2 = new Date(this.newReservation.date_fin);
      this.nbJours = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / 86400000) || 1;
    }
    this.calculerPrixTotal();
  }

  calculerPrixTotal(): void {
    this.prixEstime = this.lignesForm.reduce(
      (sum, l) => sum + l.prix_unitaire * l.quantite * this.nbJours, 0
    );
  }

  saveReservation(): void {
    this.errorMessage = '';
    const ligneInvalide = this.lignesForm.some(l => !l.materiel || l.quantite <= 0);
    if (ligneInvalide) {
      this.errorMessage = 'Veuillez sélectionner un matériel valide et une quantité pour chaque ligne.';
      return;
    }
    const payload = { ...this.newReservation, lignes: this.lignesForm };
    const req = this.isEditMode
      ? this.http.put(`${this.apiResa}${payload.id}/`, payload)
      : this.http.post(this.apiResa, payload);

    req.subscribe({
      next: () => { this.closeModal(); this.loadReservations(); },
      error: e => {
        this.errorMessage = e.error?.detail
          || e.error?.non_field_errors?.[0]
          || JSON.stringify(e.error)
          || 'Erreur lors de la sauvegarde.';
      }
    });
  }

  onDelete(id: number): void {
    if (!confirm('Supprimer cette réservation ?')) return;
    this.http.delete(`${this.apiResa}${id}/`).subscribe({
      next: () => this.loadReservations(),
      error: () => alert('Erreur lors de la suppression.')
    });
  }

  // ── Actions métier ────────────────────────────────────────────────

  /** en_attente → confirmee + génère facture */
  genererFacture(id: number): void {
    this.http.patch(`${this.apiResa}${id}/statut/`, { statut: 'confirmee' }).subscribe({
      next: () => { this.closeDetailsModal(); this.loadReservations(); },
      error: e => alert(e.error?.error ?? 'Erreur lors de la confirmation.')
    });
  }

  /** Ouvre le modal de paiement */
  openPaiementModal(r: any): void {
    this.reservationSelectionnee = r;
    this.showPaiementModal = true;
  }

  /** Appelé par (confirmer) du modal-payement */
  confirmerPaiement(event: { montant: number; mode: string }): void {
    const factureId = this.reservationSelectionnee?.facture_id;
    if (!factureId) {
      alert('Aucune facture trouvée. Confirmez d\'abord la réservation.');
      return;
    }
    this.http.patch(`${this.apiFactures}${factureId}/payer/`, {}).subscribe({
      next: () => {
        this.showPaiementModal = false;
        this.closeDetailsModal();
        this.loadReservations();
      },
      error: e => alert(e.error?.error ?? 'Erreur lors du paiement.')
    });
  }

  /** confirmee / en_attente_retour → terminee */
  confirmerRetour(id: number): void {
    if (!confirm('Confirmer le retour du matériel ?')) return;
    this.http.patch(`${this.apiResa}${id}/confirmer-retour/`, {}).subscribe({
      next: () => { this.closeDetailsModal(); this.loadReservations(); },
      error: e => alert(e.error?.error ?? 'Erreur lors du retour.')
    });
  }

  /** Annuler une réservation */
  annuler(id: number): void {
    if (!confirm('Annuler cette réservation ?')) return;
    this.http.patch(`${this.apiResa}${id}/statut/`, { statut: 'annulee' }).subscribe({
      next: () => { this.closeDetailsModal(); this.loadReservations(); },
      error: e => alert(e.error?.error ?? 'Erreur lors de l\'annulation.')
    });
  }

  /** Télécharger le PDF de la facture */
  download(r: any): void {
    if (!r.facture_id) {
      alert('Aucune facture disponible.');
      return;
    }
    this.http.get(`${this.apiFactures}${r.facture_id}/download/`, { responseType: 'blob' })
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `facture-reservation-${r.id}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => alert('Erreur lors du téléchargement du PDF.')
      });
  }

  // ── Modal Détails ─────────────────────────────────────────────────
  openDetails(r: any): void {
    this.selectedReservation = r;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedReservation = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────
  getStatutConfig(s: string) {
    return this.STATUTS.find(x => x.value === s) ?? { label: s, css: 'secondary' };
  }
  getStatutCss(s: string): string   { return this.getStatutConfig(s).css; }
  getStatutLabel(s: string): string { return this.getStatutConfig(s).label; }

  formatPrix(v: number): string {
    return new Intl.NumberFormat('fr-MG').format(v) + ' Ar';
  }

  today(): string {
    return new Date().toISOString().split('T')[0];
  }

  getDuree(r: any): number {
    if (!r?.date_debut || !r?.date_fin) return 0;
    return Math.ceil(
      Math.abs(new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime()) / 86400000
    ) || 1;
  }
}