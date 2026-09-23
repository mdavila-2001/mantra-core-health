import { computed, signal, type Signal } from '@angular/core';

import type { CursorState } from './data-table.types';

/**
 * Centinela con el que la tabla pide la página anterior.
 *
 * El contrato de la API solo entrega `nextCursor`: un cursor hacia atrás no
 * existe. `app-data-table` emite el valor de `prevCursor` tal cual, así que se
 * le da esta marca y el camino de vuelta lo recuerda {@link HistorialDeCursor}.
 */
export const CURSOR_ANTERIOR = 'anterior';

/**
 * El paginado por cursor de una pantalla que lista.
 *
 * Es el dueño del estado «en qué página estoy y cómo vuelvo»: nada más. No
 * pide datos, no conoce el endpoint y no sabe qué hay en la página; el
 * contenedor le avisa lo que llegó y le pregunta con qué cursor pedir.
 */
export interface HistorialDeCursor {
  /** Lo que la tabla necesita para dibujar «Anterior» y «Siguiente». */
  readonly cursor: Signal<CursorState>;

  /**
   * El cursor con el que se pide la página vigente. `undefined` en la primera:
   * la petición va sin `cursor`, que es como la API entiende «desde el
   * principio».
   */
  actual(): string | undefined;

  /**
   * Responde al `cursorChanged` de la tabla.
   *
   * Con un cursor opaco avanza y lo recuerda; con {@link CURSOR_ANTERIOR}
   * vuelve una página, que es olvidar la última visitada. No pide datos: el
   * contenedor lo hace después, con {@link actual}.
   */
  mover(cursor: string): void;

  /**
   * Llegó la página vigente: registra el cursor siguiente que devolvió la API,
   * o `null` si no hay más. Se llama también cuando la petición falló, con
   * `null`, para que la tabla no ofrezca un «Siguiente» de una página que
   * nunca llegó.
   */
  llego(nextCursor: string | null): void;

  /**
   * La lista cambió —otro filtro, otra práctica—: vuelve a la primera página y
   * olvida el camino. El cursor que había era de la lista anterior y seguirlo
   * devolvería una página del listado viejo.
   */
  reiniciar(): void;
}

/**
 * Paginación por cursor con memoria, para una API que solo sabe avanzar.
 *
 * ```ts
 * private readonly paginado = historialDeCursor();
 * protected readonly cursor = this.paginado.cursor;
 *
 * protected mover(cursor: string): void {
 *   this.paginado.mover(cursor);
 *   this.cargar();
 * }
 *
 * private cargar(): void {
 *   const cursorActual = this.paginado.actual();
 *   this.cliente.buscar({ ...(cursorActual === undefined ? {} : { cursor: cursorActual }) })
 *     .subscribe({
 *       next: (pagina) => this.paginado.llego(pagina.nextCursor),
 *       error: () => this.paginado.llego(null),
 *     });
 * }
 * ```
 *
 * ## Por qué existe
 *
 * Cuatro listados —pacientes, organizaciones, catálogo de servicios y
 * solicitudes de seguro— escribieron esta misma regla a mano, con los mismos
 * tres signals y el mismo centinela, y la explicaban en el mismo comentario:
 * «el contrato solo entrega `nextCursor`; el camino de vuelta lo recuerda la
 * pantalla». Una regla que se copia cuatro veces se corrige tres veces y media.
 *
 * ## Lo que decide y lo que no
 *
 * - **Decide** cuándo hay «Anterior» (cuando se avanzó al menos una vez) y qué
 *   cursor viaja en la petición (el último visitado).
 * - **No decide** cuándo pedir: el contenedor llama a {@link HistorialDeCursor.mover}
 *   y después carga, y así el reintento de S8/S9 puede repetir la página en la
 *   que quedó sin tocar el historial.
 * - **No conoce el total**: un cursor no lo sabe, así que tampoco hay «página
 *   7 de 42» (§0.6). Eso lo dibuja la tabla; acá solo se recuerda el camino.
 *
 * Un fallo al cargar deja el historial donde estaba: reintentar es volver a
 * pedir la misma página, no la primera.
 */
export function historialDeCursor(): HistorialDeCursor {
  /** Los cursores ya visitados, en orden. El primero es «sin cursor». */
  const historia = signal<readonly (string | undefined)[]>([undefined]);
  const siguiente = signal<string | null>(null);

  const cursor = computed<CursorState>(() => ({
    prevCursor: historia().length > 1 ? CURSOR_ANTERIOR : null,
    nextCursor: siguiente(),
  }));

  return {
    cursor,
    actual: () => historia().at(-1),
    mover: (destino) => {
      if (destino === CURSOR_ANTERIOR) {
        historia.update((visitados) =>
          // En la primera página no hay adónde volver: se queda donde está en
          // vez de dejar el historial vacío y sin «sin cursor».
          visitados.length > 1 ? visitados.slice(0, -1) : visitados,
        );
      } else {
        historia.update((visitados) => [...visitados, destino]);
      }
    },
    llego: (nextCursor) => siguiente.set(nextCursor),
    reiniciar: () => {
      historia.set([undefined]);
      siguiente.set(null);
    },
  };
}
