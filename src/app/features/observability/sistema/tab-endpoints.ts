import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { EndpointSort, ObsEndpointsPage, ObsModules, ObsWindowQuery } from '@core/data-access/observability/observability.types';
import { dataOf, empty } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef, SortState } from '@shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ObservabilityContextStore } from '../state/observability-context.store';
import { atrasoDeFrescura, WidgetState } from '../state/widget-state';
import { fechaHora, textoDuracion, textoEntero, textoPercentil, textoProporcion } from './obs-format';
import { specTopOperaciones } from './obs-mappers';

interface FilaEndpoint {
  readonly id: string;
  readonly metodo: string;
  readonly ruta: string;
  readonly modulo: string;
  readonly solicitudes: string;
  readonly fallidas: string;
  readonly p95: string;
  readonly p99: string;
  readonly grupos: string;
  readonly ultimo: string;
}

interface FilaModulo {
  readonly id: string;
  readonly modulo: string;
  readonly solicitudes: string;
  readonly fallidas: string;
  readonly tasa5xx: string;
  readonly p95: string;
  readonly grupos: string;
}

const ORDEN_DE_COLUMNA: Readonly<Record<string, EndpointSort>> = { solicitudes: 'requests', fallidas: 'failed', p95: 'p95', p99: 'p99', grupos: 'errorGroups' };
const COLUMNA_DE_ORDEN: Readonly<Record<EndpointSort, string>> = { requests: 'solicitudes', failed: 'fallidas', p95: 'p95', p99: 'p99', errorGroups: 'grupos' };

/** Endpoints: ¿qué operación falla o tarda?, ¿qué parte de la aplicación concentra el problema? */
@Component({
  selector: 'app-obs-tab-endpoints',
  imports: [ViewStateHost, DataTable, ChartPanel],
  templateUrl: './tab-endpoints.html',
  styleUrls: ['./tab-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsTabEndpoints {
  private readonly api = inject(ObservabilityClient);
  protected readonly store = inject(ObservabilityContextStore);

  protected readonly lista = new WidgetState<ObsEndpointsPage>();
  protected readonly modulos = new WidgetState<ObsModules>();
  protected readonly orden = signal<EndpointSort>('requests');

  protected readonly filas = computed<ViewState<readonly FilaEndpoint[]>>(() => {
    const s = this.lista.state();
    if (s.status !== 'ready' && s.status !== 'stale') return s as ViewState<readonly FilaEndpoint[]>;
    const zona = this.store.zona();
    return {
      ...s,
      data: s.data.items.map((e) => ({
        id: `${e.method} ${e.route}`,
        metodo: e.method,
        ruta: e.route,
        modulo: e.moduleCode,
        solicitudes: textoEntero(e.requests),
        fallidas: e.failed4xx + e.failed5xx === 0 ? '0' : `${textoEntero(e.failed4xx + e.failed5xx)} (${textoEntero(e.failed4xx)} · ${textoEntero(e.failed5xx)})`,
        p95: textoPercentil(e.latencyMs.p95),
        p99: textoPercentil(e.latencyMs.p99),
        grupos: textoEntero(e.errorGroupsOpen),
        ultimo: fechaHora(e.lastSeenAt, zona),
      })),
    };
  });
  protected readonly columnas: readonly ColumnDef<FilaEndpoint>[] = [
    { key: 'metodo', header: 'Método', priority: 1 },
    { key: 'ruta', header: 'Ruta (plantilla)', priority: 1 },
    { key: 'modulo', header: 'Módulo', priority: 3 },
    { key: 'solicitudes', header: 'Solicitudes', priority: 1, align: 'end', sortable: true },
    { key: 'fallidas', header: 'Fallidas (4xx · 5xx)', priority: 2, align: 'end', sortable: true },
    { key: 'p95', header: 'p95', priority: 2, align: 'end', sortable: true },
    { key: 'p99', header: 'p99', priority: 3, align: 'end', sortable: true },
    { key: 'grupos', header: 'Errores abiertos', priority: 3, align: 'end', sortable: true },
    { key: 'ultimo', header: 'Último', priority: 3 },
  ];
  protected readonly ordenActual = computed<SortState>(() => ({ key: COLUMNA_DE_ORDEN[this.orden()], direction: 'desc' }));
  protected readonly porId = (f: { id: string }): string => f.id;
  protected readonly nombreEndpoint = (f: FilaEndpoint): string => `${f.metodo} ${f.ruta}`;
  protected readonly nombreModulo = (f: FilaModulo): string => f.modulo;
  protected readonly specTop = computed(() => {
    const d = dataOf(this.lista.state());
    return d === null ? null : specTopOperaciones(d, 'requests');
  });

  protected readonly filasModulos = computed<ViewState<readonly FilaModulo[]>>(() => {
    const s = this.modulos.state();
    if (s.status !== 'ready' && s.status !== 'stale') return s as ViewState<readonly FilaModulo[]>;
    return {
      ...s,
      data: s.data.items.map((m) => ({
        id: m.moduleCode,
        modulo: m.moduleCode,
        solicitudes: textoEntero(m.requests),
        fallidas: `${textoEntero(m.failed4xx + m.failed5xx)} (${textoEntero(m.failed4xx)} · ${textoEntero(m.failed5xx)})`,
        tasa5xx: textoProporcion(m.errorRate),
        p95: textoPercentil(m.latencyMs.p95),
        grupos: textoEntero(m.errorGroupsOpen),
      })),
    };
  });
  protected readonly columnasModulos: readonly ColumnDef<FilaModulo>[] = [
    { key: 'modulo', header: 'Módulo', priority: 1 },
    { key: 'solicitudes', header: 'Solicitudes', priority: 1, align: 'end' },
    { key: 'fallidas', header: 'Fallidas (4xx · 5xx)', priority: 2, align: 'end' },
    { key: 'tasa5xx', header: 'Tasa 5xx', priority: 2, align: 'end' },
    { key: 'p95', header: 'p95', priority: 2, align: 'end' },
    { key: 'grupos', header: 'Errores abiertos', priority: 3, align: 'end' },
  ];
  protected readonly duracion = textoDuracion;

  constructor() {
    effect(() => {
      const q = this.store.consulta();
      this.store.version();
      const orden = this.orden();
      untracked(() => this.cargar(q, orden));
    });
  }

  protected cargar(q: ObsWindowQuery = this.store.consulta(), orden: EndpointSort = this.orden()): void {
    this.lista.cargar(this.api.endpoints({ ...q, interval: undefined, sort: orden, limit: 50 }), {
      alRecibir: (p) => this.store.publicarFrescura(p.freshness),
      vacio: (p) => (p.items.length === 0 ? empty({ label: 'Pruebe con un rango más amplio.' }, 'Ninguna operación recibió peticiones en la ventana.') : null),
      atrasado: (p) => atrasoDeFrescura(p.freshness),
    });
    this.modulos.cargar(this.api.modules({ ...q, interval: undefined }), {
      vacio: (m) => (m.items.length === 0 ? empty({ label: 'Pruebe con un rango más amplio.' }, 'Ningún módulo recibió peticiones en la ventana.') : null),
    });
  }

  protected ordenar(s: SortState): void {
    const o = ORDEN_DE_COLUMNA[s.key];
    if (o !== undefined) this.orden.set(o);
  }
}
