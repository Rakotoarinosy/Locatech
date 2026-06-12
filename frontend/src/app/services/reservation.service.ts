import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { Reservation } from '../models/reservation.models';

export interface ReservationStats {
  total: number;
  par_statut: { [key: string]: number };
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private base = `${environment.apiUrl}/reservations/reservations/`;
  private pendingCountSubject = new BehaviorSubject<number>(0);
  pendingCount$ = this.pendingCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getToken(): string {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_t') || 
             localStorage.getItem('access_token') || '';
    }
    return '';
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  getAll(params?: { statut?: string; client?: number; materiel?: number; search?: string }): Observable<Reservation[]> {
    let p = new HttpParams();
    if (params?.statut)   p = p.set('statut',   params.statut);
    if (params?.client)   p = p.set('client',   String(params.client));
    if (params?.materiel) p = p.set('materiel', String(params.materiel));
    if (params?.search)   p = p.set('search',   params.search);
    return this.http.get<Reservation[]>(`${this.base}/`, { params: p });
  }

  getRecentes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/`, { headers: this.headers() });
  }

  getStats(): Observable<any> {
    return this.http.get(`${this.base}/stats/`, { headers: this.headers() });
  }

  getEnRetard(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/en-retard/`, { headers: this.headers() });
  }
      
  create(data: any): Observable<any> {
    return this.http.post(`${this.base}/`, data, { headers: this.headers() }).pipe(
      tap(() => this.refreshPendingCount())
    );
  } 

  // updateStatut(id: number, statut: string): Observable<any> {
  //   return this.http.patch(`${this.base}/${id}/statut/`, { statut }, { headers: this.headers() });
  // }

  update(id: number, data: Partial<Reservation>): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.base}/${id}/`, data).pipe(
      tap(() => this.refreshPendingCount()) // <-- Ajouté
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`).pipe(
      tap(() => this.refreshPendingCount()) // <-- Ajouté
    );
  }

terminerReservation(id: number) {
    return this.http.patch(
      `${environment.apiUrl}/reservations/${id}/statut/`,
      { statut: 'terminee' }
    ).pipe(
      tap(() => this.refreshPendingCount())
    );
  }

  confirmerReservation(id: number) {
    return this.http.patch(
      `${environment.apiUrl}/reservations/${id}/statut/`,
      { statut: 'confirmee' }
    ).pipe(
      tap(() => this.refreshPendingCount()) // <-- Ajouté
    );
  }

  annulerReservation(id: number) {
    return this.http.patch(
      `${environment.apiUrl}/reservations/${id}/statut/`,
      {
        statut: 'annulee'
      }
    ).pipe(
      tap(() => this.refreshPendingCount())
    );
  }

  updateStatut(id: number, statut: string) {
    return this.http.patch(
      `${this.base}/${id}/statut/`,
      { statut }
      ).pipe(
      tap(() => this.refreshPendingCount())
    );
    }

  refreshPendingCount() {
    // Ajout du slash final '/' pour correspondre aux routes Django standard
    this.http.get<any[]>(`${this.base}/`, { headers: this.headers() }).subscribe({
      next: (reservations) => {
        // Ajout du support pour 'En cours' avec une majuscule comme vu sur l'interface
        const count = reservations.filter(r => 
          r.statut === 'en cours' || 
          r.statut === 'en_cours' || 
          r.statut?.toLowerCase() === 'en cours'
        ).length;
        
        this.pendingCountSubject.next(count);
      },
      error: (err) => console.error('Erreur lors du calcul du badge sidebar', err)
    });
  }
}