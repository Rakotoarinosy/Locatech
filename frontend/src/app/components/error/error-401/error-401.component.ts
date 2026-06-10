import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-error-401',
  standalone: true,
  imports: [RouterModule,RouterLink],
  templateUrl: './error-401.component.html',
  styleUrl: '../_errors.scss'
})
export class Error401Component {

}
