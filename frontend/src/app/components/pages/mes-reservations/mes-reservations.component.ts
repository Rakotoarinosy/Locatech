import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../layout/navbar/navbar.component';
import { CompteService, MaReservation } from '../../../services/compte.service';

const BADGES: Record<string, string> = {
  en_attente: 'bg-warning-subtle text-warning-emphasis',
  'en cours': 'bg-primary-subtle text-primary',
  confirmee: 'bg-primary-subtle text-primary',
  en_attente_retour: 'bg-info-subtle text-info-emphasis',
  terminee: 'bg-success-subtle text-success',
  annulee: 'bg-danger-subtle text-danger',
};

@Component({
  selector: 'app-mes-reservations',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './mes-reservations.component.html',
  styleUrl: './mes-reservations.component.scss'
})
export class MesReservationsComponent implements OnInit {
  readonly compte = inject(CompteService);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly reservations = signal<MaReservation[]>([]);
  readonly chargement = signal(true);
  readonly erreur = signal('');

  ngOnInit(): void {
    if (this.isBrowser) {
      this.charger();
    }
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.compte.mesReservations().subscribe({
      next: (reservations) => {
        this.reservations.set(reservations);
        this.chargement.set(false);
      },
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['/connexion'], { queryParams: { retour: '/mes-reservations' } });
          return;
        }
        this.erreur.set('Vos réservations sont momentanément indisponibles. Réessayez dans quelques instants.');
        this.chargement.set(false);
      }
    });
  }

  badge(statut: string): string {
    return BADGES[statut] ?? 'bg-secondary-subtle text-secondary';
  }

  duree(r: MaReservation): number {
    return Math.round((Date.parse(r.date_fin) - Date.parse(r.date_debut)) / 86_400_000) + 1;
  }

  deconnexion(): void {
    this.compte.deconnexion();
    this.router.navigate(['/home']);
  }
}
