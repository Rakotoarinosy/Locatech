import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterielService } from '../../../services/materiel.service';
import { Materiel, MaterielStats } from '../../../models/materiel.model';
import { Categorie } from '../../../models/materiel.model';

@Component({
  selector: 'app-materiels',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './materiels.component.html',
  styleUrl: './materiels.component.scss'
})
export class MaterielsComponent implements OnInit {
  private materielService = inject(MaterielService);

  materiels: Materiel[] = [];
  categories: Categorie[] = [];
  stats?: MaterielStats;
  loading = false;

  // Filtres
  searchQuery = '';
  selectedStatut = '';
  selectedCategorie = '';

  // --- Gestion Formulaire / Modale ---
  isModalOpen = false;
  isEditMode = false;
  submitting = false;
  currentMaterielId: number | null = null;
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  // Objet calqué sur le modèle Django pour le Data Binding double-sens
  formModel: Partial<Materiel> = {
    nom: '',
    categorie_id: null,
    prix_journalier: 0,
    statut: 'disponible',
    description: '',
    quantite: 1
  };

  ngOnInit(): void {
    this.loadMateriels();
    this.loadStats();
    this.loadCategories();
  }

  loadMateriels(): void {
    this.loading = true;
    this.materielService.getMateriels({
      search: this.searchQuery,
      statut: this.selectedStatut,
      categorie: this.selectedCategorie
    }).subscribe({
      next: (data) => {
        this.materiels = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.materielService.getStats().subscribe({
      next: (data) => this.stats = data,
      error: (err) => console.error(err)
    });
  }

  loadCategories(): void {
    this.materielService.getCategories().subscribe({
      next: (data) => this.categories = data,
      error: (err) => console.error(err)
    });
  }

  onFiltersChange(): void {
    this.loadMateriels();
  }

  // --- Actions Modale ---
  openCreateModal(): void {
    this.isEditMode = false;
    this.currentMaterielId = null;
    this.selectedFile = null;
    this.imagePreview = null;
    this.formModel = {
      nom: '',
      categorie_id: null,
      prix_journalier: 0,
      statut: 'disponible',
      description: '',
      quantite: 1
    };
    this.isModalOpen = true;
  }

  openEditModal(materiel: Materiel): void {
    this.isEditMode = true;
    this.currentMaterielId = materiel.id;
    this.selectedFile = null;
    this.imagePreview = materiel.photo || null; // On garde l'image actuelle en aperçu
    this.formModel = { 
      ...materiel,
      categorie_id: materiel.categorie.id  
    };
    this.isModalOpen = true;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;

      // Génère un aperçu visuel dans la modale
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  onSubmit(): void {
    if (!this.formModel.nom || !this.formModel.categorie || this.formModel.prix_journalier! <= 0) {
      alert('Veuillez remplir correctement les champs obligatoires.');
      return;
    }

    this.submitting = true;

    if (this.isEditMode && this.currentMaterielId !== null) {
      this.materielService.updateMateriel(this.currentMaterielId, this.formModel, this.selectedFile).subscribe({
        next: () => {
          this.closeModal();
          this.loadMateriels();
          this.loadStats();
          this.submitting = false;
        },
        error: (err) => {
          console.error(err);
          this.submitting = false;
        }
      });
    } else {
      this.materielService.createMateriel(this.formModel, this.selectedFile).subscribe({
        next: () => {
          this.closeModal();
          this.loadMateriels();
          this.loadStats();
          this.submitting = false;
        },
        error: (err) => {
          console.error(err);
          this.submitting = false;
        }
      });
    }
  }
}