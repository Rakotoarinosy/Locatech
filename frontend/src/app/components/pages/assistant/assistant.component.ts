import { Component, OnInit, signal, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, style, transition, animate, query, stagger } from '@angular/animations';
import { AssistantService } from '../../../services/assistant.service';
import { Message, RecommendationIA } from '../../../models/interfaces';
import { Router } from '@angular/router';
import { NavbarComponent } from "../../layout/navbar/navbar.component";

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

  private shouldScroll = false;
  isPublicView: boolean = false;

  constructor(private router: Router) {}

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

  creerReservation(recommendation: RecommendationIA): void {
    console.log("Action : Créer réservation cliquée", recommendation);
  }

  telechargerDevis(recommendation: RecommendationIA): void {
    console.log("Action : Télécharger devis cliqué", recommendation);
  }

  nouvelleDemande(): void {
    this.initWelcomeMessage();
    this.errorMessage.set(null);
  }

  formatPrix(valeur: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA', minimumFractionDigits: 0 }).format(valeur).replace('MGA', 'Ar');
  }
}