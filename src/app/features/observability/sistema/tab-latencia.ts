import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { ObsEndpointsPage, ObsSummary, ObsTimeseries, ObsWindowQuery, SlowRequestsPage } from '@core/data-access/observability/observability.types';
import { formatearValor } from '@core/data-access/reporting/reporting-format';
import { dataOf, empty } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '@shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ObservabilityContextStore } from '../state/observability-context.store';
import { atrasoDeFrescura, WidgetState } from '../state/widget-state';
import { fechaHora, textoDuracion } from './obs-format';
import { specHistogramaLatencia, specLatenciaTiempo, specTopOperaciones } from './obs-mappers';

/** Referencia dibujada en la gráfica de latencia: el umbral de alerta de p95 propuesto en el plan (2 s). */
const UMBRAL_P95_MS = 2000;

interface FilaLenta {
  readonly id: string;
  readonly cuando: string;
  readonly operacion: string;
  readonly estado: string;
  readonly duracion: string;
  readonly sql: string;
  readonly requestId: string;
}

/** Latencia: ¿se degradó?, ¿cuántas peticiones tardan más de un segundo?, ¿dónde?, ¿cuáles exactamente? */
@Component({
  selector: 'app-obs-tab-latencia',
  imports: [ViewStateHost, ChartPanel, DataTable],
  templateUrl: './tab-latencia.html',
  styleUrls: ['./tab-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsTabLatencia {
  private readonly api = inject(ObservabilityClient);
  protected readonly store = inject(ObservabilityContextStore);

  protected readonly tiempo = new WidgetState<{ p95: ObsTimeseries; p99: ObsTimeseries }>();
  protected readonly distribucion = new WidgetState<ObsSummary>();
  protected readonly lentas = new WidgetState<ObsEndpointsPage>();
  protected readonly recientes = new WidgetState<SlowRequestsPage>();

  protected readonly specTiempo = computed(() => {
    const d = dataOf(this.tiempo.state());
    return d === null ? null : specLatenciaTiempo(d.p95, d.p99, this.store.zona(), UMBRAL_P95_MS);
  });
  protected readonly specHisto = computed(() => {
    const d = dataOf(this.distribucion.state());
    return d === null ? null : specHistogramaLatencia(d.latencyBuckets);
  });
  protected readonly specLentas = computed(() => {
    const d = dataOf(this.lentas.state());
    return d === null ? null : specTopOperaciones(d, 'p95');
  });

  protected readonly filas = computed<ViewState<readonly FilaLenta[]>>(() => {
    const s = this.recientes.state();
    if (s.status !== 'ready' && s.status !== 'stale') return s as ViewState<readonly FilaLenta[]>;
    const zona = this.store.zona();
    const items = s.data.items.map((p) => ({
      id: p.id,
      cuando: fechaHora(p.occurredAt, zona),
      operacion: `${p.method} ${p.route}`,
      estado: String(p.httpStatus),
      duracion: textoDuracion(p.durationMs),
      sql: p.sqlCount === null ? 'Sin dato' : `${p.sqlCount} consultas · ${textoDuracion(p.sqlTotalMs)}`,
      requestId: p.requestId,
    }));
    return { ...s, data: items };
  });
  protected readonly columnas: readonly ColumnDef<FilaLenta>[] = [
    { key: 'cuando', header: 'Cuándo', priority: 1 },
    { key: 'operacion', header: 'Operación', priority: 1 },
    { key: 'estado', header: 'Código', priority: 2, align: 'end' },
    { key: 'duracion', header: 'Duración', priority: 1, align: 'end' },
    { key: 'sql', header: 'SQL', priority: 3 },
    { key: 'requestId', header: 'requestId', priority: 2 },
  ];
  protected readonly porId = (f: FilaLenta): string => f.id;
  protected readonly nombreDeFila = (f: FilaLenta): string => `${f.operacion} (${f.duracion})`;
  protected readonly referencia = formatearValor(UMBRAL_P95_MS, { tipo: 'duracion' });

  constructor() {
    effect(() => {
      const q = this.store.consulta();
      this.store.version();
      untracked(() => this.cargar(q));
    });
  }

  protected cargar(q: ObsWindowQuery = this.store.consulta()): void {
    const vacioTiempo = (t: ObsTimeseries) =>
      t.series.every((s) => s.points.every((p) => p.value === null))
        ? empty({ label: 'Amplíe el rango: cada intervalo necesita un mínimo de peticiones para estimar un percentil.' }, 'Ningún intervalo tiene peticiones suficientes para estimar la latencia.')
        : null;
    this.tiempo.cargar(
      forkJoin({
        p95: this.api.timeseries({ ...q, metric: 'latency_p95' }),
        p99: this.api.timeseries({ ...q, metric: 'latency_p99' }),
      }),
      {
        alRecibir: (d) => this.store.publicarFrescura(d.p95.freshness),
        vacio: (d) => vacioTiempo(d.p95),
        atrasado: (d) => atrasoDeFrescura(d.p95.freshness),
      },
    );
    this.distribucion.cargar(this.api.summary(q), {
      vacio: (s) => (s.latencyBuckets === null || (s.kpis.requests.value ?? 0) === 0 ? empty({ label: 'Pruebe con un rango más amplio.' }, 'No hay peticiones en la ventana para armar la distribución.') : null),
      atrasado: (s) => atrasoDeFrescura(s.freshness),
    });
    this.lentas.cargar(this.api.endpoints({ ...q, interval: undefined, sort: 'p95', limit: 10 }), {
      vacio: (p) => (p.items.length === 0 ? empty({ label: 'Pruebe con un rango más amplio.' }, 'Ninguna operación recibió peticiones en la ventana.') : null),
    });
    this.recientes.cargar(this.api.sqlSlow({ ...q, interval: undefined, limit: 10 }), {
      vacio: (p) =>
        p.items.length === 0
          ? empty({ label: 'Pruebe con un rango más amplio.' }, 'No se guardó ninguna petición lenta ni con error en la ventana: sólo se muestrean las que superan el umbral de lentitud.')
          : null,
    });
  }
}
