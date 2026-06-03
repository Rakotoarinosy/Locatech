import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatBadgeModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent {
  
  pageTitle = 'Dashboard';
    constructor(private router: Router) {

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

        const url = this.router.url;

        if (url.includes('dashboard')) {
          this.pageTitle = 'Dashboard';
        }

        else if (url.includes('clients')) {
          this.pageTitle = 'Clients';
        }

        else if (url.includes('materiels')) {
          this.pageTitle = 'Matériels';
        }

        else if (url.includes('reservations')) {
          this.pageTitle = 'Réservations';
        }

        else if (url.includes('factures')) {
          this.pageTitle = 'Factures';
        }

        else if (url.includes('analytics')) {
          this.pageTitle = 'Analytics';
        }

      });

  }
}