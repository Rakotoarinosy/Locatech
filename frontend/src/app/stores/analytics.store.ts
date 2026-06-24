import { Injectable, signal } from '@angular/core';
import { AnalyticsService } from '../services/analytics.service';
import { ReservationService } from '../services/reservation.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsStore {

  dashboardStats = signal<any>(null);
  materielsStats = signal<any>(null);
  topClients = signal<any[]>([]);
  topMateriels = signal<any[]>([]);
  revenusParMois = signal<any[]>([]);
  reservationsRecentes = signal<any[]>([]);
  error = signal<string | null>(null);

  loading = signal(false);

  constructor(
    private analyticsService: AnalyticsService,
    private reservationService: ReservationService
  ) {}

  loadDashboardStats() {

    if (this.dashboardStats()) {
      return;
    }

    this.loading.set(true);

    this.analyticsService
      .getDashboardStats()
      .subscribe({
        next: (data) => {
          this.dashboardStats.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  loadMateriels() {
    if (this.materielsStats()) {
        return;
    }
    this.analyticsService
        .getMaterielsStats()
        .subscribe(data => {
            this.materielsStats.set(data);
        });
  }

  loadTopClients() {
    if (this.topClients().length  > 0) {
        return;
    }
    this.analyticsService
        .getTopClients()
        .subscribe(data => {
            this.topClients.set(data);
        });
  }

  loadTopMateriels(){
    if (this.topMateriels().length > 0) {
        return;
    }
    this.analyticsService
        .getTopMateriels()
        .subscribe(data => {
            this.topMateriels.set(data);
        });
  }

  refreshDashboardStats() {

    this.loading.set(true);

    this.analyticsService
      .getDashboardStats()
      .subscribe({
        next: (data) => {
          this.dashboardStats.set(data);
          this.loading.set(false);
        }
      });
  }

  loadReservationsRecentes() {

    if (this.reservationsRecentes().length > 0) {
        return;
    }

    this.reservationService
        .getRecentes()
        .subscribe(data => {
        this.reservationsRecentes.set(data);
        });
    }

  refreshReservationsRecentes() {
    this.reservationsRecentes.set([]);

    this.reservationService
      .getRecentes()
      .subscribe(data => {
        this.reservationsRecentes.set(data);
      });
  }

  refresh() {

    this.refreshDashboardStats();
    this.refreshReservationsRecentes();

    this.analyticsService
      .getTopMateriels()
      .subscribe(data => {
        this.topMateriels.set(data);
      });

    this.analyticsService
      .getTopClients()
      .subscribe(data => {
        this.topClients.set(data);
      });
  }

  loadAll() {
    this.loadDashboardStats();
    this.loadTopClients();
    this.loadTopMateriels();
    this.loadMateriels();
    this.loadReservationsRecentes();
  }

}