import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusPill } from '../../components/status-pill';
import { Panel } from '../../components/panel';
import { assess } from '../../domain/benchmarks';
import { CAMPAIGN_BY_ID } from '../../domain/campaigns.data';
import { formatChange, formatMoney, formatPercent, formatValue } from '../../domain/format';
import type { InsightsFilter, MetricId } from '../../domain/insights.types';
import { METRIC_CATALOG } from '../../domain/metric-catalog';
import { pacing } from '../../domain/campaign-analysis';

const ROWS: readonly MetricId[] = ['ctr', 'conversions', 'cpa', 'roas', 'retention'];

/**
 * Objetivo contra resultado, y ritmo de la inversión frente al calendario.
 * Solo existe para una campaña: el objetivo es de cada campaña, y mezclar
 * objetivos de varias produciría un número sin dueño.
 */
@Component({
  selector: 'app-ins-objectives-panel',
  imports: [Panel, StatusPill],
  templateUrl: './objectives-panel.html',
  styleUrl: './objectives-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectivesPanel {
  readonly filter = input.required<InsightsFilter>();

  protected readonly campaign = computed(() => (this.filter().campaignIds.length === 1 ? CAMPAIGN_BY_ID.get(this.filter().campaignIds[0] ?? '') ?? null : null));

  protected readonly rows = computed(() =>
    ROWS.map((m) => {
      const a = assess(this.filter(), m);
      const def = METRIC_CATALOG[m];
      const target = a.target?.value ?? null;
      const actual = a.kpi.value;
      // El cumplimiento se invierte en métricas donde menos es mejor.
      const attain = actual !== null && target ? (def.goodWhen === 'down' ? target / actual : actual / target) : null;
      return { id: m, label: def.label, unit: def.unit, actual, target, attain, status: a.status, reason: a.statusReason, gap: a.kpi.gap?.message ?? null };
    }),
  );

  protected readonly pace = computed(() => {
    const c = this.campaign();
    return c ? pacing(c.id, this.filter()) : null;
  });

  protected readonly budget = computed(() => formatMoney(this.campaign()?.budgetCents ?? 0));
  protected fmt(v: number | null, row: { unit: Parameters<typeof formatValue>[1] }): string { return formatValue(v, row.unit, true); }
  protected pct(n: number): string { return formatPercent(n, 0); }
  protected delta(n: number): string { return formatChange(n - 1); }
  protected readonly paceVerdict = computed(() => {
    const p = this.pace();
    if (!p) return '';
    const ratio = p.elapsedPct > 0 ? p.spentPct / p.elapsedPct : 0;
    return ratio > 1.1 ? 'Se gasta más rápido que el calendario.' : ratio < 0.9 ? 'Se gasta más lento que el calendario: puede quedar presupuesto sin usar.' : 'El gasto va al ritmo del calendario.';
  });
}
