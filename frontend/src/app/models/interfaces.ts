export interface MaterielRecommande {
  id: number;
  nom: string;
  categorie: string;
  quantite: number;
  prix_unitaire: number;
  prix_total: number;
  raison: string;
}

export interface RecommendationIA {
  resume: string;
  cout_total: number;
  materiels: MaterielRecommande[];
  conseils: string[];
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  recommendation?: RecommendationIA;
}