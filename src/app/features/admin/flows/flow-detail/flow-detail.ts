import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { Subscription } from 'rxjs';

import { FlowsClient } from '../../../../core/data-access/admin-portal/flows.client';
import type { BranchQaCase, EndpointContract, FlowBranch, FlowDetail } from '../../../../core/data-access/admin-portal/flows.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { conceptStatus, entero, type Rotulo } from '../../platform/platform-labels';
import { BRANCH_KIND, CONTRACT, veredicto } from '../flows-labels';
import { FlowData } from '../flow-data/flow-data';
import { FlowTree } from '../flow-tree/flow-tree';

interface FilaEndpoint {
  readonly id: string;
  readonly step: string;
  readonly endpoint: string;
  readonly contract: EndpointContract | 'GAP';
  readonly operationId: string;
  readonly cases: string;
  readonly detail: string;
}

interface FilaCaso {
  readonly id: string;
  readonly code: string;
  readonly step: string;
  readonly kind: FlowBranch['kind'];
  readonly request: string;
  readonly expected: string;
  readonly caso: BranchQaCase;
}

interface FilaSinCaso {
  readonly id: string;
  readonly step: string;
  readonly kind: FlowBranch['kind'];
  readonly condition: string;
  readonly reason: string;
}

/**
 * Un flujo: su árbol de decisión, los endpoints que toca (declarados o ausentes
 * del contrato), los casos de prueba de cada rama con su último veredicto y la
 * fuente de la que sale. Todo lo calcula la API; acá sólo se muestra, y lo que
 * el contrato no tiene se dice como tal.
 */
@Component({
  selector: 'app-flow-detail',
  imports: [DatePipe, Badge, Alert, Card, Tabs, Tab, DataTable, PageHeader, ViewStateHost, FlowData, FlowTree],
  templateUrl: './flow-detail.html',
  styleUrl: './flow-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowDetailPage {
  private readonly flows = inject(FlowsClient);
  private readonly route = inject(ActivatedRoute);
  /** El flujo de la ruta. La misma pantalla se reutiliza al pasar de un flujo a otro: se lee en cada cambio. */
  protected readonly flowId = signal(this.route.snapshot.paramMap.get('flowId') ?? '');
  private pedido: Subscription | null = null;
  protected readonly entero = entero;
  protected readonly conceptStatus = conceptStatus;
  protected readonly rotuloContrato = (contract: EndpointContract): Rotulo => CONTRACT[contract];
  protected readonly rotuloRama = (kind: FlowBranch['kind']): Rotulo => BRANCH_KIND[kind];

  protected readonly pestana = signal(0);
  protected readonly flujo = signal<ViewState<FlowDetail>>(loading());
  protected readonly breadcrumbs = computed(() => [
    { label: 'Catálogo de flujos', routerLink: '/superadmin/flows' },
    { label: `Flujo ${this.flowId()}` },
  ]);

  private readonly celdaContrato = viewChild<TemplateRef<{ $implicit: FilaEndpoint }>>('contratoCell');
  private readonly celdaTipo = viewChild<TemplateRef<{ $implicit: FilaCaso | FilaSinCaso }>>('tipoCell');
  private readonly celdaVeredicto = viewChild<TemplateRef<{ $implicit: FilaCaso }>>('veredictoCell');

  protected readonly datos = computed(() => {
    const f = this.flujo();
    return f.status === 'ready' ? f.data : null;
  });

  protected readonly titulo = computed(() => {
    const f = this.datos();
    return f ? `Flujo ${f.id} · ${f.title}` : `Flujo ${this.flowId()}`;
  });

  // ------------------------------------------------------------- endpoints
  protected readonly filasEndpoints = computed<ViewState<readonly FilaEndpoint[]>>(() => {
    const f = this.datos();
    if (!f) return this.flujo() as ViewState<readonly FilaEndpoint[]>;
    const filas = f.nodes
      .filter((n) => n.kind === 'API_CALL')
      .map((n): FilaEndpoint => {
        const casos = n.branches.filter((b) => b.qaCase).length;
        return {
          id: n.id,
          step: n.title,
          endpoint: n.endpoint ? `${n.endpoint.method} ${n.endpoint.path}` : '—',
          contract: n.endpoint ? n.endpoint.contract : 'GAP',
          operationId: n.endpoint?.operationId ?? '—',
          cases: `${casos} de ${n.branches.length}`,
          detail: n.gap ?? '',
        };
      });
    return filas.length === 0
      ? empty({ label: 'Este flujo no llama a la API.' }, 'Ningún paso del flujo es una llamada a la API.')
      : ready(filas);
  });
  protected readonly columnasEndpoints = computed<readonly ColumnDef<FilaEndpoint>[]>(() => [
    { key: 'step', header: 'Paso', priority: 1 },
    { key: 'endpoint', header: 'Método y ruta', priority: 1 },
    { key: 'contract', header: 'Contrato', priority: 1, cell: this.celdaContrato() },
    { key: 'operationId', header: 'Operación', priority: 3 },
    { key: 'cases', header: 'Ramas con caso', priority: 2, align: 'end' },
  ]);

  // ------------------------------------------------------------- casos QA
  protected readonly filasCasos = computed<ViewState<readonly FilaCaso[]>>(() => {
    const f = this.datos();
    if (!f) return this.flujo() as ViewState<readonly FilaCaso[]>;
    const filas = f.nodes.flatMap((n) =>
      n.branches.flatMap((b, i) =>
        b.qaCase
          ? [
              {
                id: `${n.id}-${i}`,
                code: b.qaCase.code,
                step: n.title,
                kind: b.kind,
                request: `${b.qaCase.method} ${b.qaCase.path}`,
                expected: String(b.qaCase.expectedStatus),
                caso: b.qaCase,
              } satisfies FilaCaso,
            ]
          : [],
      ),
    );
    return filas.length === 0
      ? empty({ label: 'Todas las ramas declaran por qué no tienen caso.' }, 'Este flujo no tiene casos de prueba.')
      : ready(filas);
  });
  protected readonly columnasCasos = computed<readonly ColumnDef<FilaCaso>[]>(() => [
    { key: 'code', header: 'Caso', priority: 1 },
    { key: 'kind', header: 'Tipo', priority: 1, cell: this.celdaTipo() as TemplateRef<{ $implicit: FilaCaso }> | undefined },
    { key: 'request', header: 'Petición', priority: 2 },
    { key: 'expected', header: 'Espera', priority: 2, align: 'end' },
    { key: 'veredicto', header: 'Último resultado', priority: 1, cell: this.celdaVeredicto() },
  ]);

  protected readonly filasSinCaso = computed<readonly FilaSinCaso[]>(() => {
    const f = this.datos();
    if (!f) return [];
    return f.nodes.flatMap((n) =>
      n.branches.flatMap((b, i) =>
        b.qaCase ? [] : [{ id: `${n.id}-${i}`, step: n.title, kind: b.kind, condition: b.condition, reason: b.reason ?? 'Sin motivo declarado' }],
      ),
    );
  });
  protected readonly columnasSinCaso = computed<readonly ColumnDef<FilaSinCaso>[]>(() => [
    { key: 'step', header: 'Paso', priority: 1 },
    { key: 'kind', header: 'Tipo', priority: 1, cell: this.celdaTipo() as TemplateRef<{ $implicit: FilaSinCaso }> | undefined },
    { key: 'condition', header: 'Rama', priority: 2 },
    { key: 'reason', header: 'Por qué no tiene caso', priority: 1 },
  ]);

  protected readonly sinCasoEstado = computed<ViewState<readonly FilaSinCaso[]>>(() => ready(this.filasSinCaso()));

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  protected readonly veredicto = veredicto;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pedido?.unsubscribe());
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.flowId.set(params.get('flowId') ?? '');
      this.pestana.set(0);
      this.cargar();
    });
  }

  protected cargar(): void {
    this.pedido?.unsubscribe();
    this.flujo.set(loading());
    this.pedido = this.flows.detail(this.flowId()).subscribe({
      next: (f) => this.flujo.set(ready(f)),
      error: (e: unknown) => this.flujo.set(errorToViewState<FlowDetail>(e)),
    });
  }
}
