import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { RecommendationIA, Message } from '../models/interfaces';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/assistant/`;

  isUserLoggedIn(): boolean {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('access_token');
    }
    return false;
  }

  // Générer les headers d'authentification si le token est présent
  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        // Ajuste 'Bearer' si ton backend utilise 'Token' ou 'JWT'
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return headers;
  }

  // Demander une recommandation à l'IA avec Headers
  getRecommendation(prompt: string): Observable<RecommendationIA> {
    return this.http.post<RecommendationIA>(
      this.apiUrl, 
      { question: prompt }, 
      { headers: this.getAuthHeaders() }
    );
  }

  // Récupérer l'historique de discussion sauvegardé sur Django avec Headers
  getChatHistory(): Observable<Message[]> {
    if (!this.isUserLoggedIn()) {
      return of([]);
    }
    return this.http.get<Message[]>(
      `${this.apiUrl}history/`, 
      { headers: this.getAuthHeaders() }
    );
  }
}