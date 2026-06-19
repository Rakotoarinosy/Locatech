
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
  facture_id?: number | null;
  retard_jours?: number;
  mode_paiement: string;
}