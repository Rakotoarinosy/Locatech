import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface RuntimeConfig {
  googleClientId: string;
}

const VIDE: RuntimeConfig = { googleClientId: '' };

/**
 * Configuration lue au démarrage plutôt que compilée dans le bundle :
 * - prod : /runtime-config.json est généré par le conteneur nginx depuis GOOGLE_CLIENT_ID (.env) ;
 * - dev : /runtime-config.local.json (non versionné) surcharge le fichier vide du dépôt.
 */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private config?: Promise<RuntimeConfig>;

  charger(): Promise<RuntimeConfig> {
    if (!this.isBrowser) return Promise.resolve(VIDE);
    this.config ??= Promise.all([this.lire('/runtime-config.json'), this.lire('/runtime-config.local.json')])
      .then(([base, local]) => ({ ...VIDE, ...base, ...local }));
    return this.config;
  }

  private async lire(url: string): Promise<Partial<RuntimeConfig>> {
    try {
      const reponse = await fetch(url, { cache: 'no-store' });
      return reponse.ok ? await reponse.json() : {};
    } catch {
      return {};
    }
  }
}
