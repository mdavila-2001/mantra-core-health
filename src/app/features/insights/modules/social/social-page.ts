import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { BarChart } from '../../charts/bar-chart';
import type { BarDatum, LineSeries, RefLine } from '../../charts/chart.types';
import { LineChart } from '../../charts/line-chart';
import { FilterBar } from '../../components/filter-bar';
import { Panel } from '../../components/panel';
import { StatusPill } from '../../components/status-pill';
import { shortDate, daysBetween, addDays } from '../../domain/dates';
import { formatChange, formatValue } from '../../domain/format';
import { PLATFORM_METRICS, PLATFORM_NAMES, PLATFORMS, SOCIAL_METRICS, followersIndex, socialKpi, socialSeries, topPosts, type Platform, type SocialKpi } from '../../domain/social';
import { InsightsContext } from '../../insights-context';
import { PostsAnalysis } from './posts-analysis';

/**
 * Módulo 04 · ¿Qué está pasando objetivamente en nuestras redes?
 *
 * Solo datos: ninguna opinión, ningún sentimiento (eso es el módulo 05). Cada
 * indicador muestra ACTUAL · BENCHMARK · META · VARIACIÓN y dice de qué tipo es
 * cada referencia; la referencia sectorial se declara como no verificada.
 */
@Component({
  selector: 'app-insights-social',
  imports: [ViewStateHost, FilterBar, Panel, SegmentedControl, Select, LineChart, BarChart, StatusPill, PostsAnalysis],
  templateUrl: './social-page.html',
  styleUrl: './social-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialPage {
  protected readonly ctx = inject(InsightsContext);
  protected readonly platform = signal<Platform>('instagram');
  private readonly metricPick = signal<string | null>(null);
  protected readonly postSort = signal<'reach' | 'er' | 'date'>('er');

  protected readonly platformOptions = PLATFORMS.map((p) => ({ value: p, label: PLATFORM_NAMES[p] }));
  protected readonly range = this.ctx.range;

  protected readonly kpis = computed<SocialKpi[]>(() => PLATFORM_METRICS[this.platform()].map((m) => socialKpi(this.platform(), m, this.range())));
  protected readonly state = computed<ViewState<SocialKpi[]>>(() => {
    const k = this.kpis();
    return k.every((x) => x.value === null) ? empty({ label: 'Elija un periodo que ya haya transcurrido.' }, 'No hay datos de la cuenta en este periodo.') : ready(k);
  });
  protected readonly model = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly metric = computed(() => {
    const list = PLATFORM_METRICS[this.platform()];
    const pick = this.metricPick();
    return pick && list.includes(pick) ? pick : list.includes('er') ? 'er' : list[0]!;
  });
  protected readonly metricOptions = computed<readonly SelectOption<string>[]>(() => PLATFORM_METRICS[this.platform()].map((m) => ({ value: m, label: SOCIAL_METRICS[m]!.label, description: SOCIAL_METRICS[m]!.definition })));
  protected readonly metricDef = computed(() => SOCIAL_METRICS[this.metric()]!);

  protected readonly weekly = computed(() => daysBetween(this.range().from, this.range().to) > 45);
  protected readonly evolution = computed(() => {
    const s = socialSeries(this.platform(), this.metric(), this.range(), this.weekly());
    const days = daysBetween(this.range().from, this.range().to) + 1;
    const prev = socialSeries(this.platform(), this.metric(), { from: addDays(this.range().from, -days), to: addDays(this.range().from, -1) }, this.weekly());
    const k = socialKpi(this.platform(), this.metric(), this.range());
    const refs: RefLine[] = [];
    const ratio = this.metricDef().unit === 'percent' || this.metricDef().unit === 'seconds';
    if (k.benchmark && ratio) refs.push({ id: 'bm', label: 'Benchmark', value: k.benchmark.value, kind: 'benchmark' });
    if (k.target && ratio) refs.push({ id: 'tg', label: 'Meta', value: k.target.value, kind: 'target' });
    return {
      labels: s.labels.map((d) => shortDate(d)),
      series: [{ id: this.metric(), label: this.metricDef().label, values: s.values, color: 1 }] as LineSeries[],
      compare: prev.values.some((v) => v !== null) ? s.values.map((_, i) => prev.values[i] ?? null) : null,
      refs,
    };
  });

  protected readonly erBars = computed<BarDatum[]>(() => PLATFORMS.map((p) => { const k = socialKpi(p, 'er', this.range()); return { id: p, label: PLATFORM_NAMES[p], value: k.value, note: k.gap ?? undefined }; }));
  protected readonly erRef = computed<RefLine | null>(() => { const t = socialKpi(this.platform(), 'er', this.range()).target; return t ? { id: 'tg', label: `Meta ${PLATFORM_NAMES[this.platform()]}`, value: t.value, kind: 'target' } : null; });

  protected readonly growth = computed(() => {
    const idx = followersIndex(this.range());
    const first = idx.instagram;
    const days = daysBetween(this.range().from, this.range().to) + 1;
    return {
      labels: Array.from({ length: first.length }, (_, i) => shortDate(addDays(this.range().from, i))).slice(0, days),
      series: PLATFORMS.map((p, i): LineSeries => ({ id: p, label: PLATFORM_NAMES[p], values: idx[p], color: i + 1 })),
    };
  });

  protected readonly posts = computed(() => {
    const k = this.postSort();
    return topPosts(this.range()).sort((a, b) => (k === 'date' ? b.date.localeCompare(a.date) : b[k] - a[k]));
  });

  protected fmt(v: number | null, k: SocialKpi): string { return formatValue(v, k.unit, true); }
  protected delta(c: number | null): string { return c === null ? '' : formatChange(c); }
  protected pctText(n: number): string { return (n * 100).toFixed(1).replace('.', ',') + ' %'; }
  protected readonly names = PLATFORM_NAMES;
  protected readonly shortDate = shortDate;
  protected setPlatform(v: string): void { this.platform.set(v as Platform); this.metricPick.set(null); }
  protected setMetric(v: string | null): void { this.metricPick.set(v); }
  protected sortPosts(k: 'reach' | 'er' | 'date'): void { this.postSort.set(k); }
  protected goodChange(k: SocialKpi): boolean | null { return k.changeVsPrevious === null || Math.abs(k.changeVsPrevious) < 0.005 ? null : k.changeVsPrevious > 0; }
  protected fmtInt(n: number): string { return n.toLocaleString('es-BO'); }
}
