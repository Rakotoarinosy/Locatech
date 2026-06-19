import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService, ReservationStats } from '../../../services/reservation.service';
import { ClientService } from '../../../services/client.service';
import { MaterielService } from '../../../services/materiel.service';
import { FactureService } from '../../../services/facture.service';
import { Materiel } from '../../../models/materiel.model';
import { Reservation } from '../../../models/reservation.models';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ModalPayementComponent } from '../modal-payement/modal-payement.component';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule,ModalPayementComponent],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss'
})
export class ReservationsComponent implements OnInit {

  // reservationSelectionnee!: Reservation;
  reservationSelectionnee: Reservation | null = null;
  reservations: Reservation[] = [];
  stats: ReservationStats = { total: 0, par_statut: {} };
  clients: any[] = [];
  materiels: Materiel[] = [];

  // Filtres
  searchTerm = '';
  selectedStatut = '';
  private searchSubject = new Subject<string>();

  // Modal création/édition
  showModal = false;
  isEditMode = false;
  errorMessage = '';
  newReservation: Partial<Reservation> = this.empty();
  prixEstime = 0;
  nbJours = 0;

  // Modal détails
  showDetailsModal = false;
  selectedReservation: Reservation | null = null;

  // ── NOUVEAU : Modal confirmation paiement ────────────────────────
  showPaiementModal = false;
  paiementReservationId: number | null = null;
  paiementMontant: number = 0;
  paiementMode: string = 'especes';
  paiementError: string = '';
  paiementLoading = false;

  // ── NOUVEAU : statuts complets avec couleurs ──────────────────────
  readonly STATUTS = [
    { value: 'en_attente',        label: 'En attente',     css: 'warning'   },
    { value: 'en cours',          label: 'En cours',       css: 'primary'   },
    { value: 'confirmee',         label: 'Confirmée',      css: 'success'   },
    { value: 'en_attente_retour', label: 'Retour attendu', css: 'purple'    },
    { value: 'terminee',          label: 'Terminée',       css: 'secondary' },
    { value: 'annulee',           label: 'Annulée',        css: 'danger'    },
  ];

  constructor(
    private reservationService: ReservationService,
    private clientService: ClientService,
    private materielService: MaterielService,
    private factureService: FactureService
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadReservations());
  }

  loadAll(): void {
    this.loadReservations();
    this.loadStats();
    this.clientService.getClients().subscribe(d => this.clients = d);
    this.materielService.getMateriels().subscribe(d => this.materiels = d);
  }

  loadReservations(): void {
    this.reservationService.getAll({
      statut: this.selectedStatut,
      search: this.searchTerm
    }).subscribe({
      next: d => this.reservations = d,
      error: e => console.error(e)
    });
  }

  loadStats(): void {
    this.reservationService.getStats().subscribe({
      next: d => this.stats = d,
      error: e => console.error(e)
    });
  }

  onSearch(): void { this.searchSubject.next(this.searchTerm); }
  onFilterChange(): void { this.loadReservations(); }

  // ── Calcul prix estimé ────────────────────────────────────────────
  onDatesOrMaterielChange(): void {
    const { date_debut, date_fin, materiel, quantite } = this.newReservation;
    if (date_debut && date_fin && materiel) {
      const d1 = new Date(date_debut);
      const d2 = new Date(date_fin);
      this.nbJours = Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      const mat = this.materiels.find(m => m.id === Number(materiel));
      this.prixEstime = mat ? this.nbJours * mat.prix_journalier * (quantite || 1) : 0;
    } else {
      this.nbJours = 0;
      this.prixEstime = 0;
    }
  }

  // ── Modals création/édition ───────────────────────────────────────
  openCreate(): void {
    this.isEditMode = false;
    this.newReservation = this.empty();
    this.prixEstime = 0;
    this.nbJours = 0;
    this.errorMessage = '';
    this.showModal = true;
  }

  openEdit(r: Reservation): void {
    this.isEditMode = true;
    this.newReservation = {
      ...r,
      client:   r.client_detail?.id ?? r.client,
      materiel: r.materiel_detail?.id ?? r.materiel,
    };
    this.onDatesOrMaterielChange();
    this.errorMessage = '';
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  // ── Modal détails ─────────────────────────────────────────────────
  openDetails(reservation: Reservation): void {
    this.selectedReservation = reservation;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedReservation = null;
  }

  // ── NOUVEAU : Modal confirmation paiement ─────────────────────────
  openPaiementModal(reservation: Reservation): void {
    this.paiementReservationId = reservation.id!;
    this.paiementMontant = reservation.prix_total || 0;
    this.paiementMode = 'especes';
    this.paiementError = '';
    this.paiementLoading = false;
    this.reservationSelectionnee = reservation;
    this.showPaiementModal = true;
  }

  closePaiementModal(): void {
    this.showPaiementModal = false;
    this.paiementReservationId = null;
  }

  validerPaiement(): void {
    if (!this.paiementReservationId || !this.paiementMontant) return;
    this.paiementLoading = true;
    this.paiementError = '';

    // Trouver la réservation pour récupérer facture_id
    const reservation = this.reservations.find(
      r => r.id === this.paiementReservationId
    );

    if (!reservation?.facture_id) {
      this.paiementError = 'Aucune facture trouvée. Générez d\'abord la facture.';
      this.paiementLoading = false;
      return;
    }

    // ✅ Appel sur la FACTURE, pas sur la réservation
    this.factureService.payer(reservation.facture_id).subscribe({
      next: () => {
        this.closePaiementModal();
        this.closeDetailsModal();
        this.loadAll();
      },
      error: (err) => {
        this.paiementLoading = false;
        this.paiementError = err.error?.error ?? 'Erreur lors du paiement.';
      }
    });
  }

  // ── Confirmation retour matériel ──────────────────────────────────
  confirmerRetour(id: number): void {
    if (!confirm('Confirmer le retour du matériel ?')) return;
    this.reservationService.confirmerRetour(id).subscribe({
      next: () => { this.closeDetailsModal(); this.loadAll(); },
      error: (err) => alert(err.error?.error ?? 'Erreur lors du retour.')
    });
  }

  // ── Annulation ────────────────────────────────────────────────────
  annuler(id: number): void {
    if (!confirm('Annuler cette réservation ?')) return;
    this.reservationService.annulerReservation(id).subscribe({
      next: () => { this.closeDetailsModal(); this.loadAll(); },
      error: (err) => alert(err.error?.error ?? 'Erreur lors de l\'annulation.')
    });
  }

  // ── Save ──────────────────────────────────────────────────────────
  saveReservation(): void {
    this.errorMessage = '';
    const payload: Partial<Reservation> = {
      client:     Number(this.newReservation.client),
      materiel:   Number(this.newReservation.materiel),
      date_debut: this.newReservation.date_debut,
      date_fin:   this.newReservation.date_fin,
      quantite:   this.newReservation.quantite ?? 1,
      notes:      this.newReservation.notes ?? '',
    };

    if (this.isEditMode && this.newReservation.id) {
      this.reservationService.update(this.newReservation.id, payload).subscribe({
        next: () => { this.closeModal(); this.loadAll(); },
        error: e => this.errorMessage = e.error?.non_field_errors?.[0] ?? 'Erreur lors de la modification.'
      });
    } else {
      this.reservationService.create(payload).subscribe({
        next: () => { this.closeModal(); this.loadAll(); },
        error: e => this.errorMessage = e.error?.non_field_errors?.[0] ?? 'Erreur lors de la création.'
      });
    }
  }

  onDelete(id: number): void {
    if (!confirm('Supprimer cette réservation ?')) return;
    this.reservationService.delete(id).subscribe({
      next: () => this.loadAll(),
      error: e => console.error(e)
    });
  }

  // ── Download facture ──────────────────────────────────────────────
  download(reservation: Reservation): void {
    if (!reservation.facture_id) {
      alert("Facture non disponible. Confirmez d'abord le paiement.");
      return;
    }
    this.factureService.download(reservation.facture_id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-reservation-${reservation.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => alert("Erreur lors du téléchargement du PDF.")
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  getStatutConfig(s: string) {
    return this.STATUTS.find(x => x.value === s) ?? { label: s, css: 'secondary' };
  }

  getStatutCss(s: string): string {
    return this.getStatutConfig(s).css;
  }

  getStatutLabel(s: string): string {
    return this.getStatutConfig(s).label;
  }

  formatPrix(p: number): string {
    return new Intl.NumberFormat('fr-MG').format(p) + ' Ar';
  }

  today(): string {
    return new Date().toISOString().split('T')[0];
  }

  getDuree(r: Reservation): number {
    if (!r.date_debut || !r.date_fin) return 0;
    const d1 = new Date(r.date_debut);
    const d2 = new Date(r.date_fin);
    return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private empty(): Partial<Reservation> {
    return { client: undefined, materiel: undefined, date_debut: '', date_fin: '', quantite: 1, notes: '' };
  }

  // Dans reservations.component.ts
  genererFacture(id: number): void {
    this.reservationService.updateStatut(id, 'confirmee').subscribe({
      next: () => this.loadAll(),
      error: (err) => alert(err.error?.error ?? 'Erreur')
    });
  }

  

  // ouvrirPaiement(reservation: Reservation) {
  //   this.reservationSelectionnee = reservation;
  //   this.showPaiementModal = true;
  // }

  confirmerPaiement(event: { montant: number; mode: string }) {
    const factureId = this.reservationSelectionnee?.facture_id;
    if (!factureId) {
      this.paiementError = 'Aucune facture disponible pour ce paiement.';
      return;
    }
    this.paiementLoading = true;
    this.paiementError = '';

    this.factureService
        .payer(factureId)
        .subscribe({
          next: () => {
            this.paiementLoading = false;
            this.showPaiementModal = false;
            this.loadAll();
          },
          error: (err) => {
            this.paiementLoading = false;
            this.paiementError = err.error?.error ?? 'Erreur lors du paiement.';
          }
        });
  }
}