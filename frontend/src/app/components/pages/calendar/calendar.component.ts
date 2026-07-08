import { Component, OnInit } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ReservationService } from '../../../services/reservation.service';
import { CalendarEvent } from '../../../models/calendar.models';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FullCalendarModule, DatePipe, CommonModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent implements OnInit {
  selectedEvent: any = null;

  readonly STATUT_CONFIG: { [key: string]: { label: string; css: string; color: string } } = {
    'en_attente':        { label: 'En attente',     css: 'warning',   color: '#eab308' },
    'confirmee':         { label: 'Confirmée',      css: 'success',   color: '#22c55e' },
    'en_attente_retour': { label: 'Retour attendu', css: 'purple',    color: '#a855f7' },
    'terminee':          { label: 'Terminée',       css: 'secondary', color: '#64748b' },
    'annulee':           { label: 'Annulée',        css: 'danger',    color: '#ef4444' }
  };

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: 'fr',
    firstDay: 1, // Débute la semaine le Lundi pour un rendu plus rationnel en Europe/Afrique
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
    },
    buttonText: {
      today: "Aujourd'hui",
      month: 'Mois',
      week: 'Semaine'
    },
    events: [],
    eventClick: (info) => this.onEventClick(info),
    height: 'auto',
    fixedWeekCount: false
  };

  constructor(private reservationService: ReservationService) {}

  ngOnInit(): void {
    this.loadCalendarEvents();
  }

  loadCalendarEvents(): void {
    this.reservationService.getCalendarEvents().subscribe({
      next: (events: CalendarEvent[]) => {
        this.calendarOptions = {
          ...this.calendarOptions,
          events: events.map(event => {
            const config = this.STATUT_CONFIG[event.statut] || { color: '#3b82f6' };
            return {
              id: event.id.toString(),
              title: `${event.title}`,
              start: event.start,
              end: event.end,
              backgroundColor: config.color + '15', // Fond transparent chic (15% opacité)
              borderColor: config.color,
              textColor: config.color,
              extendedProps: {
                statut: event.statut,
                client: event.client,
                materiels: event.materiels
              }
            };
          })
        };
      },
      error: (error) => console.error('Erreur lors du chargement du calendrier', error)
    });
  }

  onEventClick(info: EventClickArg): void {
    this.selectedEvent = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      statut: info.event.extendedProps['statut'],
      client: info.event.extendedProps['client'],
      materiels: info.event.extendedProps['materiels']
    };
  }

  getStatutConfig(s: string) { return this.STATUT_CONFIG[s] || { label: s, css: 'secondary' }; }
  getStatutCss(s: string): string { return this.getStatutConfig(s).css; }
  getStatutLabel(s: string): string { return this.getStatutConfig(s).label; }
}