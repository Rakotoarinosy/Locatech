import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

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

  getAll(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/`, { headers: this.headers(), params });
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
}
