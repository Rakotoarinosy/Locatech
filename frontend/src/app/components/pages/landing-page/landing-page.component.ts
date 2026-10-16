import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../layout/navbar/navbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { Materiel } from '../../../models/materiel.model';
import { LandingPageService } from '../../../services/landing-page.service';
import { PanierService } from '../../../services/panier.service';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  stock: number;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar: string;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit {
  private landingPageService = inject(LandingPageService);
  readonly panier = inject(PanierService);
  products: Product[] = [];
  productsLoading = false;
  productsError = '';
  contactSubmitting = false;
  contactSuccess = '';
  contactError = '';

  features: Feature[] = [
    { icon: 'bi-calendar-check', title: 'Réservation intelligente', description: 'Algorithme d\'optimisation des stocks en temps réel pour éviter les surréservations.' },
    { icon: 'bi-layer-backward', title: 'Gestion des disponibilités', description: 'Un calendrier dynamique ultra-précis pour suivre chaque équipement à la trace.' },
    { icon: 'bi-file-earmark-pdf', title: 'Facturation automatique PDF', description: 'Générez et envoyez vos devis, factures et bons de livraison en un seul clic.' },
    { icon: 'bi-graph-up-arrow', title: 'Dashboard analytique', description: 'Suivez vos performances, vos revenus et identifiez vos matériels les plus rentables.' },
    { icon: 'bi-bell', title: 'Notifications automatiques', description: 'Rappels SMS et emails automatisés pour les retours de matériels et les paiements.' },
    { icon: 'bi-people', title: 'Gestion clients (CRM)', description: 'Historique complet des locations et fiches clients centralisées pour un suivi premium.' }
  ];

  testimonials: Testimonial[] = [
    { quote: "LocaTech a littéralement transformé notre logistique. Nous gérons 4 fois plus d'événements qu'avant avec zéro erreur de stock.", author: "Rindra Rakotomalala", role: "Directeur", company: "Mada Events", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" },
    { quote: "L'interface est d'une fluidité incroyable. Nos clients adorent recevoir leurs factures PDF instantanément par email.", author: "Sitraka Andrianarivo", role: "Responsable Logistique", company: "Hôtel du Louvre", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80" },
    { quote: "Un outil SaaS moderne indispensable pour tous les loueurs de matériel à Madagascar. Le support est top !", author: "Fara Ranaivoson", role: "Fondatrice", company: "Sweet Wedding", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80" }
  ];

  contactForm = { name: '', email: '', message: '' };

  get categoryCount(): number {
    return new Set(this.products.map((product) => product.category)).size;
  }

  ngOnInit(): void {
    this.loadCatalogue();
  }

  loadCatalogue(): void {
    this.productsLoading = true;
    this.productsError = '';
    this.landingPageService.getCatalogue().subscribe({
      next: (materiels) => {
        this.products = materiels.map((materiel: Materiel) => ({
          id: materiel.id,
          name: materiel.nom,
          category: materiel.categorie.nom,
          price: Number(materiel.prix_journalier),
          image: materiel.photo ?? '',
          stock: Number(materiel.quantite) || 0,
        }));
        this.productsLoading = false;
      },
      error: () => {
        this.productsError = 'Le catalogue est momentanément indisponible. Réessayez dans quelques instants.';
        this.productsLoading = false;
      }
    });
  }

  ajouterAuPanier(p: Product): void {
    this.panier.ajouter({ id: p.id, nom: p.name, categorie: p.category, prix: p.price, photo: p.image, stock: p.stock });
  }

  onSubmitContact(): void {
    if (this.contactSubmitting) {
      return;
    }

    this.contactSubmitting = true;
    this.contactSuccess = '';
    this.contactError = '';
    this.landingPageService.submitContact(this.contactForm).subscribe({
      next: () => {
        this.contactSuccess = 'Merci ! Votre demande a bien été envoyée. Notre équipe vous recontactera.';
        this.contactForm = { name: '', email: '', message: '' };
        this.contactSubmitting = false;
      },
      error: () => {
        this.contactError = 'Votre demande n’a pas pu être envoyée. Réessayez ou contactez-nous par téléphone.';
        this.contactSubmitting = false;
      }
    });
  }
}