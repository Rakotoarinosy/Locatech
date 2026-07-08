export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  statut: string;

  client: {
    id: number;
    nom: string;
    email: string;
  };

  materiels: {
    id: number;
    nom: string;
    quantite: number;
  }[];
}