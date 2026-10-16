import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Materiel } from '../models/materiel.model';

export interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

export interface ReservationB2CRequest {
  client_nom: string;
  client_email: string;
  client_telephone: string;
  date_debut: string;
  date_fin: string;
  notes: string;
  lignes: { materiel_id: number; quantite: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class LandingPageService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getCatalogue(): Observable<Materiel[]> {
    return this.http.get<Materiel[]>(`${this.apiUrl}/materiels/materiels/catalogue/`);
  }

  submitContact(request: ContactRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiUrl}/notifications/contact/`, request);
  }

  creerReservation(request: ReservationB2CRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiUrl}/reservations/reservations/b2c/`, request);
  }
}
