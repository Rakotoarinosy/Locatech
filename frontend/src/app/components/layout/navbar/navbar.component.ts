import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {


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
