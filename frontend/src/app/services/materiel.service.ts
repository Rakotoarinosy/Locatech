import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Materiel, MaterielStats } from '../models/materiel.model';

@Injectable({
  providedIn: 'root'
})
export class MaterielService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/materiels/materiels/`;

  getMateriels(filters?: { search?: string; statut?: string; categorie?: string }): Observable<Materiel[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.statut) params = params.set('statut', filters.statut);
      if (filters.categorie) params = params.set('categorie', filters.categorie);
    }
    return this.http.get<Materiel[]>(this.baseUrl, { params });
  }

  // Convertit un objet partiel ou complet en FormData pour Django
  private convertToFormData(materiel: Partial<Materiel>, file?: File | null): FormData {
    const formData = new FormData();
    
    // On ajoute tous les champs sauf l'ID et la photo existante si c'est une string URL
    Object.keys(materiel).forEach(key => {
      const value = (materiel as any)[key];
      if (key !== 'id' && key !== 'photo' && value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    // Si un nouveau fichier est sélectionné, on l'ajoute
    if (file) {
      formData.append('photo', file, file.name);
    }

    return formData;
  }

  createMateriel(materiel: Partial<Materiel>, file?: File | null): Observable<Materiel> {
    const data = this.convertToFormData(materiel, file);
    return this.http.post<Materiel>(this.baseUrl, data);
  }

  updateMateriel(id: number, materiel: Partial<Materiel>, file?: File | null): Observable<Materiel> {
    const data = this.convertToFormData(materiel, file);
    // Utilisation de PATCH au lieu de PUT pour ne pas écraser les champs omis (comme l'image existante)
    return this.http.patch<Materiel>(`${this.baseUrl}${id}/`, data);
  }

  updateStatut(id: number, statut: string): Observable<Materiel> {
    return this.http.patch<Materiel>(`${this.baseUrl}${id}/statut/`, { statut });
  }

  getStats(): Observable<MaterielStats> {
    return this.http.get<MaterielStats>(`${this.baseUrl}stats/`);
  }
}