import { Component, OnInit, signal, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, style, transition, animate, query, stagger } from '@angular/animations';
import { AssistantService } from '../../../services/assistant.service';
import { Message, RecommendationIA } from '../../../models/interfaces';
import { LigneB2C } from '../../../models/ligne.models';
import { Router } from '@angular/router';
import { NavbarComponent } from "../../layout/navbar/navbar.component";
import { ReservationService } from '../../../services/reservation.service';
import { FactureService } from '../../../services/facture.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
  animations: [
    trigger('messageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerCards', [
      transition(':enter', [
        query('.animate-card', [
          style({ opacity: 0, transform: 'scale(0.95)' }),
          stagger(80, [
            animate('250ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class AssistantComponent implements OnInit, AfterViewChecked {
  private assistantService = inject(AssistantService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Signals d'état de l'application
  messages = signal<Message[]>([]);
  userInput = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  isConnected = signal<boolean>(false);

    // Ajouter ces signals/propriétés
  showReservationForm = signal<boolean>(false);
  currentRecommendation = signal<RecommendationIA | null>(null);

  private shouldScroll = false;
  isPublicView: boolean = false;

  lignesB2C: LigneB2C[] = [];

  private reservationService = inject(ReservationService);
  private factureService = inject(FactureService);
  today = new Date().toISOString().split('T')[0];

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.isPublicView = !this.router.url.includes('back-office');
    // 1. Vérifier le statut de connexion
    const loggedIn = this.assistantService.isUserLoggedIn();
    this.isConnected.set(loggedIn);

    // 2. Charger l'historique ou mettre le message de bienvenue
    if (loggedIn) {
      this.isLoading.set(true);
      this.assistantService.getChatHistory().subscribe({
        next: (history) => {
          this.isLoading.set(false);
          if (history && history.length > 0) {
            this.messages.set(history);
          } else {
            this.initWelcomeMessage();
          }
          this.shouldScroll = true;
        },
        error: (err) => {
          this.isLoading.set(false);
          this.initWelcomeMessage();
          console.error("Impossible de récupérer l'historique", err);
        }
      });
    } else {
      this.initWelcomeMessage();
    }
  }

  private initWelcomeMessage(): void {
    this.messages.set([
      {
        id: 'init',
        sender: 'ai',
        text: "Bonjour ! Je suis votre assistant LocaTech. Décrivez-moi votre événement (type, nombre d'invités, lieu, ambiance souhaitée...), et je m'occupe de planifier et chiffrer tout le matériel nécessaire pour vous.",
        timestamp: new Date()
      }
    ]);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const element = this.scrollContainer.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      });
    } catch (err) {}
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const prompt = this.userInput().trim();
    if (!prompt || this.isLoading()) return;

    this.errorMessage.set(null);
    
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: prompt,
      timestamp: new Date()
    };
    
    this.messages.update(prev => [...prev, userMsg]);
    this.userInput.set('');
    this.isLoading.set(true);
    this.shouldScroll = true;

    this.assistantService.getRecommendation(prompt).subscribe({
      next: (data: RecommendationIA) => {
        const aiMsg: Message = {
          id: Math.random().toString(),
          sender: 'ai',
          text: data.resume,
          timestamp: new Date(),
          recommendation: data
        };
        this.messages.update(prev => [...prev, aiMsg]);
        this.isLoading.set(false);
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error(err);
        this.errorMessage.set("Une erreur est survenue lors de la génération des recommandations. Veuillez réessayer.");
        this.isLoading.set(false);
        this.shouldScroll = true;
      }
    });
  }

  reservationForm = {
    client_nom: '',
    client_email: '',
    client_telephone: '',
    materiel_id: 0,
    materiel_nom: '',
    date_debut: '',
    date_fin: '',
    quantite: 1
  };

  reservationSubmitting = signal<boolean>(false);
  reservationSuccess = signal<boolean>(false);

  openReservationForm(recommendation: RecommendationIA): void {
    this.currentRecommendation.set(recommendation);
    this.lignesB2C = recommendation.materiels.map(m => ({
      id: m.id,
      nom: m.nom,
      categorie: m.categorie,
      prix_unitaire: m.prix_unitaire,
      quantite: m.quantite
    }));
    this.reservationForm = {
      client_nom: '', client_email: '', client_telephone: '',
      materiel_id: 0, materiel_nom: '',
      date_debut: '', date_fin: '', quantite: 1
    };
    this.dureeB2C = 0;           // ← reset
    this.reservationSuccess.set(false);
    this.showReservationForm.set(true);
    // bloquer le scroll du body
    document.body.style.overflow = 'hidden';
  }

  // ── Ajouter supprimerLigneB2C() ──────────────────────────────────
  supprimerLigneB2C(i: number): void {
    if (this.lignesB2C.length > 1) {
      this.lignesB2C.splice(i, 1);
    }
  }

  // ── Remplacer submitReservationB2C() ─────────────────────────────
  submitReservationB2C(): void {
    const f = this.reservationForm;
    if (!f.client_nom || !f.client_email || !f.date_debut || !f.date_fin) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (this.lignesB2C.length === 0) {
      alert('Au moins un matériel est requis.');
      return;
    }

    this.reservationSubmitting.set(true);

    // Utiliser l'endpoint B2C multi-matériels
    const payload = {
      client_nom:       f.client_nom,
      client_email:     f.client_email,
      client_telephone: f.client_telephone,
      date_debut:       f.date_debut,
      date_fin:         f.date_fin,
      lignes: this.lignesB2C.map(l => ({
        materiel_id: l.id,
        quantite:    l.quantite
      }))
    };

    this.http.post(`${environment.apiUrl}/reservations/reservations/b2c/`, payload).subscribe({
      next: () => {
        this.reservationSubmitting.set(false);
        this.reservationSuccess.set(true);
        setTimeout(() => {
          this.showReservationForm.set(false);
          this.reservationSuccess.set(false);
        }, 3000);
      },
      error: (err) => {
        this.reservationSubmitting.set(false);
        alert(err.error?.error ?? err.error?.detail ?? 'Erreur lors de la création.');
      }
    });
  }

  creerReservation(recommendation: RecommendationIA): void {
    if (!recommendation.materiels || recommendation.materiels.length === 0) {
      alert('Aucun matériel dans la recommandation.');
      return;
    }

    if (!this.isPublicView) {
      // Flux B2B → back-office réservations
      const premierMateriel = recommendation.materiels[0];
      this.router.navigate(['/back-office/reservations'], {
        queryParams: {
          from_ai: true,
          materiel_id: premierMateriel.id,
          materiel_nom: premierMateriel.nom,
          quantite: premierMateriel.quantite
        }
      });
    } else {
      // Flux B2C → ouvrir le formulaire inline
      this.openReservationForm(recommendation);
    }
  }

  telechargerDevis(recommendation: RecommendationIA): void {
    this.factureService.genererDevisIA(recommendation).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devis-locatech-${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Erreur génération devis PDF', err)
    });
  }

  private buildDevisContent(r: RecommendationIA): string {
    const lines: string[] = [
      '============================',
      '   DEVIS — LocaTech Madagascar',
      '============================',
      '',
      r.resume,
      '',
      'MATÉRIELS RECOMMANDÉS :',
      '------------------------',
    ];

    r.materiels.forEach(m => {
      lines.push(`- ${m.nom} (${m.categorie}) x${m.quantite} — ${this.formatPrix(m.prix_total)}`);
    });

    lines.push('');
    lines.push(`COÛT TOTAL ESTIMÉ : ${this.formatPrix(r.cout_total)}`);
    lines.push('');
    lines.push('CONSEILS :');
    r.conseils?.forEach(c => lines.push(`• ${c}`));
    lines.push('');
    lines.push('---');
    lines.push('LocaTech Madagascar — locatech-mada.rakotoarinosy.com');

    return lines.join('\n');
  }

  nouvelleDemande(): void {
    this.initWelcomeMessage();
    this.errorMessage.set(null);
  }

  formatPrix(valeur: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA', minimumFractionDigits: 0 }).format(valeur).replace('MGA', 'Ar');
  }

  // Ajouter ces propriétés
  dureeB2C = 0;

  calculerDureeB2C(): void {
    const d1 = this.reservationForm.date_debut;
    const d2 = this.reservationForm.date_fin;
    if (d1 && d2) {
      this.dureeB2C = Math.ceil(
        Math.abs(new Date(d2).getTime() - new Date(d1).getTime()) / 86400000
      ) || 1;
    } else {
      this.dureeB2C = 0;
    }
  }

  totalEstimeB2C(): number {
    const duree = this.dureeB2C || 1;

    return this.lignesB2C.reduce((sum, l) => {
      return sum + (l.prix_unitaire * l.quantite * duree);
    }, 0);
  }

  // Modifier openReservationForm() — ajouter reset de dureeB2C

  closeReservationForm(): void {
    this.showReservationForm.set(false);
    this.currentRecommendation.set(null);
    document.body.style.overflow = ''; // ← débloquer
  }
}