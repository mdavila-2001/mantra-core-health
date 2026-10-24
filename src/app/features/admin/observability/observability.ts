import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { OpsTrafficClient } from '../../../core/data-access/admin-portal/ops-traffic.client';
import type {
  TrafficBucket,
  TrafficEndpoint,
  TrafficEndpointSort,
  TrafficEndpointsPage,
  TrafficOverview,
  TrafficQuery,
} from '../../../core/data-access/admin-portal/ops-traffic.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, SortState } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { entero, porcentaje } from '../platform/platform-labels';

type Rango = 'hoy' | '24h' | '7d';

/** Una fila de la tabla de endpoints, ya formateada: la tabla sólo la pinta. */
interface FilaEndpoint {
  readonly id: string;
  readonly method: string;
  readonly route: string;
  readonly requests: string;
  readonly failed: string;
  readonly p95: string;
  readonly success: string;
  readonly lastSeen: string;
}

/** Nombre legible de cada limitación que declara el servidor. */
const NO_MEDIDO: Readonly<Record<string, string>> = {
  disabled: 'Medición apagada',
  rejectedBeforeApi: 'Rechazado antes de llegar a la API',
  lastMinuteNotFlushed: 'Último ciclo sin volcar',
  healthchecksExcluded: 'Sondas de salud, documentación y preflight',
  workersNotHttp: 'Workers y jobs',
  unmatchedAggregated: 'Rutas inexistentes (UNMATCHED)',
  percentilesEstimated: 'Percentiles estimados',
};

const ORDENES: ReadonlySet<string> = new Set<TrafficEndpointSort>(['requests', 'failed', 'p95']);

/**
 * Observabilidad de la API: cuántas solicitudes recibió, cuántas salieron bien o
 * mal, qué tan rápido respondió y qué endpoints se tocaron. Cada número lo
 * calcula el servidor sobre una ventana acotada, con su definición; acá sólo se
 * muestra. Lo que la medición no cubre se declara como «no medido», nunca como
 * cero.
 */
@Component({
  selector: 'app-observability',
  imports: [DatePipe, AppButton, Alert, Card, SegmentedControl, Tabs, Tab, DataTable, PageHeader, ViewStateHost],
  templateUrl: './observability.html',
  styleUrl: './observability.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Observability {
  private readonly traffic = inject(OpsTrafficClient);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly entero = entero;
  protected readonly porcentaje = porcentaje;
  protected readonly noMedido = (metric: string): string => NO_MEDIDO[metric] ?? metric;

  protected readonly pestana = signal(0);
  protected readonly rango = signal<Rango>('hoy');
  protected readonly orden = signal<TrafficEndpointSort>('requests');
  protected readonly opcionesRango = [
    { value: 'hoy' as const, label: 'Hoy' },
    { value: '24h' as const, label: '24 h' },
    { value: '7d' as const, label: '7 días' },
  ];

  protected readonly resumen = signal<ViewState<TrafficOverview>>(loading());
  protected readonly endpoints = signal<ViewState<TrafficEndpointsPage>>(loading());

  /** Apagada la medición o sin peticiones, el resumen dice por qué y no pinta ceros. */
  protected readonly estadoResumen = computed<ViewState<TrafficOverview>>(() => {
    const estado = this.resumen();
    if (estado.status !== 'ready') return estado;
    if (estado.data.notMeasured.some((n) => n.metric === 'disabled')) {
      return empty(
        { label: 'Pida a quien opera la API que encienda OBSERVABILITY_HTTP_SLI_ENABLED.' },
        'La medición de peticiones está apagada: no hay datos que mostrar.',
      );
    }
    if (estado.data.measured.requests === 0) {
      return empty({ label: 'Pruebe con una ventana más amplia.' }, 'Todavía no hay peticiones medidas en esta ventana.');
    }
    return estado;
  });

  protected readonly filas = computed<ViewState<readonly FilaEndpoint[]>>(() => {
    const estado = this.endpoints();
    if (estado.status === 'ready' && estado.data.items.length === 0) {
      return empty({ label: 'Pruebe con una ventana más amplia.' }, 'Ningún endpoint recibió peticiones en esta ventana.');
    }
    return mapData(estado, (pagina) => pagina.items.map((e) => this.fila(e)));
  });

  protected readonly columnas: readonly ColumnDef<FilaEndpoint>[] = [
    { key: 'method', header: 'Método', priority: 1 },
    { key: 'route', header: 'Ruta (plantilla)', priority: 1 },
    { key: 'requests', header: 'Solicitudes', priority: 1, align: 'end', sortable: true },
    { key: 'failed', header: 'Fallidas', priority: 2, align: 'end', sortable: true },
    { key: 'p95', header: 'Latencia p95', priority: 2, align: 'end', sortable: true },
    { key: 'success', header: 'Éxito', priority: 3, align: 'end' },
    { key: 'lastSeen', header: 'Último', priority: 3 },
  ];
  protected readonly ordenActual = computed<SortState>(() => ({ key: this.orden(), direction: 'desc' }));
  protected readonly porId = (fila: FilaEndpoint): string => fila.id;
  protected readonly nombreDeFila = (fila: FilaEndpoint): string => `${fila.method} ${fila.route}`;

  /** La barra más alta fija la escala de la serie. */
  protected readonly maximoSerie = computed(() => {
    const s = this.resumen();
    return s.status === 'ready' ? Math.max(1, ...s.data.series.map((p) => p.requests)) : 1;
  });

  constructor() {
    this.cargar();
  }

  /** `hoy` omite `from`: la API arranca la ventana a las 00:00 UTC del día de `to`. */
  private ventana(): TrafficQuery {
    const to = new Date();
    switch (this.rango()) {
      case '24h':
        return { from: new Date(to.getTime() - 24 * 3_600_000).toISOString(), to: to.toISOString(), interval: 'hour' };
      case '7d':
        return { from: new Date(to.getTime() - 7 * 24 * 3_600_000).toISOString(), to: to.toISOString(), interval: 'day' };
      default:
        return { to: to.toISOString(), interval: 'hour' };
    }
  }

  protected cargar(): void {
    const w = this.ventana();
    this.resumen.set(loading());
    this.endpoints.set(loading());
    this.traffic.traffic(w).subscribe({
      next: (r) => this.resumen.set(ready(r)),
      error: (e: unknown) => this.resumen.set(errorToViewState<TrafficOverview>(e)),
    });
    this.traffic.endpoints({ to: w.to, ...(w.from ? { from: w.from } : {}), sort: this.orden(), limit: 50 }).subscribe({
      next: (r) => this.endpoints.set(ready(r)),
      error: (e: unknown) => this.endpoints.set(errorToViewState<TrafficEndpointsPage>(e)),
    });
  }

  protected cambiarRango(r: Rango): void {
    this.rango.set(r);
    this.cargar();
  }

  protected ordenar(sort: SortState): void {
    if (!ORDENES.has(sort.key)) return;
    this.orden.set(sort.key as TrafficEndpointSort);
    this.cargar();
  }

  /** Alto de la barra de una celda de la serie, relativo a la más alta. */
  protected alto(solicitudes: number): string {
    return `${Math.round((solicitudes / this.maximoSerie()) * 100)}%`;
  }

  /** Parte fallida de una barra, relativa a su propia altura. */
  protected parteFallida(solicitudes: number, fallidas: number): string {
    return solicitudes === 0 ? '0%' : `${Math.round((fallidas / solicitudes) * 100)}%`;
  }

  /** Texto equivalente de la serie para quien no ve las barras: cuántas hay y dónde está el pico. */
  protected describirSerie(series: readonly TrafficBucket[]): string {
    if (series.length === 0) return 'Sin intervalos con peticiones.';
    const pico = series.reduce((a, b) => (b.requests > a.requests ? b : a));
    const cuando = new Date(pico.bucket).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    return `${series.length} intervalos. El mayor, ${cuando} UTC, con ${entero(pico.requests)} solicitudes y ${entero(pico.failed4xx + pico.failed5xx)} fallidas.`;
  }

  /** `≥` cuando el percentil cayó en el último corte del histograma. */
  protected milis(valor: number | null, aproximado = false): string {
    if (valor === null) return '—';
    return `${aproximado ? '≥ ' : ''}${valor.toLocaleString('es-BO', { maximumFractionDigits: 1 })} ms`;
  }

  private fila(e: TrafficEndpoint): FilaEndpoint {
    const fallidas = e.failed4xx + e.failed5xx;
    return {
      id: `${e.method} ${e.route}`,
      method: e.method,
      route: e.route,
      requests: entero(e.requests),
      failed: fallidas === 0 ? '0' : `${entero(fallidas)} (${entero(e.failed4xx)} · ${entero(e.failed5xx)})`,
      p95: this.milis(e.latencyMs.p95),
      success: porcentaje(e.requests === 0 ? null : e.succeeded / e.requests),
      lastSeen: new Date(e.lastSeenAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC',
    };
  }
}
