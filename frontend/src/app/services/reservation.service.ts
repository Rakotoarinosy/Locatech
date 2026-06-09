import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
export interface Reservation {
  id?: number;
  client: number;
  materiel: number;
  date_debut: string;
  date_fin: string;
  quantite: number;
  prix_total?: number;
  statut?: string;
  notes?: string;
  created_at?: string;
  client_detail?: any;
  materiel_detail?: any;
}

export interface ReservationStats {
  total: number;
  par_statut: { [key: string]: number };
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private base = `${environment.apiUrl}/reservations/reservations`;

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
    return this.http.post(`${this.base}/`, data, { headers: this.headers() });
  }

  updateStatut(id: number, statut: string): Observable<any> {
    return this.http.patch(`${this.base}/${id}/statut/`, { statut }, { headers: this.headers() });
  }

  update(id: number, data: Partial<Reservation>): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.base}/${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }
}