import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FactureService } from '../../../services/facture.service'; // Ajuste le chemin relatif si besoin
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-factures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './factures.component.html',
  styleUrl: './factures.component.scss'
})
export class FacturesComponent implements OnInit {
  factures: any[] = [];
  filteredFactures: any[] = [];
  searchTerm: string = '';
  statusFilter: string = '';

  // Variables pour les KPIs du haut
  totalFactures: number = 0;
  totalRevenus: number = 0;
  facturesImpayees: number = 0;

  constructor(private factureService: FactureService) {}

  ngOnInit(): void {
    this.loadAllFactures();
  }

  loadAllFactures(): void {
    this.factureService.getFactures().subscribe({
      next: (data) => {
        this.factures = data;
        this.filteredFactures = data;
        this.calculateKPIs();
      },
      error: (err) => console.error('Erreur lors du chargement des factures', err)
    });
  }

  calculateKPIs(): void {
    this.totalFactures = this.factures.length;
    // Calcule la somme de toutes les factures dont le statut est 'payee'
    this.totalRevenus = this.factures
      .filter(f => f.statut === 'payee')
      .reduce((sum, f) => sum + parseFloat(f.montant), 0);

    // 2. Compte le nombre de factures en attente (impayées)
    this.facturesImpayees = this.factures
      .filter(f => f.statut !== 'payee').length;
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase();
    const statutTarget = this.statusFilter;

    this.filteredFactures = this.factures.filter(facture => {

    let matchesText = true;
    if (term) {
      const numeroMatch = facture.numero?.toLowerCase().includes(term);
      const clientMatch = facture.reservation_detail?.client_detail?.nom?.toLowerCase().includes(term);
      
      matchesText = numeroMatch || clientMatch;
    }

    
    let matchesStatut = true;
    if (statutTarget) {
      matchesStatut = facture.statut === statutTarget;
    }

    // La facture doit valider les deux conditions
    return matchesText && matchesStatut;
    });
  }

  downloadPdf(facture: any): void {
    this.factureService.download(facture.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${facture.numero}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Erreur au téléchargement du PDF', err);
        alert('Erreur lors de la récupération du fichier PDF.');
      }
    });
  }
}