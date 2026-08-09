import { NavigationCancellationCode, type Route } from '@angular/router';
import type { Span } from '@opentelemetry/api';

import { recordDeferredSpan } from '../tracing/deferred-spans';
import { ATTR, SPAN_NAMES } from '../tracing/tracing.constants';

/**
 * El estado que `RouterTracing` tiene que llevar entre eventos, y las dos
 * traducciones que necesita.
 *
 * Vive aparte porque son dos responsabilidades distintas: allí se decide **qué
 * evento del Router significa qué**, y acá se guarda lo abierto y se cierra
 * bien. Juntas pasaban de 300 líneas y la parte interesante —el mapeo de
 * eventos— quedaba enterrada.
 */

/** Una navegación abierta. `span` es `null` si el SDK todavía no estaba listo. */
export interface NavigationTrace {
  readonly startTime: number;
  readonly attributes: Record<string, string | number | boolean>;
  readonly span: Span | null;
}

/** Una carga de fragmento diferido en curso. */
export interface ChunkLoad {
  readonly startTime: number;
  readonly attributes: Record<string, string | number | boolean>;
  readonly span: Span | null;
}

/**
 * Las cargas de fragmento en curso, por objeto `Route`.
 *
 * La clave es el propio objeto y no un identificador porque el Router **no
 * numera estas cargas**: `RouteConfigLoadStart` y `RouteConfigLoadEnd` solo
 * comparten la referencia a la ruta.
 */
export class ChunkLoadStore {
  private readonly loads = new Map<Route, ChunkLoad>();

  open(route: Route, load: ChunkLoad): void {
    this.loads.set(route, load);
  }

  /**
   * Cierra la carga con su resultado.
   *
   * Una ruta desconocida se ignora en silencio: puede llegar un `End` de una
   * carga que empezó antes de que esto se suscribiera, y anotar un final sin
   * principio produciría un span de duración inventada.
   */
  close(route: Route, result: 'loaded' | 'failed'): void {
    const load = this.loads.get(route);
    if (load === undefined) {
      return;
    }
    this.loads.delete(route);

    const attributes = { ...load.attributes, [ATTR.lazyResult]: result };

    if (load.span !== null) {
      load.span.setAttributes(attributes);
      load.span.end();
      return;
    }

    recordDeferredSpan({
      name: SPAN_NAMES.lazyRouteLoad,
      startTime: load.startTime,
      endTime: Date.now(),
      attributes,
    });
  }

  /** Marca fallidas todas las cargas abiertas: la navegación murió con ellas. */
  failAll(errorType: string): void {
    for (const [route, load] of [...this.loads]) {
      load.span?.setAttribute('error.type', errorType);
      this.close(route, 'failed');
    }
  }

  /**
   * Cierra lo que quedara abierto al desecharse la aplicación.
   *
   * Un span sin cerrar no se exporta nunca: se queda en memoria hasta que la
   * pestaña muere. Es la fuga clásica de instrumentar el Router a mano.
   */
  abandonAll(): void {
    for (const { span } of this.loads.values()) {
      span?.setAttribute(ATTR.lazyResult, 'failed');
      span?.end();
    }
    this.loads.clear();
  }
}

/**
 * El código de cancelación, como nombre estable.
 *
 * Se traduce el número del enum en vez de guardarlo: un `3` en un atributo no
 * se puede leer, y el valor numérico podría cambiar entre versiones de Angular
 * mientras el significado se mantiene.
 *
 * El campo `reason` que trae el evento **no** se usa: es un texto pensado para
 * leer en consola durante el desarrollo, cambia entre versiones y puede incluir
 * la URL entera, con su query string.
 */
export function cancellationName(code: NavigationCancellationCode | undefined): string {
  switch (code) {
    case NavigationCancellationCode.Redirect:
      return 'redirect';
    case NavigationCancellationCode.SupersededByNewNavigation:
      return 'superseded';
    case NavigationCancellationCode.NoDataFromResolver:
      return 'resolver_empty';
    case NavigationCancellationCode.GuardRejected:
      return 'guard_rejected';
    default:
      return 'unknown';
  }
}

/**
 * Los dos nombres con que llega un fragmento que no se pudo descargar.
 *
 * Es el modo de fallo más caro de este proyecto: se despliega una versión
 * nueva, alguien tenía la anterior abierta, y el fragmento que su `index.html`
 * pide ya no existe porque `outputHashing: "all"` renombró todo.
 */
export function isChunkError(errorType: string): boolean {
  return errorType === 'ChunkLoadError' || errorType === 'TypeError';
}
