import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../layout/navbar/navbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
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
  products: Product[] = [
    { id: 1, name: 'Pack Verrerie Cristal', category: 'Arts de la table', price: 45000, image: 'https://images.unsplash.com/photo-1574926053821-79c5e338a933?auto=format&fit=crop&w=600&q=80' },
    { id: 2, name: 'Chaise Napoléon Transparente', category: 'Mobilier', price: 15000, image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=80' },
    { id: 3, name: 'Table Banquet Ronde', category: 'Mobilier', price: 35000, image: 'https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=600&q=80' },
    { id: 4, name: 'Nappe Lin Premium', category: 'Linge de table', price: 12000, image: 'https://images.unsplash.com/photo-1620735565314-b1cb027fa1bd?auto=format&fit=crop&w=600&q=80' },
    { id: 5, name: 'Tente Événementielle Cristal 10x15m', category: 'Structures', price: 1200000, image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80' },
    { id: 6, name: 'Système Sonorisation Line Array', category: 'Audiovisuel', price: 450000, image: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=600&q=80' },
    { id: 7, name: 'Vidéoprojecteur Laser 4K', category: 'Audiovisuel', price: 150000, image: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=600&q=80' },
    { id: 8, name: 'Pack MacBook Pro & Bornes Wi-Fi', category: 'Informatique', price: 250000, image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80' }
  ];

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

  constructor() {}

  ngOnInit(): void {}

  onSubmitContact() {
    console.log('Formulaire envoyé :', this.contactForm);
    alert('Merci ! Votre message a bien été envoyé.');
    this.contactForm = { name: '', email: '', message: '' };
  }
}