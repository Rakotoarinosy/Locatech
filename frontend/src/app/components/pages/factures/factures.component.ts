import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactureService } from '../../../services/facture.service';
import { ModalPayementComponent } from '../modal-payement/modal-payement.component';

@Component({
  selector: 'app-factures',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalPayementComponent], // ← ajouter ici
  templateUrl: './factures.component.html',
  styleUrl: './factures.component.scss'
})
export class FacturesComponent implements OnInit {

  factures: any[] = [];
  filteredFactures: any[] = [];
  searchTerm = '';
  statusFilter = '';

  totalFactures = 0;
  totalRevenus = 0;
  facturesEnAttente = 0;
  facturesAPayer = 0;

  showPaiementModal = false;
  selectedFacture: any = null;
  paiementLoading = false;

  constructor(private factureService: FactureService) {}

  ngOnInit(): void { this.loadFactures(); }

  loadFactures(): void {
    this.factureService.getFactures().subscribe({
      next: (data) => {
        this.factures = data;
        this.applyFilters();
        this.calculateKPIs();
      },
      error: (err) => console.error(err)
    });
  }

  calculateKPIs(): void {
    this.totalFactures = this.factures.length;
    this.totalRevenus = this.factures
      .filter(f => f.statut === 'payee')
      .reduce((sum, f) => sum + parseFloat(f.montant), 0);
    this.facturesEnAttente = this.factures.filter(f => f.statut === 'en_attente').length;
    this.facturesAPayer   = this.factures.filter(f => f.statut === 'a_payer').length;
  }

  onSearch(): void { this.applyFilters(); }

  applyFilters(): void {
    const term   = this.searchTerm.toLowerCase();
    const statut = this.statusFilter;
    this.filteredFactures = this.factures.filter(f => {
      const textMatch   = !term || f.numero?.toLowerCase().includes(term)
        || f.reservation_detail?.client_detail?.nom?.toLowerCase().includes(term);
      const statutMatch = !statut || f.statut === statut;
      return textMatch && statutMatch;
    });
  }

  openPaiementModal(facture: any): void {
    this.selectedFacture  = facture;
    this.showPaiementModal = true;
  }

  closePaiementModal(): void {
    this.showPaiementModal = false;
    this.selectedFacture  = null;
  }

  /**
   * Appelé par (confirmer) du modal — on ignore montant/mode
   * car côté facture le montant est déjà fixé dans le backend.
   */
  confirmerPaiement(event: { montant: number; mode: string }): void {
    if (!this.selectedFacture) return;
    this.paiementLoading = true;

    this.factureService.payer(this.selectedFacture.id, event.montant, event.mode).subscribe({
      next: () => {
        this.paiementLoading = false;
        this.closePaiementModal();
        this.loadFactures();
      },
      error: (err) => {
        this.paiementLoading = false;
        alert(err.error?.error ?? 'Erreur lors du paiement.');
      }
    });
  }

  annulerFacture(facture: any): void {
    if (!confirm('Annuler cette facture ?')) return;
    this.factureService.annuler(facture.id).subscribe({
      next: () => this.loadFactures(),
      error: (err) => alert(err.error?.error ?? 'Erreur.')
    });
  }

  downloadPdf(facture: any): void {
    this.factureService.download(facture.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `facture-${facture.numero}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => alert('Erreur téléchargement PDF.')
    });
  }

  getStatutBadge(statut: string): { css: string; label: string } {
    const map: { [k: string]: { css: string; label: string } } = {
      'payee':      { css: 'success',   label: 'Payée'      },
      'en_attente': { css: 'warning',   label: 'En attente' },
      'a_payer':    { css: 'danger',    label: 'À payer'    },
      'annulee':    { css: 'secondary', label: 'Annulée'    },
    };
    return map[statut] ?? { css: 'secondary', label: statut };
  }

  formatPrix(p: number): string {
    return new Intl.NumberFormat('fr-MG').format(p) + ' Ar';
  }
}