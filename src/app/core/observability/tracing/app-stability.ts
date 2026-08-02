import { ApplicationRef, DestroyRef, inject, Injectable } from '@angular/core';
import { filter, take } from 'rxjs';

import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import { ATTR, SPAN_EVENTS, SPAN_NAMES } from './tracing.constants';
import { recordDeferredSpan } from './deferred-spans';

/**
 * Cuándo la aplicación deja de estar ocupada, y cuánto costó hidratarla.
 *
 * ## Qué mide
 *
 * De que el navegador empezó a cargar la página (`performance.timeOrigin`) a la
 * primera vez que `ApplicationRef.isStable` vale `true`. Ese instante es el que
 * de verdad importa para una persona: no «apareció algo en pantalla», sino
 * «la aplicación terminó de trabajar y responde».
 *
 * En este proyecto ese intervalo incluye algo concreto y caro: el inicializador
 * que **espera al canje del refresh token** antes de que el Router evalúe el
 * guard (`app.config.ts`). Es una petición de red dentro del arranque, hecha a
 * propósito para evitar un parpadeo al login, y hasta ahora nadie la había
 * medido.
 *
 * ## Por qué el span se llama de hidratación
 *
 * Cuando el HTML vino del servidor, este intervalo **es** la hidratación: el
 * navegador recibe marcado ya pintado y lo convierte en una aplicación viva.
 * Cuando no —una ruta en modo `Client`— el nombre sería engañoso, así que el
 * span solo se emite si el modo de renderizado resuelto es `ssr`. La
 * estabilidad sí se anota en los dos casos, como evento.
 *
 * ## Por qué solo la primera vez
 *
 * `isStable` alterna: vuelve a `false` en cuanto hay una petición en vuelo, y a
 * `true` cuando termina. Emitir en cada cambio produciría un span por cada
 * llamada a la API durante toda la sesión. `take(1)` sobre el primer `true` es
 * lo único que responde la pregunta que se está haciendo.
 */
@Injectable({ providedIn: 'root' })
export class AppStabilityTracing {
  private readonly config = inject(TELEMETRY_CONFIG);
  private readonly appRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;

  start(): void {
    if (this.started || !this.config.enabled || typeof performance === 'undefined') {
      return;
    }
    this.started = true;

    const origin = performance.timeOrigin;

    const subscription = this.appRef.isStable
      .pipe(
        filter((stable) => stable),
        take(1),
      )
      .subscribe(() => this.onStable(origin));

    /**
     * `isStable` se completa al desecharse la aplicación, así que en producción
     * esta baja no llega a hacer falta. En pruebas sí: una aplicación creada y
     * destruida antes de estabilizarse dejaría la suscripción viva.
     */
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  private onStable(origin: number): void {
    if (this.config.renderingMode !== 'ssr') {
      return;
    }

    const endTime = Date.now();

    recordDeferredSpan({
      name: SPAN_NAMES.hydration,
      /**
       * Desde el origen de tiempos del navegador, no desde que arrancó Angular:
       * la hidratación empieza cuando llega el HTML del servidor, y lo que se
       * quiere saber es cuánto esperó la persona en total.
       */
      startTime: origin,
      endTime,
      events: [
        { name: SPAN_EVENTS.hydrationStarted, time: origin },
        { name: SPAN_EVENTS.hydrationCompleted, time: endTime },
        { name: SPAN_EVENTS.applicationStable, time: endTime },
      ],
      attributes: {
        [ATTR.renderingMode]: this.config.renderingMode,
        [ATTR.release]: this.config.version,
        [ATTR.buildId]: this.config.buildId,
      },
    });
  }
}
