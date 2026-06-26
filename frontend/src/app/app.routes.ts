import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
    { path: "", redirectTo: "home", pathMatch: "full" },
  { path: "home", loadComponent: () => import("./components/pages/landing-page/landing-page.component").then(m => m.LandingPageComponent) },
  { path: "login", loadComponent: () => import("./components/pages/login/login.component").then(m => m.LoginComponent) },
  { path: "assistant-ia", loadComponent: () => import("./components/pages/assistant/assistant.component").then(m => m.AssistantComponent) },
  {
    path: "back-office",
    canActivate: [authGuard],
    loadComponent: () => import("./components/layout/layout.component").then(m => m.LayoutComponent),
    children: [
      { path: "dashboard", loadComponent: () => import("./components/pages/dashboard/dashboard.component").then(m => m.DashboardComponent) },
      { path: "clients", loadComponent: () => import("./components/pages/clients/clients.component").then(m => m.ClientsComponent) },
      { path: "materiels", loadComponent: () => import("./components/pages/materiels/materiels.component").then(m => m.MaterielsComponent) },
      { path: "reservations", loadComponent: () => import("./components/pages/reservations/reservations.component").then(m => m.ReservationsComponent) },
      { path: "factures", loadComponent: () => import("./components/pages/factures/factures.component").then(m => m.FacturesComponent) },
      { path: "analytics", loadComponent: () => import("./components/pages/analytics/analytics.component").then(m => m.AnalyticsComponent) },
      { path: "assistant-ia", loadComponent: () => import("./components/pages/assistant/assistant.component").then(m => m.AssistantComponent) },
      { path: "parametres", loadComponent: () => import("./components/pages/parametres/parametres.component").then(m => m.ParametresComponent) },
      { path: "", redirectTo: "dashboard", pathMatch: "full" }
    ]
  },
  {
  path: '400',
  loadComponent: () =>
    import('./components/error/error-400/error-400.component')
      .then(m => m.Error400Component)
  },

  {
    path: '401',
    loadComponent: () =>
      import('./components/error/error-401/error-401.component')
        .then(m => m.Error401Component)
  },

  {
    path: '404',
  loadComponent: () =>
      import('./components/error/error-404/error-404.component')
        .then(m => m.Error404Component)
  },

  {
    path: '502',
    loadComponent: () =>
      import('./components/error/error-502/error-502.component')
        .then(m => m.Error502Component)
  },
    
  {
    path: '500',
    loadComponent: () =>
      import('./components/error/error-500/error-500.component')
        .then(m => m.Error500Component)
  },

  {
    path: '**',
    redirectTo: '404'
  },
];
