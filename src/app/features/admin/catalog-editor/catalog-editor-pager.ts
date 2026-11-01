import { computed, signal } from '@angular/core';

import type { CursorState } from '../../../shared/components/organisms/data-table/data-table.types';

/** Marca de la primera página dentro de la pila (el cursor real de la primera es «ninguno»). */
const INICIO = '\u0000inicio';

/**
 * Paginación por cursor con «anterior». La API sólo da `nextCursor`: para volver
 * se recuerda la pila de cursores ya usados. Nada de números de página, porque
 * un cursor no conoce el total.
 */
export class PaginadorDeCursor {
  private readonly pila = signal<readonly string[]>([]);
  private readonly _actual = signal<string | undefined>(undefined);
  private readonly _siguiente = signal<string | null>(null);

  /** Cursor de la página que se está viendo; `undefined` en la primera. */
  readonly actual = this._actual.asReadonly();

  /** Lo que `app-data-table` necesita para pintar «Anterior» y «Siguiente». */
  readonly cursor = computed<CursorState>(() => {
    const previa = this.pila().at(-1);
    return { prevCursor: previa === undefined ? null : previa, nextCursor: this._siguiente() };
  });

  /** Anota el cursor de la página siguiente que acaba de devolver la API. */
  recibir(nextCursor: string | null): void {
    this._siguiente.set(nextCursor);
  }

  /** Vuelve a la primera página (cambió un filtro o se recargó). */
  reiniciar(): void {
    this.pila.set([]);
    this._actual.set(undefined);
    this._siguiente.set(null);
  }

  /** Aplica el cursor que emitió la tabla y devuelve el que hay que pedir. */
  mover(cursor: string): string | undefined {
    if (cursor === this._siguiente()) {
      this.pila.update((p) => [...p, this._actual() ?? INICIO]);
      this._actual.set(cursor);
      return cursor;
    }
    const previa = this.pila().at(-1);
    this.pila.update((p) => p.slice(0, -1));
    const destino = previa === undefined || previa === INICIO ? undefined : previa;
    this._actual.set(destino);
    return destino;
  }
}
