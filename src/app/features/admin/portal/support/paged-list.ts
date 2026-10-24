import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';

import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { EmptyViewState, ViewState } from '../../../../core/view-state/view-state.types';
import { historialDeCursor } from '../../../../shared/components/organisms/data-table/cursor-history';
import type { CursorState } from '../../../../shared/components/organisms/data-table/data-table.types';

/** Una página por cursor. `total` sólo si la API lo conoce (el inventario sí, el catálogo vivo no). */
export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total?: number;
}

/** Lo que una pantalla de listado necesita para dibujar la tabla y moverse por ella. */
export interface PagedList<T> {
  readonly state: Signal<ViewState<readonly T[]>>;
  readonly cursor: Signal<CursorState>;
  readonly total: Signal<number | null>;
  /** Otra consulta (cambió un filtro): vuelve a la primera página. */
  restart(): void;
  /** Reintento de S8/S9: la misma página en la que quedó. */
  reload(): void;
  /** Responde al `cursorChanged` de `app-data-table`. */
  move(cursor: string): void;
}

/**
 * Un listado paginado por cursor, con sus estados M34. No sabe qué pide ni con
 * qué filtros: el contenedor le pasa `loadPage`, que lee los filtros vigentes.
 *
 * Una consulta nueva cancela la anterior: con la URL como fuente, tipear en el
 * buscador dispara varias seguidas y la respuesta vieja no puede pisar a la
 * nueva. Se crea en el contexto de inyección del componente (un campo).
 */
export function pagedList<T>(
  loadPage: (cursor: string | undefined) => Observable<PagedResult<T>>,
  whenEmpty: () => EmptyViewState,
): PagedList<T> {
  const history = historialDeCursor();
  const state = signal<ViewState<readonly T[]>>(loading());
  const total = signal<number | null>(null);
  let pending: Subscription | null = null;
  inject(DestroyRef).onDestroy(() => pending?.unsubscribe());

  const load = (): void => {
    pending?.unsubscribe();
    state.set(loading());
    pending = loadPage(history.actual()).subscribe({
      next: (page) => {
        history.llego(page.nextCursor);
        total.set(page.total ?? null);
        state.set(page.items.length === 0 ? whenEmpty() : ready(page.items));
      },
      error: (error: unknown) => {
        history.llego(null);
        total.set(null);
        state.set(errorToViewState<readonly T[]>(error));
      },
    });
  };

  return {
    state: state.asReadonly(),
    cursor: history.cursor,
    total: total.asReadonly(),
    restart: () => {
      history.reiniciar();
      load();
    },
    reload: load,
    move: (cursor) => {
      history.mover(cursor);
      load();
    },
  };
}
