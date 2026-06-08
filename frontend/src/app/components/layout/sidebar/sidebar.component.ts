import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button'

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, RouterLink,RouterModule, MatIconModule, MatButtonModule, MatBadgeModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  heroImageUrl : any = 'assets/img/undraw_rocket.svg';
  profile: any = "assets/img/undraw_profile.svg";
  image_eo : any = 'assets/img/EO.png';

  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  onOverlayClick() {
    this.closeSidebar.emit();
  }
}
