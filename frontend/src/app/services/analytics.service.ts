import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private base = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getToken(): string {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token') || '';
    }
    return '';
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.base}/analytics/dashboard/`, { headers: this.headers() });
  }

  getRevenusParMois(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/analytics/revenus-par-mois/`, { headers: this.headers() });
  }

  getTopClients(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/analytics/top-clients/`, { headers: this.headers() });
  }

  getMaterielsStats(): Observable<any> {
    return this.http.get(`${this.base}/analytics/materiels/`, { headers: this.headers() });
  }

  // Transforme l'objet materiels en tableau pour le dashboard
  getTopMateriels(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/analytics/top-materiels/`);
  }
}
