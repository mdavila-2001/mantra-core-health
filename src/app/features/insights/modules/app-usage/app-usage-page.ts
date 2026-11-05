import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { BarChart } from '../../charts/bar-chart';
import type { BarDatum, LineSeries } from '../../charts/chart.types';
import { FunnelChart } from '../../charts/funnel-chart';
import { HeatmapChart, type HeatCell } from '../../charts/heatmap-chart';
import { LineChart } from '../../charts/line-chart';
import { FilterBar } from '../../components/filter-bar';
import { Panel } from '../../components/panel';
import { StatTile } from '../../components/stat-tile';
import { eventTable, featureAdoption, PLATFORM_LABELS, screenTable, SCREEN_HEAT, summarize, usageSeries, type Platform, type UsageSummary } from '../../domain/app-usage';
import { buildCohorts, COHORT_WEEKS } from '../../domain/cohorts';
import { addDays, daysBetween, shortDate } from '../../domain/dates';
import { formatChange, formatInt, formatPercent } from '../../domain/format';
import { CHANNELS } from '../../domain/insights.types';
import { selectFacts } from '../../domain/kpi';
import { downloadCsv } from '../../export-csv';
import { InsightsContext } from '../../insights-context';
import { ScreenHeatMap } from './screen-heat';

/**
 * Módulo 03 · ¿Qué hacen realmente nuestros usuarios dentro de AloVida?
 *
 * Producto, no marketing: actividad, adopción de funciones, dónde se toca y dónde
 * se abandona. Cada bloque separa lo que se ve de lo que se ignora: una función
 * con poca adopción no es un fracaso hasta saber si debería usarla más gente.
 */
@Component({
  selector: 'app-insights-app-usage',
  imports: [ViewStateHost, FilterBar, Panel, StatTile, LineChart, BarChart, FunnelChart, HeatmapChart, ScreenHeatMap, SegmentedControl],
  templateUrl: './app-usage-page.html',
  styleUrl: './app-usage-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppUsagePage {
  protected readonly ctx = inject(InsightsContext);
  protected readonly platform = signal<Platform>('all');
  protected readonly screenId = signal('search');
  protected readonly query = signal('');
  protected readonly sortKey = signal<'count' | 'users' | 'perUser' | 'change'>('count');

  protected readonly platformOptions = (Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => ({ value: p, label: PLATFORM_LABELS[p] }));
  protected readonly screenOptions = SCREEN_HEAT.map((s) => ({ value: s.id, label: s.label }));
  protected readonly range = this.ctx.range;

  protected readonly state = computed<ViewState<UsageSummary>>(() => {
    const s = summarize(this.range(), this.platform());
    return s ? ready(s) : empty({ label: 'Elija un periodo que ya haya transcurrido.' }, 'No hay actividad de la app en este periodo.');
  });
  protected readonly summary = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  private readonly previous = computed(() => {
    const days = daysBetween(this.range().from, this.range().to) + 1;
    return summarize({ from: addDays(this.range().from, -days), to: addDays(this.range().from, -1) }, this.platform());
  });

  protected readonly tiles = computed(() => {
    const s = this.summary();
    const p = this.previous();
    if (!s) return [];
    const d = (now: number, before: number | undefined): string => (before ? formatChange((now - before) / before) : '');
    return [
      { label: 'Usuarios activos por día (DAU)', value: formatInt(s.dau), delta: d(s.dau, p?.dau), good: true, hint: 'Promedio del periodo' },
      { label: 'Activos por semana (WAU)', value: formatInt(s.wau), delta: d(s.wau, p?.wau), good: true, hint: 'Al cierre del periodo' },
      { label: 'Activos por mes (MAU)', value: formatInt(s.mau), delta: d(s.mau, p?.mau), good: true, hint: 'Al cierre del periodo' },
      { label: 'Adherencia (DAU ÷ MAU)', value: formatPercent(s.stickiness), delta: p ? d(s.stickiness, p.stickiness) : '', good: true, hint: 'Qué parte de la base vuelve cada día' },
      { label: 'Sesiones por usuario activo', value: s.sessionsPerUser.toFixed(2).replace('.', ','), delta: d(s.sessionsPerUser, p?.sessionsPerUser), good: true, hint: 'Frecuencia de uso' },
      { label: 'Duración de sesión', value: `${s.avgMinutes.toFixed(1).replace('.', ',')} min`, delta: d(s.avgMinutes, p?.avgMinutes), good: true, hint: 'Promedio del periodo' },
      { label: 'Usuarios nuevos', value: formatInt(s.newUsers), delta: d(s.newUsers, p?.newUsers), good: true, hint: 'Activaciones del embudo' },
      { label: 'Usuarios recurrentes', value: formatPercent(s.returningShare), delta: '', good: true, hint: 'Parte del MAU que no es nueva' },
    ];
  });

  protected readonly series = computed(() => usageSeries(this.range(), this.platform()));
  protected readonly lineLabels = computed(() => this.series().map((d) => shortDate(d.date)));
  protected readonly lineSeries = computed<LineSeries[]>(() => [
    { id: 'dau', label: 'DAU', values: this.series().map((d) => d.dau), color: 1 },
    { id: 'wau', label: 'WAU', values: this.series().map((d) => d.wau), color: 2 },
    { id: 'mau', label: 'MAU', values: this.series().map((d) => d.mau), color: 3 },
  ]);

  protected readonly features = computed(() => featureAdoption(this.range(), this.platform()));
  protected readonly featureBars = computed<BarDatum[]>(() => this.features().map((f) => ({ id: f.id, label: f.label, value: f.adoption, note: `${formatInt(f.users)} usuarios` })));

  protected readonly screen = computed(() => SCREEN_HEAT.find((s) => s.id === this.screenId()) ?? SCREEN_HEAT[0]!);
  protected readonly screens = computed(() => screenTable(this.range(), this.platform()));

  protected readonly flow = computed(() => {
    const s = this.summary();
    const mau = s?.mau ?? 0;
    const steps: [string, string, number][] = [['open', 'Abre la app', 1], ['search', 'Busca un médico', 0.74], ['profile', 'Ve un perfil', 0.52], ['slot', 'Elige un horario', 0.31], ['confirm', 'Confirma la reserva', 0.23]];
    return steps.map(([id, label, share]) => ({ id, label, value: Math.round(mau * share) }));
  });

  protected readonly cohort = computed(() => {
    const cohorts = buildCohorts(selectFacts({ campaignIds: ['c1', 'c2', 'c3', 'c4'], channels: CHANNELS, range: { from: addDays(this.range().to, -62), to: this.range().to } }));
    return {
      rows: cohorts.map((c) => `Sem. ${shortDate(c.weekStart)}`),
      meta: cohorts.map((c) => formatInt(c.size)),
      cols: Array.from({ length: COHORT_WEEKS }, (_, k) => `S${k}`),
      cells: cohorts.map((c) => c.retention.map((v): HeatCell => ({ value: v, note: v === null ? 'Esa semana aún no termina.' : undefined }))),
    };
  });

  protected readonly events = computed(() => {
    const q = this.query().trim().toLowerCase();
    const k = this.sortKey();
    return eventTable(this.range(), this.platform()).filter((e) => !q || `${e.label} ${e.name}`.toLowerCase().includes(q)).sort((a, b) => b[k] - a[k]);
  });

  protected readonly int = formatInt;
  protected readonly pct = formatPercent;
  protected readonly change = formatChange;
  protected setPlatform(v: string): void { this.platform.set(v as Platform); }
  protected setScreen(v: string): void { this.screenId.set(v); }
  protected search(e: Event): void { this.query.set((e.target as HTMLInputElement).value); }
  protected sort(k: 'count' | 'users' | 'perUser' | 'change'): void { this.sortKey.set(k); }
  protected exportCsv(): void {
    downloadCsv('alovida-insights-eventos.csv', ['Evento', 'Código', 'Eventos', 'Usuarios', 'Por usuario', 'Variación'], this.events().map((e) => [e.label, e.name, e.count, e.users, e.perUser.toFixed(2), (e.change * 100).toFixed(1)]));
  }
}
