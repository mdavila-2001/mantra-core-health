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
  MapaFila,
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
  nombreDeOperacion,
  operationKindLabel,
  operationOrigin,
  requirementKind,
  revisionInventario,
  riesgo,
} from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pathParamsSignal, patchQuery, paramValue, queryParamsSignal } from '../support/route-query';
import { DecisionTree } from './decision-tree';
import { OperationContract } from './operation-contract';
import { OperationData } from './operation-data';
import { OperationResponses } from './operation-responses';
import { affectedTablesHeadline, operationKind, summarizeAffectedTables } from './operation-tables.model';
import { RequestCycle } from './request-cycle';

const LIST_ROUTE = portalUrl('systems/operations');
/** Las pestañas de la ficha, por su código en `?vista=`. `datos` se conserva: hay enlaces compartidos. */
const VIEWS = ['resumen', 'contrato', 'datos', 'ciclo', 'respuestas', 'acceso', 'pruebas', 'arbol'] as const;

/**
 * La ficha de una operación: qué hace, su contrato, las tablas que afecta, el
 * ciclo de la petición aplicado a ella, con qué responde y quién la llama,
 * quién puede llamarla, qué la prueba y su árbol de decisión. Es una sola
 * tarjeta con pestañas; la pestaña vigente queda en la URL para compartirla.
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
    OperationResponses,
    RequestCycle,
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
  protected readonly kind = operationKindLabel;
  protected readonly requirement = requirementKind;
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
  /** La fila de esta operación en el mapa de rutas: es la que trae `llamadaPor`. */
  protected readonly mapRow = signal<ViewState<MapaFila | null>>(loading());
  protected readonly treeOrNull = computed(() => {
    const t = this.tree();
    return t.status === 'ready' ? t.data : null;
  });
  protected readonly kindCode = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? operationKind(s.data) : 'SIN_DATO';
  });
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
    this.mapRow.set(loading());
    this.pending = [
      this.client.getOperation(id).subscribe({
        next: (op) => {
          this.detail.set(ready(op));
          this.loadMapRow(op);
        },
        error: (e: unknown) => this.detail.set(errorToViewState<OperacionDetalle>(e)),
      }),
      this.client.getOperationTree(id).subscribe({
        next: (arbol) => this.tree.set(ready(arbol)),
        error: (e: unknown) => this.tree.set(treeFailure(e, `${LIST_ROUTE}/${encodeURIComponent(id)}`)),
      }),
    ];
  }

  /**
   * `llamadaPor` no viene en la ficha sino en el mapa de rutas; se busca la
   * fila por la ruta y se queda con la de este id. Que falle no tumba la ficha:
   * la pestaña «Respuestas» dice «sin dato».
   */
  private loadMapRow(op: OperacionDetalle): void {
    this.pending.push(
      this.client.routeMap({ q: op.ruta, limit: 200 }).subscribe({
        next: (page) => this.mapRow.set(ready(page.items.find((row) => row.id === op.id) ?? null)),
        error: (e: unknown) => this.mapRow.set(errorToViewState<MapaFila | null>(e)),
      }),
    );
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

/** `Controlador_metodo` → controlador y función; el DTO no los trae aparte (doc 02 §4.2). */
function controllerOf(id: string): string | null {
  const i = id.indexOf('_');
  return i > 0 ? id.slice(0, i) : null;
}

function summaryFacts(op: OperacionDetalle): readonly Hecho[] {
  const tables = summarizeAffectedTables(op.datos);
  return [
    { etiqueta: 'Módulo', valor: op.modulo },
    { etiqueta: 'Bloque', valor: op.bloque },
    { etiqueta: 'Controlador', valor: controllerOf(op.id) },
    { etiqueta: 'Función', valor: nombreDeOperacion(op.id) },
    { etiqueta: 'Código', valor: op.codigo },
    { etiqueta: 'Tipo', valor: operationKindLabel(operationKind(op)).label },
    { etiqueta: 'Tablas afectadas', valor: op.datos.length > 0 ? affectedTablesHeadline(tables.counts) : (op.sinTablas ? `No toca tablas: ${op.sinTablas}` : 'Sin dato') },
    { etiqueta: 'Autenticación', valor: op.publica ? 'Pública (no exige sesión)' : op.roles.length > 0 ? `Sesión con rol: ${op.roles.join(', ')}` : 'Sesión válida, sin roles declarados' },
    { etiqueta: 'Eventos que emite', valor: op.eventos.length > 0 ? op.eventos.join(', ') : 'Ninguno' },
    { etiqueta: 'Contrato', valor: operationOrigin(op.origen).label },
    { etiqueta: 'Revisión', valor: revisionInventario(op.revision).label },
    { etiqueta: 'Datos personales', valor: datosPersonales(op.datosPersonales).label },
  ];
}
