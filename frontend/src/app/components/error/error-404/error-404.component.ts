import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';


@Component({
  selector: 'app-error-404',
  standalone: true,
  imports: [RouterModule,RouterLink],
  templateUrl: './error-404.component.html',
  styleUrl: '../_errors.scss'
})
export class Error404Component {

}
