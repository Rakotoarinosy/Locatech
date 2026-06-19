import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-modal-payement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-payement.component.html',
  styleUrl: './modal-payement.component.scss'
})
export class ModalPayementComponent implements OnChanges {

  @Input() visible = false;
  @Input() montantFacture = 0;

  @Output() close = new EventEmitter<void>();

  @Output() confirmer = new EventEmitter<{
    montant: number;
    mode: string;
  }>();

  paiementMontant = 0;
  paiementMode = 'especes';
  paiementError = '';
  paiementLoading = false;

  readonly MODES_PAIEMENT = [
    { value: 'especes', label: 'Espèces' },
    { value: 'mvola', label: 'MVola' },
    { value: 'orange', label: 'Orange Money' },
    { value: 'virement', label: 'Virement' }
  ];

  ngOnChanges(): void {
    this.paiementMontant = this.montantFacture;
    // Bloquer/débloquer le scroll du body
    if (this.visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeModal(): void {
    document.body.style.overflow = '';
    this.close.emit();
  }

  validerPaiement(): void {
    this.confirmer.emit({
      montant: this.paiementMontant,
      mode: this.paiementMode
    });
  }

  formatPrix(montant: number): string {
    return new Intl.NumberFormat('fr-MG').format(montant) + ' Ar';
  }
}