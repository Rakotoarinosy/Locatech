import { Injectable, computed, signal } from '@angular/core';

export interface PanierProduit {
  id: number;
  nom: string;
  categorie: string;
  prix: number;
  photo: string;
  stock: number;
}

export interface PanierLigne {
  produit: PanierProduit;
  quantite: number;
}

const PANIER_STORAGE_KEY = 'locatech.panier';

@Injectable({
  providedIn: 'root'
})
export class PanierService {
  private readonly _lignes = signal<PanierLigne[]>(this.lire());

  readonly lignes = this._lignes.asReadonly();
  readonly ouvert = signal(false);
  /** Dernier matériel ajouté, pour le toast de confirmation. */
  readonly dernierAjout = signal<string | null>(null);

  /** Nombre de matériels distincts dans le panier. */
  readonly nombre = computed(() => this._lignes().length);
  /** Total pour une journée de location. */
  readonly totalJournalier = computed(() =>
    this._lignes().reduce((total, l) => total + l.produit.prix * l.quantite, 0)
  );

  private toastTimer?: ReturnType<typeof setTimeout>;

  ajouter(produit: PanierProduit): void {
    const lignes = this._lignes();
    const index = lignes.findIndex((l) => l.produit.id === produit.id);
    if (index === -1) {
      this.enregistrer([...lignes, { produit, quantite: 1 }]);
    } else {
      this.changerQuantite(index, 1);
    }

    this.dernierAjout.set(produit.nom);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.dernierAjout.set(null), 2500);
  }

  changerQuantite(index: number, delta: number): void {
    const lignes = [...this._lignes()];
    const ligne = lignes[index];
    if (!ligne) {
      return;
    }
    const quantite = ligne.quantite + delta;
    if (quantite <= 0) {
      lignes.splice(index, 1);
    } else {
      lignes[index] = { ...ligne, quantite: Math.min(quantite, ligne.produit.stock || quantite) };
    }
    this.enregistrer(lignes);
  }

  retirer(index: number): void {
    this.enregistrer(this._lignes().filter((_, i) => i !== index));
  }

  vider(): void {
    this.enregistrer([]);
  }

  private enregistrer(lignes: PanierLigne[]): void {
    this._lignes.set(lignes);
    try {
      if (lignes.length) {
        sessionStorage.setItem(PANIER_STORAGE_KEY, JSON.stringify(lignes));
      } else {
        sessionStorage.removeItem(PANIER_STORAGE_KEY);
      }
    } catch {
      // Stockage indisponible (navigation privée…) : le panier reste en mémoire
    }
  }

  private lire(): PanierLigne[] {
    try {
      const brut = JSON.parse(sessionStorage.getItem(PANIER_STORAGE_KEY) ?? '[]');
      return Array.isArray(brut)
        ? brut.filter((l) => l?.produit?.id && Number(l.quantite) > 0)
        : [];
    } catch {
      return [];
    }
  }
}
