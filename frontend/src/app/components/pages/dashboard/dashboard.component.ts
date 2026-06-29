import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';
import { interval, Subscription, forkJoin } from 'rxjs';
import { ReservationService } from '../../../services/reservation.service';
import { AnalyticsStore } from '../../../stores/analytics.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  today = new Date();
  loading = true;
  private refreshSub?: Subscription;

  stats = [
    { label: 'Matériels disponibles', value: '—', trend: '', trendUp: true,  icon: 'construction',    colorClass: 'icon-blue'  },
    { label: 'Locations actives',     value: '—', trend: '', trendUp: true,  icon: 'event_available', colorClass: 'icon-green' },
    { label: 'Revenus du mois',       value: '—', trend: '', trendUp: true,  icon: 'payments',        colorClass: 'icon-green' },
    { label: 'Retards en cours',      value: '—', trend: '', trendUp: false, icon: 'warning_amber',   colorClass: 'icon-red'   },
  ];

  reservationsRecentes: any[] = [];
  topClients: any[] = [];
  topMateriels: any[] = [];
  activitesRecentes: any[] = [];

  constructor(
    public analyticsStore: AnalyticsStore
  ) {
    effect(()=> {
      const dashboard = this.analyticsStore.dashboardStats();
      if(dashboard){
        this.applyDashboardStats(dashboard);
      }
    });
    effect(() => {
      const reservations = this.analyticsStore.reservationsRecentes();
      if (reservations){
        this.applyReservations(reservations);
      }
    });
    effect(() => {
      this.topMateriels = this.analyticsStore.topMateriels();
    });
  }

  ngOnInit(): void {
    this.analyticsStore.loadAll();
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private applyDashboardStats(d: any): void {
    this.stats[0].value = String(d.materiels_disponibles);
    this.stats[0].trend = `${d.taux_disponibilite}% de disponibilité`;
    this.stats[1].value = String(d.reservations_actives);
    this.stats[1].trend = `${d.total_clients} clients enregistrés`;
    const revenus = Number(d.revenus_mois_courant).toLocaleString('fr-MG');
    this.stats[2].value = `${revenus} Ar`;
    this.stats[2].trend = `Total : ${Number(d.revenus_total).toLocaleString('fr-MG')} Ar`;
    this.stats[3].value = String(d.reservations_en_retard);
    this.stats[3].trend = d.reservations_en_retard > 0 ? 'Pénalités actives' : 'Aucun retard';
    this.stats[3].trendUp   = d.reservations_en_retard === 0;
    this.stats[3].colorClass = d.reservations_en_retard > 0 ? 'icon-red' : 'icon-green';
  }

  private applyReservations(reservations: any[]): void {
    const statutMap: any = {
      'en cours':  { label: 'Actif',    statut: 'active',  color: 'blue'  },
      'confirmee': { label: 'Confirmé', statut: 'active',  color: 'green' },
      'terminee':  { label: 'Terminé',  statut: 'done',    color: 'grey'  },
      'annulee':   { label: 'Annulé',   statut: 'pending', color: 'red'   },
    };
    this.reservationsRecentes = reservations.slice(0, 5).map(r => {
      const s = statutMap[r.statut] || { label: r.statut, statut: 'pending', color: 'blue' };
      const nom = r.client_detail?.nom || `Client #${r.client}`;
      const initiales = nom.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

      let labelMateriel = 'Matériel inconnu';

      // On récupère le tableau de lignes, peu importe son nom (lignes, items, ou materiels)
      const lignes = r.lignes || r.items || r.lignes_reservation || r.materiels;

      if (lignes && lignes.length > 0) {
        // 1. On prend la première ligne de réservation
        const premiereLigne = lignes[0];
        
        // 2. On extrait le nom (il peut être dans materiel_detail.nom ou directement nom)
        const nomPremier = premiereLigne.materiel_detail?.nom || 
                          premiereLigne.materiel?.nom || 
                          premiereLigne.nom || 
                          'Matériel';
        
        // 3. On applique la règle d'affichage (+ n)
        if (lignes.length > 1) {
          labelMateriel = `${nomPremier} +${lignes.length - 1}`;
        } else {
          labelMateriel = nomPremier;
        }
      } else if (r.materiel_detail?.nom) {
        // Sécurité fallback si l'objet est plat
        labelMateriel = r.materiel_detail.nom;
      }
      // -------------------------------------------

      return {
        initiales,
        nom,
        materiel: labelMateriel, // On utilise notre variable calculée ici
        duree: `${this.nbJours(r.date_debut, r.date_fin)}j`,
        statut: s.statut,
        statusLabel: s.label,
        color: s.color,
      };
    });
    this.activitesRecentes = reservations.slice(0, 5).map(r => ({
      icon:  r.statut === 'terminee' ? 'check_circle' : r.statut === 'annulee' ? 'cancel' : 'event_available',
      text:  `Réservation ${r.statut} — ${r.client_detail?.nom || 'Client #' + r.client}`,
      time:  this.timeAgo(r.date_debut),
      color: r.statut === 'terminee' ? 'green' : r.statut === 'annulee' ? 'red' : 'blue',
    }));
  }

  private nbJours(debut: string, fin: string): number {
    return Math.max(1, Math.round(
      (new Date(fin).getTime() - new Date(debut).getTime()) / 86400000
    ));
  }

  private timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Il y a moins d'1h";
    if (h < 24) return `Il y a ${h}h`;
    return `Il y a ${Math.floor(h / 24)}j`;
  }
}
