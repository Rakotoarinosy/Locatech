import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">
        <h2>LocaTech</h2>
        <p class="subtitle">Connexion au back-office</p>
        <div *ngIf="error" class="error">{{ error }}</div>
        <input [(ngModel)]="username" placeholder="Nom d utilisateur" type="text" />
        <input [(ngModel)]="password" placeholder="Mot de passe" type="password" (keyup.enter)="login()" />
        <button (click)="login()" [disabled]="loading">
          {{ loading ? "Connexion..." : "Se connecter" }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f0f2f5; }
    .login-card { background:white; padding:2.5rem; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,.1); width:100%; max-width:380px; display:flex; flex-direction:column; gap:1rem; }
    h2 { margin:0; color:#1a73e8; font-size:1.8rem; text-align:center; }
    .subtitle { margin:0; text-align:center; color:#666; font-size:.9rem; }
    .error { background:#fee; color:#c62828; padding:.75rem 1rem; border-radius:8px; font-size:.9rem; }
    input { padding:.75rem 1rem; border:1px solid #ddd; border-radius:8px; font-size:1rem; outline:none; }
    input:focus { border-color:#1a73e8; }
    button { padding:.85rem; background:#1a73e8; color:white; border:none; border-radius:8px; font-size:1rem; cursor:pointer; font-weight:600; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    button:hover:not(:disabled) { background:#1557b0; }
  `]
})
export class LoginComponent {
  username = "";
  password = "";
  error = "";
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  login(): void {
    this.error = "";
    this.loading = true;
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(["/back-office/dashboard"]),
      error: () => {
        this.error = "Identifiants incorrects";
        this.loading = false;
      }
    });
  }
}
