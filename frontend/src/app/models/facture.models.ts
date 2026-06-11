export interface Facture {
  id: number;
  numero: string;
  montant: string;
  statut: string;
  pdf: string;
  created_at: string;

  reservation_detail: {
    client_detail: {
      nom: string;
      email: string;
      telephone: string;
    };

    materiel_detail: {
      nom: string;
      categorie: string;
    };

    date_debut: string;
    date_fin: string;
  };
}