import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { BarDatum, RefLine } from '../../charts/chart.types';
import { BarChart } from '../../charts/bar-chart';
import { Panel } from '../../components/panel';
import { StatusPill } from '../../components/status-pill';
import { shortDate } from '../../domain/dates';
import { formatInt, formatPercent } from '../../domain/format';
import type { DateRange, HealthStatus } from '../../domain/insights.types';
import { PLATFORMS, PLATFORM_NAMES, SOCIAL_METRICS, socialKpi, type Platform } from '../../domain/social';
import { MIN_POSTS_PER_HOUR, performanceBy, performanceByHour, selectPosts, topByEngagement } from '../../domain/social-posts';

const COLUMNS = ['followers', 'growth', 'reach', 'impressions', 'er', 'ctr', 'shares'] as const;

/**
 * Qué formato, qué tema y qué horario conviene repetir, y cómo se comparan las plataformas.
 * Cada tasa es interacciones ÷ impresiones del grupo (no un promedio de tasas). Una hora con
 * menos de tres publicaciones se marca frágil y no se elige como «la mejor».
 */
@Component({
  selector: 'app-ins-posts-analysis',
  imports: [Panel, BarChart, StatusPill],
  templateUrl: './posts-analysis.html',
  styleUrl: './posts-analysis.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostsAnalysis {
  readonly range = input.required<DateRange>();
  readonly platform = input.required<Platform>();

  protected readonly names = PLATFORM_NAMES;
  protected readonly columns = COLUMNS;
  protected readonly metricLabels = SOCIAL_METRICS;
  protected readonly minPerHour = MIN_POSTS_PER_HOUR;

  protected readonly selection = computed(() => selectPosts(this.range(), [this.platform()]));
  protected readonly posts = computed(() => this.selection().posts);
  protected readonly enough = computed(() => this.posts().length >= 3);

  protected readonly ranking = computed(() => topByEngagement(this.posts(), 6));
  protected readonly byFormat = computed<BarDatum[]>(() => performanceBy(this.posts(), 'format').map((r) => ({ id: r.label, label: `${r.label} (${r.n})`, value: r.er })));
  protected readonly byTopic = computed<BarDatum[]>(() => performanceBy(this.posts(), 'topic').map((r) => ({ id: r.label, label: `${r.label} (${r.n})`, value: r.er })));
  protected readonly hours = computed(() => performanceByHour(this.posts()));
  protected readonly hourBars = computed<BarDatum[]>(() => this.hours().rows.map((r) => ({ id: String(r.hour), label: `${String(r.hour).padStart(2, '0')}:00`, value: r.er, note: r.fragile ? `Solo ${r.n} publicaciones: cifra frágil` : undefined })));
  protected readonly average = computed<RefLine | null>(() => (this.hours().average === null ? null : { id: 'avg', label: 'Promedio', value: this.hours().average!, kind: 'benchmark' }));
  protected readonly bestHour = computed(() => {
    const h = this.hours().best;
    return h === null ? null : `${String(h).padStart(2, '0')}:00`;
  });
  protected readonly anyFragile = computed(() => this.hours().rows.some((r) => r.fragile));

  /** Una fila por plataforma con las siete cifras comparables y el estado de la interacción. */
  protected readonly comparison = computed(() =>
    PLATFORMS.map((p) => {
      const cells = COLUMNS.map((m) => socialKpi(p, m, this.range()));
      const er = cells[COLUMNS.indexOf('er')]!;
      return { platform: p, cells, status: er.status as HealthStatus };
    }),
  );

  protected show(value: number | null, metric: string): string {
    if (value === null) return '—';
    const unit = SOCIAL_METRICS[metric]!.unit;
    return unit === 'percent' ? formatPercent(value) : formatInt(value);
  }
  protected pct(v: number): string { return formatPercent(v); }
  protected day(iso: string): string { return shortDate(iso); }
  protected int(v: number): string { return formatInt(v); }
}
