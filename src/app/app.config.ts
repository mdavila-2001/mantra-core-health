import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { ThemeService } from './core/tokens/theme.service';
import { authInterceptor } from './core/http/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), provideClientHydration(withEventReplay()),
    // `withFetch` no es opcional bajo SSR: sin él el cliente usa XHR, que en el
    // servidor obliga a un reemplazo y rompe la transferencia de estado.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // El tema no depende de que exista un componente: se instancia al arrancar.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Se recupera la sesión ANTES de que el router evalúe el guard. Si no se
    // esperara, alguien con sesión válida vería un parpadeo al login mientras
    // el canje del refresh token está en vuelo. En el servidor no hay
    // almacenamiento, así que resuelve de inmediato sin pedir nada.
    provideAppInitializer(() => inject(AuthService).restoreSession())
  ]
};
