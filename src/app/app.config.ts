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
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/http/auth.interceptor';

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
    // Arranca la restauración de la sesión apenas la aplicación existe, en vez de esperar a que
    // el primer guard la pida. Gana el tiempo que tarda en resolverse la primera ruta.
    //
    // **No se devuelve la promesa a propósito.** Si el arranque esperara a la petición de
    // refresco, la aplicación entera quedaría en blanco hasta que la API contestara —y con la API
    // caída, para siempre. Quien necesita el resultado lo espera donde corresponde:
    // `authGuard` con `ensureRestored()`, que comparte esta misma promesa.
    provideAppInitializer(() => {
      void inject(AuthService).ensureRestored();
    })
  ]
};
