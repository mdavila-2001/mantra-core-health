import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { BarChart } from '../../charts/bar-chart';
import type { BarDatum, LineSeries, StackRow, StackSegment } from '../../charts/chart.types';
import { LineChart } from '../../charts/line-chart';
import { ScatterChart, type ScatterPoint } from '../../charts/scatter-chart';
import { StackedChart } from '../../charts/stacked-chart';
import { FilterBar } from '../../components/filter-bar';
import { InsightCard } from '../../components/insight-card';
import { Panel } from '../../components/panel';
import { StatTile } from '../../components/stat-tile';
import { daysBetween, shortDate } from '../../domain/dates';
import { formatChange, formatInt, formatPercent } from '../../domain/format';
import {
  MIN_SENTIMENT, REPRESENTATIVITY_LABELS, departmentTable, formatNet, mediaMentions, mentionsSeries, opinionInsights, previousRange,
  responseQueue, responseStats, searchSignals, select, sentimentSeries, shareOfVoice, sourceBreakdown, summarize, topicTable,
  type OpinionFilter,
} from '../../domain/opinion';
import { KIND_LABELS, SENTIMENT_LABELS, SOURCES, SOURCE_NAMES, TOPICS, type MentionSource, type Sentiment } from '../../domain/opinion.data';
import { InsightsContext } from '../../insights-context';

const TOPIC_NAME = new Map(TOPICS.map((t) => [t.id, t.label]));

/**
 * Módulo 05 · ¿Qué dice la gente, cómo se siente y qué conviene hacer?
 *
 * Aquí sí se interpreta, y por eso cada cifra declara su límite: el sentimiento
 * es una estimación, los departamentos traen su nivel de representatividad y la
 * cuota de voz usa competidores genéricos. Las redes no son una encuesta.
 */
@Component({
  selector: 'app-insights-opinion',
  imports: [ViewStateHost, FilterBar, Panel, Select, SegmentedControl, StatTile, InsightCard, StackedChart, ScatterChart, LineChart, BarChart],
  templateUrl: './opinion-page.html',
  styleUrl: './opinion-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpinionPage {
  protected readonly ctx = inject(InsightsContext);
  protected readonly source = signal<MentionSource | 'all'>('all');
  protected readonly sentimentView = signal<'all' | Sentiment>('all');
  private readonly attended = signal<ReadonlySet<string>>(new Set());

  protected readonly sourceOptions: readonly SelectOption<string>[] = [{ value: 'all', label: 'Todas las fuentes' }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_NAMES[s] }))];
  protected readonly viewOptions = [{ value: 'all', label: 'Todas' }, { value: 'negative', label: 'Negativas' }, { value: 'neutral', label: 'Neutrales' }, { value: 'positive', label: 'Positivas' }];

  protected readonly filter = computed<OpinionFilter>(() => ({ range: this.ctx.range(), sources: this.source() === 'all' ? SOURCES : [this.source() as MentionSource] }));
  protected readonly sentiment = computed(() => summarize(select(this.filter())));
  protected readonly state = computed<ViewState<number>>(() => {
    const n = this.sentiment().n;
    return n === 0 ? empty({ label: 'Amplíe el periodo o elija otra fuente.' }, 'No hay menciones en este periodo y fuente.') : ready(n);
  });
  protected readonly loaded = computed(() => this.state().status === 'ready');

  protected readonly tiles = computed(() => {
    const f = this.filter();
    const s = this.sentiment();
    const prev = summarize(select({ ...f, range: previousRange(f.range) }));
    const q = responseStats(f);
    const negShare = s.n ? s.negative / s.n : 0;
    const prevNeg = prev.n ? prev.negative / prev.n : 0;
    const change = (a: number, b: number) => (b > 0 ? formatChange((a - b) / b) : '');
    return [
      { label: 'Menciones', value: formatInt(s.n), delta: change(s.n, prev.n), good: null, hint: 'En todas las fuentes seleccionadas' },
      { label: 'Sentimiento neto', value: s.net === null ? null : `${formatNet(s.net)} pts`, delta: s.net !== null && prev.net !== null ? `${formatNet(s.net - prev.net)} pts` : '', good: s.net !== null && prev.net !== null ? s.net >= prev.net : null, hint: s.net === null ? `Se calcula con al menos ${MIN_SENTIMENT} menciones.` : 'Positivas menos negativas, sobre el total' },
      { label: 'Menciones negativas', value: s.n ? formatPercent(negShare) : null, delta: prevNeg ? formatChange((negShare - prevNeg) / prevNeg) : '', good: prevNeg ? negShare <= prevNeg : null, hint: `${formatInt(s.negative)} menciones` },
      { label: 'Con respuesta atendida', value: q.rate === null ? null : formatPercent(q.rate), delta: '', good: null, hint: `${formatInt(q.pending)} de ${formatInt(q.needing)} esperan respuesta` },
    ];
  });

  protected readonly insights = computed(() => opinionInsights(this.filter()));

  protected readonly weekly = computed(() => daysBetween(this.ctx.range().from, this.ctx.range().to) > 45);
  protected readonly segments: readonly StackSegment[] = [{ id: 'positive', label: 'Positivo', color: 1 }, { id: 'neutral', label: 'Neutral', color: 6 }, { id: 'negative', label: 'Negativo', color: 3 }];
  protected readonly stackRows = computed<StackRow[]>(() =>
    sentimentSeries(this.filter(), this.weekly()).flatMap((p) => (p.positive === null ? [] : [{ id: p.label, label: shortDate(p.label), values: { positive: p.positive, neutral: p.neutral ?? 0, negative: p.negative ?? 0 } }])),
  );
  protected readonly volume = computed(() => {
    const s = mentionsSeries(this.filter());
    return { labels: s.labels.map((d) => shortDate(d)), series: [{ id: 'm', label: 'Menciones', values: s.values, color: 1 }] as LineSeries[] };
  });

  protected readonly topics = computed(() => topicTable(this.filter()));
  protected readonly topicPoints = computed<ScatterPoint[]>(() => this.topics().flatMap((t) => (t.summary.net === null ? [] : [{ id: t.id, label: t.label, x: t.volume, y: t.summary.net * 100, color: t.emerging ? 3 : 1 }])));
  protected readonly emerging = computed(() => this.topics().filter((t) => t.emerging));

  protected readonly signals = computed(() => searchSignals(this.ctx.range()));
  protected readonly signalLines = computed(() => {
    const dates = mentionsSeries(this.filter()).labels;
    return { labels: dates.map((d) => shortDate(d)), series: this.signals().map((s, i): LineSeries => ({ id: s.id, label: s.label, values: s.values, color: i + 1 })) };
  });

  protected readonly departments = computed(() => departmentTable(this.filter()));
  protected readonly voice = computed(() => shareOfVoice(this.filter()));
  protected readonly voiceBars = computed<BarDatum[]>(() => this.voice().map((v) => ({ id: v.name, label: v.name, value: v.share, color: v.own ? 1 : 6 })));
  protected readonly sources = computed(() => sourceBreakdown(this.filter()));
  protected readonly media = computed(() => mediaMentions(this.filter()));

  protected readonly queue = computed(() => responseQueue(this.filter(), 40).filter((m) => !this.attended().has(m.id) && (this.sentimentView() === 'all' || m.sentiment === this.sentimentView())).slice(0, 10));

  protected readonly int = formatInt;
  protected readonly pct = formatPercent;
  protected readonly net = formatNet;
  protected readonly shortDate = shortDate;
  protected readonly sentimentLabels = SENTIMENT_LABELS;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly sourceNames = SOURCE_NAMES;
  protected readonly representativity = REPRESENTATIVITY_LABELS;
  protected topicName(id: string): string { return TOPIC_NAME.get(id) ?? id; }
  protected setSource(v: string): void { this.source.set(v as MentionSource | 'all'); }
  protected setView(v: string): void { this.sentimentView.set(v as 'all' | Sentiment); }
  protected markAttended(id: string): void { this.attended.update((s) => new Set(s).add(id)); }
  protected change(v: number | null): string { return v === null ? '—' : formatChange(v); }
}
