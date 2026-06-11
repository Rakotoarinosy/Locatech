import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button'
import { ReservationService } from '../../../services/reservation.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, RouterLink,RouterModule, MatIconModule, MatButtonModule, MatBadgeModule, ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  heroImageUrl : any = 'assets/img/undraw_rocket.svg';
  profile: any = "assets/img/undraw_profile.svg";
  image_eo : any = 'assets/img/EO.png';
  reservationCount: number = 0; 
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(private reservationService: ReservationService) {}

  ngOnInit(): void {
    // Écoute en continu les changements du compteur de réservations
    this.reservationService.pendingCount$.subscribe(count => {
      this.reservationCount = count;
    });

    // Premier chargement des données au démarrage de la sidebar
    this.reservationService.refreshPendingCount();
  }
  onOverlayClick() {
    this.closeSidebar.emit();
  }

  calculateReservationCount() {
    this.reservationCount = 0;

  }
}
