import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { OperacionResumen } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../portal-nav';

/** Lo máximo que la API deja pedir por página; la ruta exacta cabe de sobra. */
const PAGE = 200;

/**
 * Qué clientes del frontend llaman a la operación. El dato no viene en la ficha
 * de la operación sino en el mapa de rutas (`llamadaPor`), así que se pide ahí,
 * acotado por ruta, módulo y método, y se busca la fila por `id`. Se pide al
 * abrir la pestaña, no al abrir la ficha.
 */
@Component({
  selector: 'app-portal-operation-callers',
  imports: [Badge, ViewStateHost],
  templateUrl: './operation-callers.html',
  styleUrl: './operation-callers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationCallers {
  private readonly client = inject(PortalClient);
  readonly operation = input.required<OperacionResumen>();

  protected readonly callers = signal<ViewState<readonly string[]>>(loading());
  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      this.operation();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const op = this.operation();
    this.pending?.unsubscribe();
    this.callers.set(loading());
    this.pending = this.client
      .routeMap({ q: op.ruta, modulo: op.modulo, metodo: op.metodo, limit: PAGE })
      .subscribe({
        next: (page) => {
          const row = page.items.find((r) => r.id === op.id);
          this.callers.set(row ? fromRow(row.llamadaPor) : notInMap(op.modulo));
        },
        error: (e: unknown) => this.callers.set(errorToViewState<readonly string[]>(e)),
      });
  }
}

const MAP_ROUTE = portalUrl('systems/flows');

function fromRow(callers: readonly string[] | null): ViewState<readonly string[]> {
  if (callers === null) {
    return empty(
      { label: 'Ver el mapa de rutas', route: MAP_ROUTE },
      'Sin dato: el inventario no pudo cruzar esta ruta con el código del frontend.',
    );
  }
  if (callers.length === 0) {
    return empty(
      { label: 'Ver las rutas sin cliente', route: MAP_ROUTE, queryParams: { senal: 'SIN_CONSUMIDOR_FRONT' } },
      'Ningún cliente del frontend la llama. Puede ser una ruta interna, de otro consumidor o sin uso.',
    );
  }
  return ready(callers);
}

function notInMap(modulo: string): ViewState<readonly string[]> {
  return empty(
    { label: 'Ver el mapa del módulo', route: MAP_ROUTE, queryParams: { modulo } },
    'El mapa de rutas no trae esta operación, así que no se sabe quién la llama.',
  );
}
