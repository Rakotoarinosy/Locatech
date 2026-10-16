import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PanierService } from '../../../services/panier.service';
import { CompteService } from '../../../services/compte.service';
import { PanierDrawerComponent } from '../panier-drawer/panier-drawer.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, PanierDrawerComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  readonly panier = inject(PanierService);
  readonly compte = inject(CompteService);


  closeNavbar() {

    this.isNavbarOpen = false;

    const navbar = document.getElementById('navbarNav');

    if (navbar?.classList.contains('show')) {
      navbar.classList.remove('show');
    }
  }

  isNavbarOpen = false;

  toggleNavbar() {
    this.isNavbarOpen = !this.isNavbarOpen;
  }

}
