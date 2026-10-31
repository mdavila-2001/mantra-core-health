import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { FilterBar } from '../../components/filter-bar';
import { InsightCard } from '../../components/insight-card';
import { KpiCard } from '../../components/kpi-card';
import { assess } from '../../domain/benchmarks';
import { campaignInsights } from '../../domain/campaign-insights';
import { CHANNEL_LABELS } from '../../domain/insights.types';
import type { Insight, KpiAssessment, MetricId } from '../../domain/insights.types';
import { selectFacts, timeSeries } from '../../domain/kpi';
import { InsightsContext } from '../../insights-context';
import { ComparisonPanel } from './comparison-panel';
import { DetailTable } from './detail-table';
import { DimensionPanel } from './dimension-panel';
import { MainAnalysis } from './main-analysis';
import { ObjectivesPanel } from './objectives-panel';
import { TimingPanel } from './timing-panel';

const HEADLINE: readonly MetricId[] = ['reach', 'impressions', 'ctr', 'conversions', 'cac', 'roas'];

interface CampaignsModel {
  readonly kpis: readonly { assessment: KpiAssessment; series: readonly (number | null)[] }[];
  readonly insights: readonly Insight[];
}

/**
 * Módulo 01 · ¿Cómo funcionó nuestra campaña?
 *
 * Tres niveles de lectura: DECISIÓN (los seis indicadores y su estado),
 * EXPLICACIÓN (la evolución, el horario, las piezas y la comparación) y
 * EXPLORACIÓN (la tabla de detalle). Los filtros globales viven en la URL.
 */
@Component({
  selector: 'app-insights-campaigns',
  imports: [ViewStateHost, FilterBar, KpiCard, InsightCard, MainAnalysis, TimingPanel, DimensionPanel, ComparisonPanel, ObjectivesPanel, DetailTable],
  templateUrl: './campaigns-page.html',
  styleUrl: './campaigns-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignsPage {
  protected readonly ctx = inject(InsightsContext);
  protected readonly filter = this.ctx.filter;

  protected readonly state = computed<ViewState<CampaignsModel>>(() => {
    const f = this.filter();
    if (selectFacts(f).length === 0) {
      return empty({ label: 'Amplíe el periodo, cambie de campaña o incluya más canales.' }, 'No hay datos de campañas para esta selección y periodo.');
    }
    return ready({
      kpis: HEADLINE.map((m) => ({ assessment: assess(f, m), series: timeSeries({ ...f, grain: 'day' }, m).map((p) => p.kpi.value) })),
      insights: campaignInsights(f),
    });
  });

  protected readonly model = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly drillChannel = computed(() => {
    const picked = this.ctx.state().channels;
    return picked && picked.length === 1 ? picked[0] ?? null : null;
  });
  protected readonly drillLabel = computed(() => (this.drillChannel() ? CHANNEL_LABELS[this.drillChannel()!] : ''));

  protected setMetric(m: MetricId): void { this.ctx.update({ m }); }
  protected drillTo(channel: string): void { this.ctx.update({ ch: channel }); }
  protected clearDrill(): void { this.ctx.update({ ch: null }); }
}
