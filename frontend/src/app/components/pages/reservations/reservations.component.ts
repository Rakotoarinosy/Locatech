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

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss'
})
export class ReservationsComponent implements OnInit {

  reservations: Reservation[] = [];
  stats: ReservationStats = { total: 0, par_statut: {} };
  clients: any[] = [];
  materiels: Materiel[] = [];

  // Filtres
  searchTerm = '';
  selectedStatut = '';
  private searchSubject = new Subject<string>();

  // Modal
  showModal = false;
  isEditMode = false;
  errorMessage = '';

  // Modal détails
  showDetailsModal = false;
  selectedReservation: Reservation | null = null;

  newReservation: Partial<Reservation> = this.empty();

  // Prix calculé en temps réel
  prixEstime = 0;
  nbJours = 0;

  readonly STATUTS = [
    { value: 'en cours',  label: 'En cours',  css: 'primary'   },
    { value: 'confirmee', label: 'Confirmée', css: 'success'   },
    { value: 'terminee',  label: 'Terminée',  css: 'secondary' },
    { value: 'annulee',   label: 'Annulée',   css: 'danger'    },
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

  // ── Calcul prix en temps réel ──────────────────
  onDatesOrMaterielChange(): void {
  const {
    date_debut,
    date_fin,
    materiel,
    quantite
  } = this.newReservation;

  if (date_debut && date_fin && materiel) {

    const d1 = new Date(date_debut);
    const d2 = new Date(date_fin);

    this.nbJours = Math.max(
      0,
      Math.ceil(
        (d2.getTime() - d1.getTime()) /
        (1000 * 60 * 60 * 24)
      )
    );

    const mat = this.materiels.find(
      m => m.id === Number(materiel)
    );

    this.prixEstime = mat
      ? this.nbJours *
        mat.prix_journalier *
        (quantite || 1)
      : 0;

  } else {
    this.nbJours = 0;
    this.prixEstime = 0;
  }
  }

  // ── Modal ──────────────────────────────────────
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

  openDetails(reservation: Reservation) {
    this.selectedReservation = reservation;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedReservation = null;
  }


  changeStatut(id: number, statut: string): void {
    this.reservationService.updateStatut(id, statut).subscribe({
      next: () => {

        if (this.selectedReservation) {
          this.selectedReservation.statut = statut;
        }

        this.loadAll();

        if (
          statut === 'terminee' ||
          statut === 'annulee'
        ) {
          this.closeDetailsModal();
        }
      },

      error: (err) => {
        console.error(err);
        alert('Impossible de mettre à jour le statut.');
      }
    });

  }

  closeModal(): void { this.showModal = false; }

  // ── Save ──────────────────────────────────────
  saveReservation(): void {
    this.errorMessage = '';
    const payload: Partial<Reservation> = {
      client:     Number(this.newReservation.client),
      materiel:   Number(this.newReservation.materiel),
      date_debut: this.newReservation.date_debut,
      date_fin:   this.newReservation.date_fin,
      quantite:   this.newReservation.quantite ?? 1,
      notes:      this.newReservation.notes ?? '',
      statut:     this.newReservation.statut ?? 'en cours',
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

  // ── Helpers ──────────────────────────────────
  getStatutCss(s: string): string {
    return this.STATUTS.find(x => x.value === s)?.css ?? 'secondary';
  }

  getStatutLabel(s: string): string {
    return this.STATUTS.find(x => x.value === s)?.label ?? s;
  }

  formatPrix(p: number): string {
    return new Intl.NumberFormat('fr-MG').format(p) + ' Ar';
  }

  today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private empty(): Partial<Reservation> {
    return { client: undefined, materiel: undefined, date_debut: '', date_fin: '', quantite: 1, notes: '', statut: 'en cours' };
  }

  getDuree(r: Reservation): number {
    if (!r.date_debut || !r.date_fin) return 0;
    const d1 = new Date(r.date_debut);
    const d2 = new Date(r.date_fin);
    return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  }

  download(reservation: Reservation) {
  if (!reservation.facture_id) {
    alert("La facture n'est pas encore disponible. Veuillez d'abord confirmer la réservation.");
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
    error: (err) => {
      console.error(err);
      alert("Erreur lors du téléchargement du PDF.");
    }
  });
}
}