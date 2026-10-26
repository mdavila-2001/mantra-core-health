import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type {
  Arbol,
  OperacionDetalle,
} from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  datosPersonales,
  metodoHttp,
  operationOrigin,
  revisionInventario,
  riesgo,
} from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pathParamsSignal, patchQuery, paramValue, queryParamsSignal } from '../support/route-query';
import { DecisionTree } from './decision-tree';
import { OperationContract } from './operation-contract';
import { OperationData } from './operation-data';

const LIST_ROUTE = portalUrl('systems/operations');
/** Las pestañas de la ficha, por su código en `?vista=`. */
const VIEWS = ['resumen', 'contrato', 'datos', 'acceso', 'pruebas', 'arbol'] as const;

/**
 * La ficha de una operación: qué hace, su contrato, qué datos toca, quién puede
 * llamarla, qué la prueba y su árbol de decisión. Es una sola tarjeta con
 * pestañas; la pestaña vigente queda en la URL para poder compartirla.
 */
@Component({
  selector: 'app-portal-operation-detail-page',
  imports: [
    RouterLink,
    Badge,
    BackLink,
    Link,
    Card,
    FactList,
    Tab,
    Tabs,
    PageHeader,
    ViewStateHost,
    DecisionTree,
    OperationContract,
    OperationData,
  ],
  templateUrl: './operation-detail-page.html',
  styleUrl: './operation-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationDetailPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly listUrl = LIST_ROUTE;
  protected readonly method = metodoHttp;
  protected readonly risk = riesgo;
  protected readonly processUrl = (code: string): string =>
    `${portalUrl('processes')}/${encodeURIComponent(code)}`;
  protected readonly tableUrl = (schema: string, table: string): string =>
    `${portalUrl('catalog/tables')}/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;

  private readonly id = paramValue(pathParamsSignal(this.route), 'id');
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly detail = signal<ViewState<OperacionDetalle>>(loading());
  protected readonly tree = signal<ViewState<Arbol>>(loading());
  protected readonly title = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? (s.data.nombre ?? `${s.data.metodo} ${s.data.ruta}`) : 'Operación';
  });
  protected readonly facts = computed<readonly Hecho[]>(() => {
    const s = this.detail();
    return s.status === 'ready' ? summaryFacts(s.data) : [];
  });

  private pending: Subscription[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected reload(): void {
    this.load(this.id());
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  private load(id: string): void {
    this.cancel();
    this.detail.set(loading());
    this.tree.set(loading());
    this.pending = [
      this.client.getOperation(id).subscribe({
        next: (op) => this.detail.set(ready(op)),
        error: (e: unknown) => this.detail.set(errorToViewState<OperacionDetalle>(e)),
      }),
      this.client.getOperationTree(id).subscribe({
        next: (arbol) => this.tree.set(ready(arbol)),
        error: (e: unknown) => this.tree.set(treeFailure(e, `${LIST_ROUTE}/${encodeURIComponent(id)}`)),
      }),
    ];
  }

  private cancel(): void {
    for (const s of this.pending) s.unsubscribe();
    this.pending = [];
  }
}

/**
 * Que una operación no tenga árbol no es un error: el generador no lo armó (por
 * ejemplo, un controlador sin cuerpo que recorrer). Se dice así, no como un 404.
 */
function treeFailure(error: unknown, detailUrl: string): ViewState<Arbol> {
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return empty(
      { label: 'Ver el contrato de la operación', route: detailUrl, queryParams: { vista: 'contrato' } },
      'El inventario no trae un árbol de decisión para esta operación.',
    );
  }
  return errorToViewState<Arbol>(error);
}

function summaryFacts(op: OperacionDetalle): readonly Hecho[] {
  return [
    { etiqueta: 'Módulo', valor: op.modulo },
    { etiqueta: 'Bloque', valor: op.bloque },
    { etiqueta: 'Contrato', valor: operationOrigin(op.origen).label },
    { etiqueta: 'Revisión', valor: revisionInventario(op.revision).label },
    { etiqueta: 'Datos personales', valor: datosPersonales(op.datosPersonales).label },
    { etiqueta: 'Código', valor: op.codigo },
  ];
}
