import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';

import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { EmptyViewState, ViewState } from '../../../../core/view-state/view-state.types';
import { historialDeCursor } from '../../../../shared/components/organisms/data-table/cursor-history';
import type { CursorState } from '../../../../shared/components/organisms/data-table/data-table.types';

/** Una página por cursor, sin total: las APIs de gobierno no lo cuentan. */
export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Lo que una pantalla de listado necesita para dibujar la tabla y moverse por ella. */
export interface CursorList<T> {
  readonly state: Signal<ViewState<readonly T[]>>;
  readonly cursor: Signal<CursorState>;
  /** Otra consulta (cambió un filtro): vuelve a la primera página. */
  restart(): void;
  /** Reintento: la misma página en la que quedó. */
  reload(): void;
  /** Responde al `cursorChanged` de `app-data-table`. */
  move(cursor: string): void;
}

/**
 * Un listado paginado por cursor, con sus estados M34. No sabe qué pide: el
 * contenedor le pasa `loadPage`, que lee los filtros vigentes.
 *
 * Una consulta nueva cancela la anterior, para que una respuesta vieja no pise
 * a la nueva. Se crea en el contexto de inyección del componente (un campo).
 */
export function cursorList<T>(
  loadPage: (cursor: string | undefined) => Observable<CursorPage<T>>,
  whenEmpty: () => EmptyViewState,
): CursorList<T> {
  const history = historialDeCursor();
  const state = signal<ViewState<readonly T[]>>(loading());
  let pending: Subscription | null = null;
  inject(DestroyRef).onDestroy(() => pending?.unsubscribe());

  const load = (): void => {
    pending?.unsubscribe();
    state.set(loading());
    pending = loadPage(history.actual()).subscribe({
      next: (page) => {
        history.llego(page.nextCursor);
        state.set(page.items.length === 0 ? whenEmpty() : ready(page.items));
      },
      error: (error: unknown) => {
        history.llego(null);
        state.set(errorToViewState<readonly T[]>(error));
      },
    });
  };

  return {
    state: state.asReadonly(),
    cursor: history.cursor,
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
