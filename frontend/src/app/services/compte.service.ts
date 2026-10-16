import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CompteUtilisateur {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface MaLigneReservation {
  id: number;
  nom: string;
  photo: string | null;
  quantite: number;
  prix_unitaire: string;
  prix_total: string;
}

export interface MaReservation {
  id: number;
  date_debut: string;
  date_fin: string;
  statut: string;
  statut_label: string;
  prix_total: string;
  montant_recu: string | null;
  created_at: string;
  lignes: MaLigneReservation[];
  facture: { numero: string; statut: string } | null;
}

interface GoogleLoginResponse {
  access: string;
  refresh: string;
  user: CompteUtilisateur;
}

// Clés distinctes de celles du back-office : une session client n'ouvre jamais l'espace équipe
const ACCESS_KEY = 'compte_access_token';
const REFRESH_KEY = 'compte_refresh_token';
const USER_KEY = 'compte_user';

/** Session de l'espace client (connexion « Continuer avec Google »). */
@Injectable({ providedIn: 'root' })
export class CompteService {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private base = environment.apiUrl;

  readonly utilisateur = signal<CompteUtilisateur | null>(this.lireUtilisateur());
  readonly connecte = computed(() => this.utilisateur() !== null);
  readonly nomAffiche = computed(() => {
    const u = this.utilisateur();
    return u ? (`${u.first_name} ${u.last_name}`.trim() || u.email) : '';
  });

  connexionGoogle(credential: string): Observable<GoogleLoginResponse> {
    return this.http.post<GoogleLoginResponse>(`${this.base}/auth/google/`, { credential }).pipe(
      tap((res) => {
        this.stocker(ACCESS_KEY, res.access);
        this.stocker(REFRESH_KEY, res.refresh);
        this.stocker(USER_KEY, JSON.stringify(res.user));
        this.utilisateur.set(res.user);
      })
    );
  }

  deconnexion(): void {
    [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach((k) => this.supprimer(k));
    this.utilisateur.set(null);
  }

  /** En-tête à joindre aux requêtes faites au nom du client (vide s'il n'est pas connecté). */
  enTetes(): HttpHeaders {
    const token = this.lire(ACCESS_KEY);
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  mesReservations(): Observable<MaReservation[]> {
    return this.avecRafraichissement(() =>
      this.http.get<MaReservation[]>(`${this.base}/reservations/reservations/mes-reservations/`, { headers: this.enTetes() })
    );
  }

  /** Rejoue la requête une fois après avoir renouvelé le jeton d'accès expiré. */
  private avecRafraichissement<T>(requete: () => Observable<T>): Observable<T> {
    return requete().pipe(
      catchError((err: HttpErrorResponse) => {
        const refresh = this.lire(REFRESH_KEY);
        if (err.status !== 401 || !refresh) {
          return throwError(() => err);
        }
        return this.http.post<{ access: string }>(`${this.base}/token/refresh/`, { refresh }).pipe(
          tap((res) => this.stocker(ACCESS_KEY, res.access)),
          switchMap(() => requete()),
          catchError((e) => {
            this.deconnexion();
            return throwError(() => e);
          })
        );
      })
    );
  }

  private lireUtilisateur(): CompteUtilisateur | null {
    try {
      const brut = this.lire(USER_KEY);
      return brut && this.lire(ACCESS_KEY) ? JSON.parse(brut) : null;
    } catch {
      return null;
    }
  }

  private lire(cle: string): string | null {
    if (!this.isBrowser) return null;
    try { return localStorage.getItem(cle); } catch { return null; }
  }

  private stocker(cle: string, valeur: string): void {
    if (!this.isBrowser) return;
    try { localStorage.setItem(cle, valeur); } catch { /* stockage indisponible */ }
  }

  private supprimer(cle: string): void {
    if (!this.isBrowser) return;
    try { localStorage.removeItem(cle); } catch { /* stockage indisponible */ }
  }
}
