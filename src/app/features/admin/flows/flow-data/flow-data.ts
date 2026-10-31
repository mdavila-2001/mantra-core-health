import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, map, mergeMap, of, from, type Subscription } from 'rxjs';

import type { FlowNode } from '../../../../core/data-access/admin-portal/flows.types';
import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { OperacionDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { groupTables, type TableGroups } from '../../portal/operations/operation-tables';
import { metodoHttp } from '../../portal/portal-labels';
import { portalUrl } from '../../portal/portal-nav';
import { planFlowOperations } from './flow-operations';

/** Cuántas operaciones se piden a la vez: un flujo tiene una decena, no hace falta más. */
const CONCURRENCY = 4;
const OPERATIONS_ROUTE = portalUrl('systems/operations');

/**
 * Los datos que toca cada llamada a la API de un flujo. El catálogo de flujos
 * (`/admin/qa/flows`) no sabe de datos; el inventario del portal sí. Este panel
 * cruza los dos por `operationId`: cada paso declarado se pide a
 * `PortalClient.getOperation()` y se muestran las tablas que escribe y lee. Un
 * paso cuya operación el inventario no tiene se dice como tal, sin inventarle
 * datos. Se pide al abrir la pestaña.
 */
@Component({
  selector: 'app-flow-data',
  imports: [RouterLink, Badge, Link, ViewStateHost],
  templateUrl: './flow-data.html',
  styleUrl: './flow-data.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowData {
  private readonly client = inject(PortalClient);
  readonly nodes = input.required<readonly FlowNode[]>();

  protected readonly plan = computed(() => planFlowOperations(this.nodes()));
  /** Una entrada por `operationId` pedido; mientras no llegó, no está. */
  protected readonly states = signal<ReadonlyMap<string, ViewState<OperacionDetalle>>>(new Map());

  /** Estado del conjunto: vacío si ningún paso se puede cruzar. */
  protected readonly overall = computed<ViewState<readonly string[]>>(() =>
    this.plan().operationIds.length === 0
      ? empty(
          { label: 'Ver las operaciones del inventario', route: OPERATIONS_ROUTE },
          'Ningún paso de este flujo declara una operación del contrato, así que no hay datos que cruzar.',
        )
      : ready(this.plan().operationIds),
  );

  /** Tablas del flujo entero, sólo con las operaciones que ya llegaron. */
  protected readonly flowTables = computed<{ readonly groups: TableGroups; readonly crossed: number } | null>(() => {
    const found = this.plan().operationIds.flatMap((id) => {
      const state = this.states().get(id);
      return state?.status === 'ready' ? [state.data] : [];
    });
    return found.length === 0
      ? null
      : { groups: groupTables(found.flatMap((op) => op.datos)), crossed: found.length };
  });

  protected readonly method = metodoHttp;
  protected readonly operationUrl = (id: string): string => `${OPERATIONS_ROUTE}/${encodeURIComponent(id)}`;
  protected readonly tableUrl = (schema: string, table: string): string =>
    `${portalUrl('catalog/tables')}/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;

  private pending: Subscription[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
    effect(() => {
      const ids = this.plan().operationIds;
      untracked(() => this.loadAll(ids));
    });
  }

  protected stateOf(operationId: string): ViewState<OperacionDetalle> {
    return this.states().get(operationId) ?? loading();
  }

  protected groupsOf(op: OperacionDetalle): TableGroups {
    return groupTables(op.datos);
  }

  protected retry(operationId: string): void {
    this.loadMany([operationId]);
  }

  private loadAll(ids: readonly string[]): void {
    this.cancel();
    this.states.set(new Map());
    this.loadMany(ids);
  }

  private loadMany(ids: readonly string[]): void {
    this.states.update((current) => new Map([...current, ...ids.map((id) => [id, loading()] as const)]));
    const request = from(ids)
      .pipe(
        mergeMap(
          (id) =>
            this.client.getOperation(id).pipe(
              map((op): ViewState<OperacionDetalle> => ready(op)),
              catchError((e: unknown) => of(failure(e, id))),
              map((state) => [id, state] as const),
            ),
          CONCURRENCY,
        ),
      )
      .subscribe(([id, state]) => this.states.update((current) => new Map(current).set(id, state)));
    this.pending.push(request);
  }

  private cancel(): void {
    for (const s of this.pending) s.unsubscribe();
    this.pending = [];
  }
}

/**
 * Que el inventario no tenga la operación no es una falla de red: el id del
 * catálogo de flujos no está en el inventario (desfase, o un alias). Se dice así
 * y se ofrece buscarla a mano.
 */
function failure(error: unknown, operationId: string): ViewState<OperacionDetalle> {
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return empty(
      { label: 'Buscarla en el inventario', route: OPERATIONS_ROUTE, queryParams: { q: operationId } },
      `El inventario no tiene una operación con el id «${operationId}». Puede estar desactualizado respecto de la API.`,
    );
  }
  return errorToViewState<OperacionDetalle>(error);
}
