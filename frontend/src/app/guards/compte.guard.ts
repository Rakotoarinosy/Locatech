import { PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { CanActivateFn, Router } from "@angular/router";
import { CompteService } from "../services/compte.service";

/** Espace client : redirige vers la connexion Google en gardant la page demandée. */
export const compteGuard: CanActivateFn = (_route, state) => {
  // Côté serveur (SSR) la session n'est pas lisible : la décision est prise dans le navigateur
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const compte = inject(CompteService);
  if (compte.connecte()) return true;
  return inject(Router).createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
};
