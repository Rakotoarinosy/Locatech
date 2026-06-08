import { Component, Input, Output, EventEmitter, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatBadgeModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent {
  @Input() pageTitle = 'Dashboard';
  @Input() sidebarOpen = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  
  private authService = inject(AuthService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);

  showDropdown = false; // Pilotage de l'affichage du logout

  onToggle() {
    this.toggleSidebar.emit();
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
  }

  onLogout() {
    this.authService.logout();
  }

  // Ferme le dropdown proprement si on clique n'importe où ailleurs sur l'écran
  @HostListener('document:click', ['$event'])
  clickOut(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }
  
  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const url = this.router.url;
        if (url.includes('dashboard')) this.pageTitle = 'Dashboard';
        else if (url.includes('clients')) this.pageTitle = 'Clients';
        else if (url.includes('materiels')) this.pageTitle = 'Matériels';
        else if (url.includes('reservations')) this.pageTitle = 'Réservations';
        else if (url.includes('factures')) this.pageTitle = 'Factures';
        else if (url.includes('analytics')) this.pageTitle = 'Analytics';
        this.showDropdown = false; // Ferme le menu lors d'un changement de route
      });
  }
}