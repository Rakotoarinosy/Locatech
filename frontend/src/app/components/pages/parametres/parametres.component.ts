// parametres.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterielService } from '../../../services/materiel.service';
import { Categorie } from '../../../models/materiel.model';

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametres.component.html',
  styleUrl: './parametres.component.scss'
})
export class ParametresComponent implements OnInit {
  private materielService = inject(MaterielService);

  categories: Categorie[] = [];
  loading = false;
  submitting = false;

  // Formulaire inline
  newCategorieName = '';
  editingId: number | null = null;
  editingName = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.materielService.getCategories().subscribe({
      next: (data) => { this.categories = data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  addCategorie(): void {
    const nom = this.newCategorieName.trim();
    if (!nom) return;
    this.submitting = true;
    this.materielService.createCategorie(nom).subscribe({
      next: () => { this.newCategorieName = ''; this.loadCategories(); this.submitting = false; },
      error: () => this.submitting = false
    });
  }

  startEdit(cat: Categorie): void {
    this.editingId = cat.id;
    this.editingName = cat.nom;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editingName.trim()) return;
    this.materielService.updateCategorie(this.editingId, this.editingName.trim()).subscribe({
      next: () => { this.editingId = null; this.loadCategories(); }
    });
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  deleteCategorie(cat: Categorie): void {
    if (!confirm(`Supprimer la catégorie "${cat.nom}" ?`)) return;
    this.materielService.deleteCategorie(cat.id).subscribe({
      next: () => this.loadCategories(),
      error: (err) => alert('Impossible de supprimer : cette catégorie est peut-être utilisée par des matériels.')
    });
  }
}