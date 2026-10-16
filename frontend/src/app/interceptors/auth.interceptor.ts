import { HttpInterceptorFn } from "@angular/common/http";
import { isPlatformBrowser } from "@angular/common";
import { inject, PLATFORM_ID } from "@angular/core";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // Requête qui porte déjà son jeton (ex. espace client) : on ne l'écrase pas
  if (isPlatformBrowser(platformId) && !req.headers.has("Authorization")) {
    const token = localStorage.getItem("access_token");
    if (token && token.trim() !== "") {
      const cloned = req.clone({
        setHeaders: { Authorization: "Bearer " + token }
      });
      return next(cloned);
    }
  }

  return next(req);
};
