import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService, Client } from '../../../services/client.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements OnInit {

  clients: Client[] = [];
  reservationsParClient: { [clientId: number]: number } = {};
  showModal = false;
  isEditMode = false; // Permet de savoir si on modifie ou si on crée
  newClient: Client = this.initNewClient();

  constructor(private clientService: ClientService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadClients();
    this.loadReservationsCount();
  }

  loadClients(): void {
    this.clientService.getClients().subscribe({
      next: (data) => {
        this.clients = data;
        console.log('Clients chargés :', data);
      },
      error: (err) => {
        console.error('Erreur chargement clients', err);
      }
    });
  }

  initNewClient(): Client {
    return {
      nom: '',
      type_client: 'particulier',
      email: '',
      telephone: '',
      adresse: '',
      status: 'actif'
    };
  }

  get totalClients(): number {
    return this.clients.length;
  }

  get activeClients(): number {
    return this.clients.filter(client => client.status === 'actif').length;
  }

  getInitials(client: Client): string {
    if (!client.nom) return '--';
    return client.nom
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  openCreate(): void {
    this.newClient = this.initNewClient();
    this.isEditMode = false;
    this.showModal = true;
  }

  openEdit(client: Client): void {
    // On fait une copie indépendante du client sélectionné pour ne pas modifier la ligne du tableau en direct
    this.newClient = { ...client };
    this.isEditMode = true;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveClient(): void {
    if (!this.newClient.nom || !this.newClient.email) {
      return;
    }

    if (this.isEditMode && this.newClient.id) {
      // MODE UPDATE
      this.clientService.updateClient(this.newClient.id, this.newClient).subscribe({
        next: () => {
          this.loadClients();
          this.closeModal();
        },
        error: (err) => console.error('Erreur modification client', err)
      });
    } else {
      // MODE CREATE
      this.clientService.createClient(this.newClient).subscribe({
        next: () => {
          this.loadClients();
          this.closeModal();
        },
        error: (err) => console.error('Erreur création client', err)
      });
    }
  }

  onDelete(id?: number): void {
    if (!id) return;
    if (!confirm('Voulez-vous vraiment supprimer ce client ?')) return;

    this.clientService.deleteClient(id).subscribe({
      next: () => this.loadClients(),
      error: (err) => console.error('Erreur suppression client', err)
    });
  }

  loadReservationsCount(): void {
    this.http.get<any[]>(`${environment.apiUrl}/reservations/reservations/`).subscribe({
      next: (reservations) => {
        this.reservationsParClient = {};
        reservations.forEach(r => {
          const id = r.client;
          this.reservationsParClient[id] = (this.reservationsParClient[id] || 0) + 1;
        });
      },
      error: (err) => console.error('Erreur chargement réservations', err)
    });
  }

  get nouveauxClients(): number {
    const il7jours = new Date();
    il7jours.setDate(il7jours.getDate() - 7);
    return this.clients.filter(c => {
      if (!c.created_at) return false;
      return new Date(c.created_at) >= il7jours;
    }).length;
  }
}