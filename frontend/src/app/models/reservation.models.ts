export interface LigneReservation {
  id?: number;
  materiel: number;
  materiel_detail?: any;
  quantite: number;
  prix_unitaire: number;
  prix_total?: number;
}

export interface Reservation {
  id?: number;
  client: number | undefined;
  client_detail?: any;
  lignes: LigneReservation[];
  date_debut: string;
  date_fin: string;
  prix_total?: number;
  statut?: string;
  retard_jours?: number;
  notes?: string;
  created_at?: string;
  facture_id?: number;
  montant_recu?: number;
  mode_paiement?: string;
  date_paiement?: string;
}