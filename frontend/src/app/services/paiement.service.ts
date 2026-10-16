import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export type ModePaiement = 'especes' | 'carte';

export interface PaiementConfig {
  especes: boolean;
  carte: boolean;
}

export interface StatutPaiement {
  reservation: number;
  date_debut: string;
  date_fin: string;
  statut: string;
  statut_label: string;
  montant: number;
  lignes: { nom: string; quantite: number }[];
  mode_paiement: string | null;
  mode_paiement_label: string;
  payee: boolean;
  paiement_carte: 'pending' | 'success' | 'failed' | 'cancelled' | null;
  peut_payer_carte: boolean;
  facture: { numero: string; url_pdf: string } | null;
}

/** Paiement des réservations (espèces ou carte via la passerelle ecommerce_monitoring). */
@Injectable({ providedIn: 'root' })
export class PaiementService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/paiements`;
  private config$?: Observable<PaiementConfig>;

  config(): Observable<PaiementConfig> {
    this.config$ ??= this.http.get<PaiementConfig>(`${this.base}/config/`).pipe(shareReplay(1));
    return this.config$;
  }

  statut(jeton: string): Observable<StatutPaiement> {
    return this.http.get<StatutPaiement>(`${this.base}/statut/`, { params: { jeton } });
  }

  /** Crée une session de paiement par carte et renvoie l'URL de la page de paiement de la passerelle. */
  payerCarte(jeton: string): Observable<{ checkout_url: string }> {
    return this.http.post<{ checkout_url: string }>(`${this.base}/carte/`, { jeton });
  }

  /** Le client renonce à la carte : règlement en espèces au retrait ou à la livraison. */
  payerEspeces(jeton: string): Observable<StatutPaiement> {
    return this.http.post<StatutPaiement>(`${this.base}/especes/`, { jeton });
  }

  /** Quitte le site pour la page de paiement sécurisée (Stripe ou simulateur de la passerelle). */
  redirigerVers(url: string): void {
    window.location.assign(url);
  }
}
