import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecommendationIA } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FactureService {

  private apiUrl = `${environment.apiUrl}/factures/factures`;

  constructor(private http: HttpClient) {}

  getFactures() {
    return this.http.get<any[]>(this.apiUrl);
  }

  getFacture(id: number) {
    return this.http.get<any>(`${this.apiUrl}/${id}/`);
  }

  payer(id: number) {
    return this.http.patch(
      `${this.apiUrl}/${id}/payer/`,
      {}
    );
  }

  annuler(id: number) {
    return this.http.patch(
      `${this.apiUrl}/${id}/annuler/`,
      {}
    );
  }

  download(id: number) {
    return this.http.get(
      `${this.apiUrl}/${id}/download/`,
      {
        responseType: 'blob'
      }
    );
  }

  genererDevisIA(recommendation: RecommendationIA): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/devis-ia/`,
      recommendation,
      { responseType: 'blob' }
    );
  }
}
