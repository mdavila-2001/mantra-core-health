import { inject, Injectable, InjectionToken, type Provider } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import type { NotificationDestination } from '../data-access/notifications/notifications.types';

/* ============================================================================
    Notificaciones con botones que hacen cosas.

    Una notificación puede pedir una decisión —«¿aceptás ser su dependiente?»—
    y resolverla sin salir de la campana. Este archivo es el mecanismo, no la
    decisión: no sabe de dependientes, de recetas ni de turnos.

    ## Quién sabe qué

    - **El servidor** dice qué acciones ofrece una notificación y si siguen
      vigentes (`InAppNotification.actions`). Una solicitud ya respondida vuelve
      sin botones. Es datos: `{ key, label, tone }`.
    - **El cliente** sabe qué hace cada una: un manejador por
      `(tipo de destino, key)`. Es código, y lo aporta la funcionalidad dueña
      del dominio —dependientes registra el suyo junto a su pantalla— sin que
      la campana tenga que importarla.

    Agregar una acción nueva es registrar un manejador y hacer que el backend
    la ofrezca; ni la campana ni el centro de notificaciones se tocan.

    ## Fallar cerrado

    Una acción que el servidor ofrece y para la que no hay manejador **no se
    dibuja** (`puedeEjecutar`): un botón que no hace nada se lee como producto
    roto, y es el caso normal durante el despliegue en que el backend se adelanta
    al front.
    ========================================================================== */

/** Qué contarle a la persona cuando la acción terminó. */
export interface NotificationActionOutcome {
  readonly message: string;
  /** El tono del aviso; por omisión, éxito. */
  readonly tone?: 'success' | 'info';
}

/** Qué hace una acción concreta de un tipo de notificación. */
export interface NotificationActionHandler {
  /** El `destination.type` de las notificaciones a las que aplica. */
  readonly destinationType: string;
  /** La `key` de la acción que ejecuta. */
  readonly key: string;
  /**
   * Ejecuta la acción. El `id` del destino es el de la cosa sobre la que se
   * decide (la solicitud, el turno…), no el de la notificación.
   */
  run(destination: NotificationDestination): Observable<NotificationActionOutcome>;
}

/**
 * Los manejadores registrados. Cada proveedor aporta uno o varios; el ejecutor
 * los junta. Se registran con {@link provideNotificationActionHandlers}.
 */
export const NOTIFICATION_ACTION_HANDLERS = new InjectionToken<
  readonly NotificationActionHandler[]
>('NOTIFICATION_ACTION_HANDLERS');

/**
 * Registra los manejadores de una funcionalidad.
 *
 * Recibe una **fábrica** y no los manejadores ya armados porque casi siempre
 * necesitan un cliente HTTP: la fábrica corre en contexto de inyección, donde
 * `inject()` funciona.
 *
 * ```ts
 * provideNotificationActionHandlers(() => {
 *   const profiles = inject(ProfilesClient);
 *   return [{ destinationType: 'X', key: 'OK', run: (d) => profiles.ok(d.id).pipe(map(...)) }];
 * })
 * ```
 */
export function provideNotificationActionHandlers(
  fabrica: () => readonly NotificationActionHandler[],
): Provider {
  return { provide: NOTIFICATION_ACTION_HANDLERS, multi: true, useFactory: fabrica };
}

/**
 * Ejecuta las acciones de las notificaciones.
 *
 * No toca la interfaz: devuelve lo que pasó y deja a quien lo llama —la campana,
 * el centro— decidir cómo mostrarlo. Así el mismo ejecutor sirve a las dos
 * pantallas y las pruebas no necesitan montar componentes.
 */
@Injectable({ providedIn: 'root' })
export class NotificationActionRunner {
  /**
   * `multi: true` entrega un arreglo por proveedor; se aplana. Sin ninguno
   * registrado la inyección opcional da `null`, y es un estado válido.
   */
  private readonly manejadores: readonly NotificationActionHandler[] = (
    inject(NOTIFICATION_ACTION_HANDLERS, { optional: true }) ?? []
  ).flat();

  /** Si hay algo que ejecutar para esa acción de ese destino. */
  puedeEjecutar(destination: NotificationDestination | undefined, key: string): boolean {
    return this.buscar(destination, key) !== undefined;
  }

  /**
   * Ejecuta la acción. Si no hay manejador emite un error en vez de no hacer
   * nada en silencio: quien llegó acá saltándose `puedeEjecutar` tiene un bug
   * que conviene ver.
   */
  ejecutar(
    destination: NotificationDestination | undefined,
    key: string,
  ): Observable<NotificationActionOutcome> {
    const manejador = this.buscar(destination, key);
    if (manejador === undefined || destination === undefined) {
      return throwError(
        () => new Error(`No hay manejador para la acción ${key} de ${destination?.type ?? '—'}.`),
      );
    }
    return manejador.run(destination);
  }

  private buscar(
    destination: NotificationDestination | undefined,
    key: string,
  ): NotificationActionHandler | undefined {
    if (destination === undefined) return undefined;
    return this.manejadores.find(
      (m) => m.destinationType === destination.type && m.key === key,
    );
  }
}
