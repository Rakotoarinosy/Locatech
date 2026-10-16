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
}
