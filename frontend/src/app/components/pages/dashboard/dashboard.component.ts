import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  today = new Date();

  stats = [
    {
      label: 'Matériels disponibles',
      value: '24',
      trend: '+3 ce mois',
      trendUp: true,
      icon: 'construction',
      colorClass: 'icon-blue'
    },
    {
      label: 'Locations actives',
      value: '12',
      trend: '+5 cette semaine',
      trendUp: true,
      icon: 'event_available',
      colorClass: 'icon-green'
    },
    {
      label: 'Revenus du mois',
      value: '4 820 Ariary',
      trend: '+12% vs mois dernier',
      trendUp: true,
      icon: 'payments',
      colorClass: 'icon-green'
    },
    {
      label: 'Retards en cours',
      value: '2',
      trend: 'Pénalités actives',
      trendUp: false,
      icon: 'warning_amber',
      colorClass: 'icon-red'
    }
  ];

  reservationsRecentes = [
    { initiales: 'JR', nom: 'Jean Rakoto', materiel: 'Perceuse Bosch', duree: '3j', statut: 'active', statusLabel: 'Actif', color: 'blue' },
    { initiales: 'MR', nom: 'Marie Rabe', materiel: 'Groupe électrogène', duree: '7j', statut: 'pending', statusLabel: 'En attente', color: 'green' },
    { initiales: 'TS', nom: 'Tahiry Solo', materiel: 'Échafaudage', duree: '5j', statut: 'late', statusLabel: 'Retard', color: 'red' },
    { initiales: 'HA', nom: 'Hery Andry', materiel: 'Vidéoprojecteur', duree: '2j', statut: 'active', statusLabel: 'Actif', color: 'blue' },
  ];

  topMateriels = [
    { nom: 'Perceuse Bosch', count: 17, pct: 85 },
    { nom: 'Groupe électrogène', count: 13, pct: 65 },
    { nom: 'Échafaudage', count: 10, pct: 50 },
    { nom: 'Vidéoprojecteur', count: 6, pct: 30 },
    { nom: 'Compresseur', count: 4, pct: 20 },
  ];

  activitesRecentes = [
    { icon: 'add_circle', text: 'Nouvelle réservation créée pour Jean Rakoto', time: 'Il y a 10 min', color: 'blue' },
    { icon: 'warning', text: 'Retard détecté — Tahiry Solo (Échafaudage)', time: 'Il y a 45 min', color: 'red' },
    { icon: 'receipt_long', text: 'Facture #0042 générée pour Marie Rabe', time: 'Il y a 2h', color: 'green' },
    { icon: 'build', text: 'Perceuse Bosch mise en maintenance', time: 'Hier', color: 'amber' },
    { icon: 'person_add', text: 'Nouveau client enregistré : Hery Andry', time: 'Hier', color: 'blue' },
  ];
}