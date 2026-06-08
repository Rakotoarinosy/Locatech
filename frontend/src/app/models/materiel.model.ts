export interface Materiel {
  id: number;
  nom: string;
  categorie: string;
  prix_journalier: number;
  statut: 'disponible' | 'reserve' | 'loue' | 'maintenance' | 'casse';
  photo?: string | null;
  description?: string;
  quantite: number;
  created_at: string;
}

export interface MaterielStats {
  total: number;
  par_statut: {
    disponible: number;
    reserve: number;
    loue: number;
    maintenance: number;
    casse: number;
  };
}