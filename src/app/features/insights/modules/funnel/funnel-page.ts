import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { FunnelChart } from '../../charts/funnel-chart';
import { HeatmapChart, type HeatCell } from '../../charts/heatmap-chart';
import { FilterBar } from '../../components/filter-bar';
import { InsightCard } from '../../components/insight-card';
import { Panel } from '../../components/panel';
import { StatTile } from '../../components/stat-tile';
import { buildCohorts, COHORT_WEEKS } from '../../domain/cohorts';
import { shortDate } from '../../domain/dates';
import { acquisitionFunnel, formatDuration, funnelByChannel, JOURNEY_SEGMENTS, patientJourney } from '../../domain/funnel';
import { formatChange, formatInt, formatPercent } from '../../domain/format';
import type { Insight } from '../../domain/insights.types';
import { selectFacts } from '../../domain/kpi';
import { confidenceFor } from '../../domain/campaign-insights';
import { campaignName } from '../../domain/campaigns.data';
import { SegmentConversion } from './segment-conversion';
import { InsightsContext } from '../../insights-context';
import { MODULE_BY_ID, INSIGHTS_BASE } from '../../insights-nav';

/**
 * Módulo 02 · ¿Estamos convirtiendo y entregando una buena experiencia?
 *
 * Dos perspectivas relacionadas: el EMBUDO de adquisición (de la impresión a la
 * retención) y el RECORRIDO del paciente (de su registro a su permanencia). La
 * primera mide si la promesa llega; la segunda, si se cumple.
 */
@Component({
  selector: 'app-insights-funnel',
  imports: [ViewStateHost, FilterBar, Panel, FunnelChart, HeatmapChart, StatTile, InsightCard, Tabs, Tab, Select, RouterLink, SegmentConversion],
  templateUrl: './funnel-page.html',
  styleUrl: './funnel-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FunnelPage {
  protected readonly ctx = inject(InsightsContext);
  protected readonly filter = this.ctx.filter;
  protected readonly stageId = signal<string | null>(null);
  protected readonly segment = signal('all');
  protected readonly segmentOptions: readonly SelectOption<string>[] = JOURNEY_SEGMENTS.map((s) => ({ value: s.id, label: s.label }));
  protected readonly campaignsLink = [INSIGHTS_BASE, MODULE_BY_ID.get('campaigns')?.path ?? 'campaigns'];

  protected readonly state = computed<ViewState<ReturnType<typeof acquisitionFunnel>>>(() => {
    if (selectFacts(this.filter()).length === 0) return empty({ label: 'Amplíe el periodo o elija otra campaña.' }, 'No hay datos de embudo para esta selección.');
    return ready(acquisitionFunnel(this.filter()));
  });
  protected readonly model = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly tiles = computed(() => {
    const m = this.model();
    if (!m) return [];
    const by = (id: string) => m.stages.find((s) => s.id === id);
    const reg = by('registrations');
    const act = by('activations');
    const conv = by('conversions');
    const visits = by('visits');
    const activationRate = reg && act && reg.value > 0 ? act.value / reg.value : null;
    const convRate = conv && visits && visits.value >= 500 ? conv.value / visits.value : null;
    return [
      { label: 'Conversión de visita a resultado', value: convRate === null ? null : formatPercent(convRate), hint: `${formatInt(conv?.value ?? 0)} de ${formatInt(visits?.value ?? 0)} visitas`, delta: '' },
      { label: 'Tasa de activación', value: activationRate === null ? null : formatPercent(activationRate), hint: `${formatInt(act?.value ?? 0)} de ${formatInt(reg?.value ?? 0)} registros`, delta: by('activations')?.changeVsPrevious == null ? '' : formatChange(by('activations')!.changeVsPrevious!) },
      { label: 'Abandono del onboarding', value: activationRate === null ? null : formatPercent(1 - activationRate), hint: 'Registrados que no llegan a activarse', delta: '' },
      { label: 'Retención a 7 días', value: m.retention7 ? formatPercent(m.retention7.rate) : null, hint: m.retention7 ? `${formatInt(m.retention7.cohortSize)} usuarios en cohortes observables` : 'Aún no hay cohortes con 7 días', delta: '' },
      { label: 'Rotación (churn) a 7 días', value: m.retention7 ? formatPercent(1 - m.retention7.rate) : null, hint: 'Complemento de la retención', delta: '' },
    ];
  });

  protected readonly insight = computed<Insight | null>(() => {
    const m = this.model();
    if (!m?.worst) return null;
    const conf = confidenceFor(m.stages[2]?.value ?? 0, 14);
    return {
      id: 'worst-stage',
      module: 'funnel',
      title: `La mayor pérdida frente al benchmark está en «${m.worst.label}»`,
      statements: [
        { level: 'observed', text: `La conversión hacia «${m.worst.label}» está ${formatPercent(Math.abs(m.worst.gap))} por debajo de su benchmark histórico.` },
        { level: 'interpretation', text: 'Es el paso donde más personas se pierden respecto a lo habitual; mejorar esa etapa rinde más que empujar más tráfico.' },
        { level: 'hypothesis', text: 'Puede deberse a fricción en esa pantalla o a un cambio en la calidad del tráfico. Compare por canal antes de intervenir.' },
      ],
      confidence: conf.level,
      confidenceFactors: conf.factors,
      trace: { period: `${this.filter().range.from} a ${this.filter().range.to}`, sources: [{ label: this.filter().campaignIds.map(campaignName).join(', '), count: m.measured, unit: 'registros diarios' }], method: 'Brecha de la conversión entre etapas frente al promedio de los 60 días anteriores.' },
      action: { label: 'Ver el costo en Campañas', module: 'campaigns', query: { c: this.filter().campaignIds.join(',') } },
    };
  });

  protected readonly channelRows = computed(() => funnelByChannel(this.filter()));
  protected readonly maxRate = computed(() => Math.max(...this.channelRows().map((r) => r.rate ?? 0), 0.0001));

  protected readonly cohort = computed(() => {
    const cohorts = buildCohorts(selectFacts(this.filter()));
    return {
      rows: cohorts.map((c) => `Sem. ${shortDate(c.weekStart)}`),
      meta: cohorts.map((c) => formatInt(c.size)),
      cols: Array.from({ length: COHORT_WEEKS }, (_, k) => `S${k}`),
      cells: cohorts.map((c) => c.retention.map((v): HeatCell => ({ value: v, note: v === null ? 'Esa semana aún no termina.' : undefined }))),
    };
  });

  protected readonly journey = computed(() => patientJourney(this.filter(), JOURNEY_SEGMENTS.find((s) => s.id === this.segment())?.multiplier ?? 1));
  protected readonly journeyFunnel = computed(() => this.journey().stages.map((s) => ({ id: s.id, label: s.label, value: s.users })));
  protected readonly worstJourney = computed(() => this.journey().stages.filter((s) => s.rate !== null).sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))[0] ?? null);

  protected readonly pct = formatPercent;
  protected readonly int = formatInt;
  protected readonly duration = formatDuration;
  protected setSegment(v: string | null): void { if (v) this.segment.set(v); }
  protected setStage(id: string): void { this.stageId.set(this.stageId() === id ? null : id); }
  protected readonly stageDetail = computed(() => this.journey().stages.find((s) => s.id === this.stageId()) ?? null);
  protected readonly frictionLabel = { low: 'Fricción baja', medium: 'Fricción media', high: 'Fricción alta' } as const;
}
