import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';
import {
  ApplicationConfig,
  DestroyRef,
  ErrorHandler,
  inject,
  Injector,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { ThemeService } from './core/tokens/theme.service';
import { authInterceptor } from './core/http/auth.interceptor';
import { timeoutInterceptor } from './core/http/timeout.interceptor';
import { AuthService } from './core/auth/auth.service';
import { SESSION_CLEANERS } from './core/auth/session-cleanup';
import { ChatAutoReply } from './core/messaging/chat-auto-reply';
import { MessageTemplates } from './core/messaging/message-templates';
import { TarifariosRecordados } from './features/admin/medical-laboratory/tarifarios-recordados';
import { IdleLogout } from './core/auth/idle-logout';
import { SessionEndedRedirect } from './core/auth/session-ended-redirect';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { tracingInterceptor } from './core/observability/http/tracing.interceptor';
import { provideObservability } from './core/observability/observability.providers';
import { mockBackendInterceptor } from './core/mock/mock-backend.interceptor';

/**
 * Datos de formato del idioma de la aplicación.
 *
 * Se registran **fuera** del arreglo de proveedores porque `registerLocaleData`
 * es un efecto global de `@angular/common`, no una inyección: `LOCALE_ID` sólo
 * dice cuál usar, y sin este registro Angular no tiene los nombres de los meses
 * ni de los días para ese idioma y sigue formateando en inglés.
 */
registerLocaleData(localeEsBo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    /**
     * El idioma con el que se formatean fechas y números.
     *
     * `index.html` declara `<html lang="es">` desde siempre, pero `LOCALE_ID`
     * seguía en su valor por omisión —`en-US`—, así que la agenda mostraba
     * «Monday 10 Aug» dentro de una pantalla escrita entera en castellano. Lo
     * encontró el recorrido con usuarios reales, que fue el primero en pintar
     * una fecha con nombre de día.
     *
     * `es-BO` y no `es` a secas porque es el país del despliegue: lo dicen la
     * zona horaria de los recursos de agenda (`America/La_Paz`) y el prefijo
     * telefónico del modelo. Con `es` genérico el formato numérico y el de fecha
     * no son los que se leen acá.
     */
    { provide: LOCALE_ID, useValue: 'es-BO' },
    // `provideBrowserGlobalErrorListeners` engancha los fallos globales; esto
    // decide qué se hace con ellos. Sin este proveedor manda el manejador por
    // defecto de Angular, que escribe en consola y nada más: una excepción de
    // render dejaba la pantalla en blanco y nadie se enteraba.
    { provide: ErrorHandler, useClass: AppErrorHandler },
    // `anchorScrolling` hace funcionar los enlaces con `fragment` — el primero
    // es «Trayectoria laboral» en la portada del perfil profesional (R2-4),
    // que baja hasta el bloque dentro de la misma pantalla. Sin esto el
    // fragmento cambia en la URL y la página no se mueve.
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideClientHydration(withEventReplay()),
    // `withFetch` no es opcional bajo SSR: sin él el cliente usa XHR, que en el
    // servidor obliga a un reemplazo y rompe la transferencia de estado.
    //
    // El orden de los tres interceptores importa, y ninguno de los tres está
    // donde está por gusto:
    //
    //   1. `tracingInterceptor` — el más externo. Mide la petición *lógica*:
    //      con él por dentro, un refresco de sesión con reintento produciría
    //      dos spans para lo que la pantalla vivió como una sola llamada. Y su
    //      `traceparent` se pone antes de que nadie clone la petición, así que
    //      sobrevive a los dos clones que vienen después.
    //   2. `timeoutInterceptor` — su límite tiene que cubrir también el
    //      refresco de token que `authInterceptor` dispara. Al revés, un
    //      refresco colgado no vencería nunca.
    //   3. `authInterceptor` — el más interno, el que habla con la sesión.
    //
    // Consecuencia buscada: un vencimiento por tiempo aparece como error
    // *dentro* del span de la petición, que es donde hay que buscarlo.
    provideHttpClient(
      withFetch(),
      // El simulado va último: la petición ya lleva trazas, tiempo de espera y
      // credenciales cuando llega a él, igual que si fuera la red.
      withInterceptors([tracingInterceptor, timeoutInterceptor, authInterceptor, mockBackendInterceptor]),
    ),
    // Trazas del Router y de la estabilidad de la aplicación. No bloquea el
    // arranque y, con la telemetría apagada, no engancha nada.
    provideObservability(),
    // El tema no depende de que exista un componente: se instancia al arrancar.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Lo sensible que otras piezas dejan en el navegador se olvida al cerrar
    // sesión (TX-31): plantillas de mensajes, copia local de la respuesta
    // automática y tarifarios recordados. Se registran acá, y no dentro de
    // `core/auth`, para que la sesión no dependa de las pantallas. Se resuelven
    // recién al cerrar sesión: no cuestan nada al arrancar.
    {
      provide: SESSION_CLEANERS,
      multi: true,
      useFactory: () => {
        const injector = inject(Injector);
        return () => injector.get(MessageTemplates).olvidar();
      },
    },
    {
      provide: SESSION_CLEANERS,
      multi: true,
      useFactory: () => {
        const injector = inject(Injector);
        return () => injector.get(ChatAutoReply).olvidar();
      },
    },
    {
      provide: SESSION_CLEANERS,
      multi: true,
      useFactory: () => {
        const injector = inject(Injector);
        return () => injector.get(TarifariosRecordados).olvidar();
      },
    },
    // Se recupera la sesión ANTES de que el router evalúe el guard. Si no se
    // esperara, alguien con sesión válida vería un parpadeo al login mientras
    // el canje del refresh token está en vuelo. En el servidor no hay
    // almacenamiento, así que resuelve de inmediato sin pedir nada.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // Cerrar sesión en una pestaña ahora cierra las demás. Antes la otra
    // seguía funcionando hasta que su access token venciera, que en un
    // dispositivo compartido es una sesión abierta que alguien creyó cerrar.
    //
    // El oyente vive lo que vive la aplicación: la baja se registra en el
    // `DestroyRef` de la raíz para no dejarlo colgado en las pruebas.
    provideAppInitializer(() => {
      const baja = inject(AuthService).watchSessionClosedElsewhere();
      inject(DestroyRef).onDestroy(baja);
    }),
    // Cierre por inactividad. Se instancia al arrancar porque su reloj depende
    // de la sesión, no de que exista un componente: sin esto, un consultorio
    // vacío queda con la historia clínica de alguien en pantalla.
    provideAppInitializer(() => {
      inject(IdleLogout);
    }),
    // Quien pierde la sesión dentro del área privada —por inactividad, desde
    // otra pestaña o por un refresco rechazado— va al login. Sin esto la
    // pantalla quedaba en pie sin token y ninguna acción funcionaba.
    provideAppInitializer(() => {
      inject(SessionEndedRedirect);
    }),
  ],
};
