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
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { ThemeService } from './core/tokens/theme.service';
import { ACCESS_CHALLENGE_RESOLVER } from './core/access-challenge/access-challenge';
import { accessChallengeInterceptor } from './core/http/access-challenge.interceptor';
import { authInterceptor } from './core/http/auth.interceptor';
import { timeoutInterceptor } from './core/http/timeout.interceptor';
import { apiFailureLogInterceptor } from './core/http/api-failure-log.interceptor';
import { AuthService } from './core/auth/auth.service';
import { SESSION_CLEANERS } from './core/auth/session-cleanup';
import { IdleLogout } from './core/auth/idle-logout';
import { SessionEndedRedirect } from './core/auth/session-ended-redirect';
import { UiVisibilityService } from './core/visibility/ui-visibility.service';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { tracingInterceptor } from './core/observability/http/tracing.interceptor';
import { provideObservability } from './core/observability/observability.providers';
import { AccessChallengeService } from './features/access-governance/access-challenge/access-challenge.service';
import { provideDependentLinkNotificationActions } from './features/account/dependents/dependent-link-notification-actions';
import { provideUxAnalytics } from './core/observability/ux/ux-analytics.providers';
import { simulatorInterceptors } from './core/simulator/simulator';
import { environment } from '../environments/environment';
import { ROUTE_VIEW_TRANSITION_OPTIONS } from './shared/motion/route-transition';

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
    // Transición entre rutas con la View Transitions API: sólo el contenido
    // (`view-transition-name: contenido`) hace un fundido corto; el menú y la
    // barra se quedan quietos. Sin la API el router navega igual. Con
    // `prefers-reduced-motion` la transición se crea igual pero `styles.css`
    // apaga su animación: saltarla con `skipTransition()` rechaza `ready` con
    // `AbortError` y el router lo escribe en la consola (#1449). Ver
    // `shared/motion/route-transition.ts`.
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
      withViewTransitions(ROUTE_VIEW_TRANSITION_OPTIONS),
    ),
    provideClientHydration(withEventReplay()),
    // `withFetch` no es opcional bajo SSR: sin él el cliente usa XHR, que en el
    // servidor obliga a un reemplazo y rompe la transferencia de estado.
    //
    // El orden de los interceptores importa, y ninguno está donde está por
    // gusto:
    //
    //   0. `apiFailureLogInterceptor` — por fuera de todo. Escribe en la
    //      consola el fallo **final** que recibe la pantalla (después del
    //      refresco de sesión y del tiempo de espera), con código, campos y
    //      `correlationId`. Sólo en desarrollo o con `alovida.debugApi`.
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
      // credenciales cuando llega a él, igual que si fuera la red. Con la
      // configuración real (`production`, `production-api`, `real-api`,
      // `e2e-real`) no se registra: la petición sale a la red desde el
      // interceptor anterior, sin pasar por un interceptor que existe sólo para
      // la maqueta (H1.S2.M2). En esas compilaciones `simulatorInterceptors`
      // viene vacío de la versión neutra de `core/simulator/simulator.ts`, así
      // que el simulador ni siquiera entra al paquete (O3-4).
      withInterceptors([
        apiFailureLogInterceptor,
        tracingInterceptor,
        timeoutInterceptor,
        authInterceptor,
        // Resuelve los desafíos de acceso (motivo, segundo paso, aprobación) de las peticiones que lo piden con
        // `withAccessChallenge()`. Va **dentro** de `authInterceptor` (el reintento ya lleva la sesión) y **fuera** del
        // simulado, para que vea también los 403/422 del mock.
        accessChallengeInterceptor,
        ...(environment.mockBackend ? simulatorInterceptors : []),
      ]),
    ),
    // Trazas del Router y de la estabilidad de la aplicación. No bloquea el
    // arranque y, con la telemetría apagada, no engancha nada.
    provideObservability(),
    // Qué hacen los botones de las notificaciones (`core/notifications/notification-actions.ts`).
    // Quién abre el diálogo de desafío de acceso cuando la API pide motivo, segundo paso o aprobación (`core/access-challenge`).
    { provide: ACCESS_CHALLENGE_RESOLVER, useExisting: AccessChallengeService },
    provideDependentLinkNotificationActions(),
    // Interacciones para los mapas de calor (`POST /telemetry/activity-events`).
    // Independiente de las trazas: se enciende con `PUBLIC_UX_ANALYTICS_*`.
    provideUxAnalytics(),
    // El tema no depende de que exista un componente: se instancia al arrancar.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Lo sensible que otras piezas dejan en el navegador se olvida al cerrar
    // sesión (TX-31). Se trae con `import()` al cerrar sesión: importarlo de forma
    // estática lo arrastraba al paquete inicial, que tiene presupuesto. Ver
    // `session-cleanup.lazy.ts`.
    {
      provide: SESSION_CLEANERS,
      multi: true,
      useFactory: () => {
        const injector = inject(Injector);
        return () =>
          void import('./session-cleanup.lazy')
            .then((m) => m.olvidarLoSensibleDelNavegador(injector))
            // Sin red o con un despliegue nuevo el chunk puede no cargar: la sesión ya se cerró, y un rechazo
            // sin capturar solo ensuciaría la consola de quien se va.
            .catch(() => undefined);
      },
    },
    // Las sedes y el personal que leyeron las pantallas de quirófano y
    // facturación de espacios (F4/F5) no pasan a la cuenta siguiente.
    {
      provide: SESSION_CLEANERS,
      multi: true,
      useFactory: () => {
        const injector = inject(Injector);
        return () =>
          void import('./core/data-access/operating-rooms/site-context.store')
            .then((m) => injector.get(m.SiteContextStore).clear())
            .catch(() => undefined);
      },
    },
    // Los avisos push de la cuenta que se va no deben seguir llegando a este
    // navegador (dispositivo compartido). Import dinámico por el presupuesto del
    // paquete inicial, igual que el limpiador de arriba.
    {
      provide: SESSION_CLEANERS,
      multi: true,
      useFactory: () => {
        const injector = inject(Injector);
        return () =>
          void import('./core/notifications/web-push.service')
            .then((m) => injector.get(m.WebPushService).forgetBrowser())
            // Mismo criterio que el limpiador de arriba: sin red el chunk puede no cargar y la sesión ya se cerró.
            .catch(() => undefined);
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
    // Las reglas de visibilidad de la interfaz (`GET /me/ui-visibility`) siguen a la sesión: se piden al abrirla y se
    // vuelven a pedir si cambia la persona o la organización. Presentación, no seguridad: la API autoriza igual. No
    // bloquea el arranque —es un seguimiento reactivo— y, si el pedido falla, no se oculta nada.
    provideAppInitializer(() => {
      inject(UiVisibilityService).start();
    }),
  ],
};
