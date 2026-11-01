import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { ObsTimeseries, ObsWindowQuery, SqlStatementDetail, SqlStatementsPage } from '@core/data-access/observability/observability.types';
import { dataOf, empty } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef, SortState } from '@shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ObservabilityContextStore } from '../state/observability-context.store';
import { atrasoDeFrescura, WidgetState } from '../state/widget-state';
import { fechaHora, textoDuracion, textoEntero, textoPercentil } from './obs-format';
import { specSqlTiempo } from './obs-mappers';

interface FilaSql {
  readonly id: string;
  readonly sentencia: string;
  readonly tabla: string;
  readonly ejecuciones: string;
  readonly total: string;
  readonly p95: string;
  readonly lentas: string;
  readonly fallidas: string;
}

type OrdenSql = 'total_ms' | 'p95' | 'executions' | 'slow';
const ORDEN_DE_COLUMNA: Readonly<Record<string, OrdenSql>> = { total: 'total_ms', p95: 'p95', ejecuciones: 'executions', lentas: 'slow' };
const COLUMNA_DE_ORDEN: Readonly<Record<OrdenSql, string>> = { total_ms: 'total', p95: 'p95', executions: 'ejecuciones', slow: 'lentas' };

/** Consultas SQL: ¿qué sentencia pesa?, ¿quién la dispara? Sin parámetros: sólo la sentencia normalizada y su huella. */
@Component({
  selector: 'app-obs-tab-sql',
  imports: [ViewStateHost, DataTable, ChartPanel, AppButton],
  templateUrl: './tab-sql.html',
  styleUrls: ['./tab-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsTabSql {
  private readonly api = inject(ObservabilityClient);
  protected readonly store = inject(ObservabilityContextStore);

  protected readonly lista = new WidgetState<SqlStatementsPage>();
  protected readonly detalle = new WidgetState<SqlStatementDetail>();
  protected readonly tiempo = new WidgetState<ObsTimeseries>();
  protected readonly orden = signal<OrdenSql>('total_ms');
  protected readonly elegida = signal('');

  protected readonly filas = computed<ViewState<readonly FilaSql[]>>(() => {
    const s = this.lista.state();
    if (s.status !== 'ready' && s.status !== 'stale') return s as ViewState<readonly FilaSql[]>;
    return {
      ...s,
      data: s.data.items.map((i) => ({
        id: i.queryHash,
        sentencia: `${i.statementClass} · ${i.queryHash}`,
        tabla: i.primaryTable ?? 'Sin dato',
        ejecuciones: textoEntero(i.executions),
        total: textoDuracion(i.totalMs),
        p95: textoPercentil(i.latencyMs.p95),
        lentas: textoEntero(i.slowCount),
        fallidas: textoEntero(i.failedCount),
      })),
    };
  });
  protected readonly columnas: readonly ColumnDef<FilaSql>[] = [
    { key: 'sentencia', header: 'Sentencia (clase · huella)', priority: 1 },
    { key: 'tabla', header: 'Tabla', priority: 2 },
    { key: 'ejecuciones', header: 'Ejecuciones', priority: 1, align: 'end', sortable: true },
    { key: 'total', header: 'Tiempo total', priority: 1, align: 'end', sortable: true },
    { key: 'p95', header: 'p95', priority: 2, align: 'end', sortable: true },
    { key: 'lentas', header: 'Lentas', priority: 2, align: 'end', sortable: true },
    { key: 'fallidas', header: 'Fallidas', priority: 3, align: 'end' },
  ];
  protected readonly ordenActual = computed<SortState>(() => ({ key: COLUMNA_DE_ORDEN[this.orden()], direction: 'desc' }));
  protected readonly porId = (f: FilaSql): string => f.id;
  protected readonly nombreDeFila = (f: FilaSql): string => f.sentencia;
  protected readonly datos = computed(() => dataOf(this.detalle.state()));
  protected readonly specTiempo = computed(() => {
    const d = dataOf(this.tiempo.state());
    return d === null ? null : specSqlTiempo(d, this.store.zona());
  });
  protected readonly fecha = (iso: string | null): string => fechaHora(iso, this.store.zona());
  protected readonly duracion = textoDuracion;
  protected readonly entero = textoEntero;
  protected readonly p = textoPercentil;

  constructor() {
    effect(() => {
      const q = this.store.consulta();
      this.store.version();
      const orden = this.orden();
      untracked(() => this.cargar(q, orden));
    });
  }

  protected cargar(q: ObsWindowQuery = this.store.consulta(), orden: OrdenSql = this.orden()): void {
    this.lista.cargar(this.api.sqlStatements({ ...q, interval: undefined, sort: orden, limit: 50 }), {
      alRecibir: (p) => this.store.publicarFrescura(p.freshness),
      vacio: (p) =>
        p.items.length === 0
          ? empty({ label: 'Pruebe con un rango más amplio.' }, 'No se midió ninguna consulta SQL en esta ventana. Sólo se ve el SQL que pasa por el ORM.')
          : null,
      atrasado: (p) => atrasoDeFrescura(p.freshness),
    });
    this.tiempo.cargar(this.api.timeseries({ ...q, metric: 'sql_ms' }), {
      vacio: (t) => (t.series.every((s) => s.points.length === 0) ? empty({ label: 'Pruebe con un rango más amplio.' }, 'No hay consultas medidas en la ventana.') : null),
    });
    const h = this.elegida();
    if (h !== '') this.abrirDetalle(h, q);
  }

  protected ordenar(s: SortState): void {
    const o = ORDEN_DE_COLUMNA[s.key];
    if (o !== undefined) this.orden.set(o);
  }

  protected abrir(f: FilaSql): void {
    this.elegida.set(f.id);
    this.abrirDetalle(f.id, this.store.consulta());
  }

  protected cerrar(): void {
    this.elegida.set('');
    this.detalle.reiniciar();
  }

  private abrirDetalle(hash: string, q: ObsWindowQuery): void {
    this.detalle.cargar(this.api.sqlStatement(hash, { ...q, interval: undefined }));
  }

  protected copiar(texto: string): void {
    void navigator.clipboard?.writeText(texto);
  }
}
