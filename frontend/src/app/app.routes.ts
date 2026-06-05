import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  { path: "home", loadComponent: () => import("./components/pages/landing-page/landing-page.component").then(m => m.LandingPageComponent) },
  { path: "login", loadComponent: () => import("./components/pages/login/login.component").then(m => m.LoginComponent) },
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
      { path: "", redirectTo: "dashboard", pathMatch: "full" }
    ]
  },
  { path: "", redirectTo: "home", pathMatch: "full" },
  { path: "**", redirectTo: "login" }
];
