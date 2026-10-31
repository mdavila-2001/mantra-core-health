import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import type { ChartMilestone, LineSeries } from '../../charts/chart.types';
import { LineChart } from '../../charts/line-chart';
import { AlertCard } from '../../components/alert-card';
import { InsightCard } from '../../components/insight-card';
import { KpiCard } from '../../components/kpi-card';
import { Panel } from '../../components/panel';
import { StatTile } from '../../components/stat-tile';
import { bucketLabel, milestonesOn } from '../../domain/campaign-analysis';
import { formatChange, formatValue } from '../../domain/format';
import {
  HOME_DAYS,
  REPUTATION_DAYS,
  homeFilter,
  homeInsights,
  homeKpis,
  homeMau,
  homeRange,
  homeSideKpis,
  moduleTiles,
  reputation,
  topAlerts,
  type HomeKpi,
  type ModuleTile,
  type Reputation,
} from '../../domain/home';
import { longDate, PROTOTYPE_TODAY } from '../../domain/dates';
import type { Insight, KpiAssessment, MarketingAlert, MetricId } from '../../domain/insights.types';
import { timeSeries } from '../../domain/kpi';
import { METRIC_CATALOG } from '../../domain/metric-catalog';
import { INSIGHTS_BASE, MODULE_BY_ID } from '../../insights-nav';

/** Misma llave que usa el módulo de alertas para recordar lo atendido. */
const ALERT_STATE_KEY = 'alovida-insights-alert-state';

interface SideFigure {
  readonly label: string;
  readonly value: string;
  readonly change: string;
  readonly good: boolean | null;
}

interface HomeModel {
  readonly reputation: Reputation;
  readonly side: readonly SideFigure[];
  readonly kpis: readonly HomeKpi[];
  readonly chart: { readonly labels: string[]; readonly series: LineSeries[]; readonly milestones: ChartMilestone[] };
  readonly alerts: readonly MarketingAlert[];
  readonly insights: readonly Insight[];
  readonly tiles: readonly (ModuleTile & { readonly label: string; readonly link: readonly string[] })[];
}

function handledAlerts(): Record<string, 'seen' | 'resolved'> {
  try {
    const raw = localStorage.getItem(ALERT_STATE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, 'seen' | 'resolved'] => e[1] === 'seen' || e[1] === 'resolved'));
  } catch {
    return {};
  }
}

function side(a: KpiAssessment, label: string, good: 'up' | 'neutral'): SideFigure {
  const unit = METRIC_CATALOG[a.kpi.metric].unit;
  const change = a.changeVsPrevious;
  return {
    label,
    value: formatValue(a.kpi.value, unit),
    change: change === null ? '' : formatChange(change),
    good: change === null || good === 'neutral' ? null : change >= 0,
  };
}

/**
 * Panel general · ¿Qué pasó esta semana y qué conviene mirar hoy?
 *
 * La ventana es fija (los últimos 7 días contra los 7 anteriores) y no depende de los filtros: el
 * panel orienta, no explora. Cada cifra lleva a su módulo con el contexto ya aplicado. Todo sale
 * del mismo dominio que los módulos; aquí no se calcula nada propio.
 */
@Component({
  selector: 'app-insights-home',
  imports: [ViewStateHost, Panel, KpiCard, StatTile, LineChart, AlertCard, InsightCard, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly router = inject(Router);

  protected readonly week = `${longDate(homeRange().from)} — ${longDate(homeRange().to)}`;
  protected readonly asOf = longDate(PROTOTYPE_TODAY);
  protected readonly reputationDays = REPUTATION_DAYS;
  protected readonly homeDays = HOME_DAYS;
  protected readonly base = INSIGHTS_BASE;
  protected readonly alertsLink = [INSIGHTS_BASE, 'alerts'];
  protected readonly opinionLink = [INSIGHTS_BASE, 'opinion'];

  protected readonly state = computed<ViewState<HomeModel>>(() => {
    const kpis = homeKpis();
    if (kpis.every((k) => k.assessment.kpi.value === null)) {
      return empty({ label: 'Espere a que lleguen los datos de la semana o revise las fuentes conectadas.' }, 'Todavía no hay datos de campañas en la última semana.');
    }
    const sideKpis = homeSideKpis();
    const mau = homeMau();
    const filter30 = homeFilter('registrations', 30);
    const points = timeSeries(filter30, 'registrations');
    const tiles = moduleTiles().map((t) => {
      const m = MODULE_BY_ID.get(t.id);
      return { ...t, label: m?.label ?? t.id, link: [INSIGHTS_BASE, m?.path ?? 'home'] as const };
    });
    return ready({
      reputation: reputation(),
      side: [
        side(sideKpis.spend, 'Inversión · 7 días', 'neutral'),
        side(sideKpis.registrations, 'Registros · 7 días', 'up'),
        {
          label: 'Usuarios activos (MAU)',
          value: mau ? mau.value.toLocaleString('es-BO') : 'Sin dato',
          change: mau?.change == null ? '' : formatChange(mau.change),
          good: mau?.change == null ? null : mau.change >= 0,
        },
      ],
      kpis,
      chart: {
        labels: points.map((p) => bucketLabel(p.bucket, 'day')),
        series: [{ id: 'registrations', label: 'Registros por día', values: points.map((p) => p.kpi.value), color: 1 }],
        milestones: milestonesOn(points.map((p) => p.bucket), filter30),
      },
      alerts: topAlerts(handledAlerts()),
      insights: homeInsights(),
      tiles,
    });
  });

  protected readonly model = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  /** Abre Campañas con la métrica elegida, la última semana y todas las campañas. */
  protected openMetric(metric: MetricId): void {
    void this.router.navigate([INSIGHTS_BASE, 'campaigns'], { queryParams: { m: metric, p: '7d', c: homeFilter().campaignIds.join(',') } });
  }

  protected formatDelta(points: number | null): string {
    if (points === null) return '';
    return `${points > 0 ? '+' : points < 0 ? '−' : ''}${Math.abs(points)} pts`;
  }
}
