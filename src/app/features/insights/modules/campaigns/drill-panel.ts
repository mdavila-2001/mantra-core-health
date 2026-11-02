import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Panel } from '../../components/panel';
import { StatusPill } from '../../components/status-pill';
import {
  DRILL_COLUMNS,
  DRILL_LEVEL_LABELS,
  drillRows,
  eventRows,
  stepLabel,
  viewFor,
  type DrillRow,
  type DrillStep,
} from '../../domain/drill';
import { formatValue } from '../../domain/format';
import type { MetricId } from '../../domain/insights.types';
import { METRIC_CATALOG } from '../../domain/metric-catalog';
import { InsightsContext } from '../../insights-context';

const HEADS: Readonly<Record<string, string>> = {
  spend: 'Inversión',
  impressions: 'Impresiones',
  ctr: 'CTR',
  registrations: 'Registros',
  cpa: 'CPA',
  conversions: 'Conversiones',
  cac: 'CAC',
  roas: 'ROAS',
};

/**
 * Detalle y drill-down: General → Canal → Campaña → Evento.
 *
 * Cada fila baja un nivel y filtra TODA la pantalla (el contexto aplica los pasos). El último
 * nivel no son filas de una dimensión: son los días más atípicos de la métrica activa, con el
 * hito del calendario que los acompañó si lo hubo. El camino vive en la URL (`dr`).
 */
@Component({
  selector: 'app-ins-drill-panel',
  imports: [Panel, StatusPill],
  templateUrl: './drill-panel.html',
  styleUrl: './drill-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrillPanel {
  private readonly ctx = inject(InsightsContext);

  protected readonly columns = DRILL_COLUMNS;
  protected readonly heads = HEADS;
  protected readonly steps = this.ctx.drill;
  protected readonly view = computed(() => viewFor(this.steps()));
  protected readonly metric = computed(() => this.ctx.filter().metric);
  protected readonly metricLabel = computed(() => METRIC_CATALOG[this.metric()].label);

  protected readonly levelName = computed(() => (this.view() === 'ch' ? 'Canal' : this.view() === 'camp' ? 'Campaña' : 'Día'));
  protected readonly rows = computed<DrillRow[]>(() => {
    const v = this.view();
    return v === 'ev' ? [] : drillRows(this.ctx.filter(), v);
  });
  protected readonly events = computed(() => (this.view() === 'ev' ? eventRows(this.ctx.filter()) : []));

  protected readonly crumbs = computed(() => this.steps().map((s, i) => ({ text: `${DRILL_LEVEL_LABELS[s.level]}: ${stepLabel(s)}`, upTo: i + 1 })));

  protected show(row: DrillRow, metric: MetricId): string {
    const v = row.values[metric] ?? null;
    return formatValue(v, METRIC_CATALOG[metric].unit, true);
  }

  protected value(v: number): string {
    return formatValue(v, METRIC_CATALOG[this.metric()].unit);
  }

  protected zText(z: number): string {
    return `${z > 0 ? '+' : '−'}${Math.abs(z).toFixed(1).replace('.', ',')} σ`;
  }

  /** Baja a la fila elegida. En el último nivel no hay nada que abrir. */
  protected open(row: DrillRow): void {
    const v = this.view();
    if (v === 'ev') return;
    const next: DrillStep = { level: v, id: row.id };
    this.ctx.setDrill([...this.steps(), next]);
  }

  protected goTo(count: number): void {
    this.ctx.setDrill(this.steps().slice(0, count));
  }
}
