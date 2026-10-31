import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, type Params } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { CAMPAIGNS, CAMPAIGN_BY_ID, CAMPAIGN_CHANNELS } from './domain/campaigns.data';
import { addDays, daysBetween, monthStart, PROTOTYPE_TODAY } from './domain/dates';
import type { Channel, DateRange, InsightsFilter, MetricId, TimeGrain } from './domain/insights.types';
import { CHANNELS, METRIC_IDS } from './domain/insights.types';
import { applyDrill, encodeDrill, parseDrill, type DrillStep } from './domain/drill';

export type PeriodPreset = 'campaign' | '7d' | '30d' | 'month' | 'quarter' | 'custom';

export const PERIOD_LABELS: Readonly<Record<PeriodPreset, string>> = {
  campaign: 'Toda la campaña',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  month: 'Este mes',
  quarter: 'Este trimestre',
  custom: 'Personalizado',
};

export interface InsightsState {
  readonly campaignIds: readonly string[];
  readonly period: PeriodPreset;
  readonly custom: DateRange;
  readonly grain: TimeGrain | 'auto';
  readonly channels: readonly Channel[] | null;
  readonly metric: MetricId;
  readonly compare: readonly string[];
  /** Pasos del drill-down de Campañas (canal → campaña); cada uno filtra toda la pantalla. */
  readonly drill: readonly DrillStep[];
}

const DEFAULT_CAMPAIGN = 'c1';

function list(value: unknown): string[] {
  return typeof value === 'string' && value ? value.split(',').filter(Boolean) : [];
}

export function parseState(query: Params): InsightsState {
  const ids = list(query['c']).filter((id) => CAMPAIGN_BY_ID.has(id));
  const metric = METRIC_IDS.find((m) => m === query['m']) ?? 'ctr';
  const period = (['campaign', '7d', '30d', 'month', 'quarter', 'custom'] as const).find((p) => p === query['p']) ?? 'campaign';
  const channels = list(query['ch']).filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c));
  const grain = (['day', 'week', 'month'] as const).find((g) => g === query['g']) ?? 'auto';
  const valid = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  return {
    campaignIds: ids.length ? ids : [DEFAULT_CAMPAIGN],
    period,
    custom: { from: valid(query['from']) ? query['from'] : '2026-10-01', to: valid(query['to']) ? query['to'] : PROTOTYPE_TODAY },
    grain,
    channels: channels.length ? channels : null,
    metric,
    compare: list(query['cmp']).filter((id) => CAMPAIGN_BY_ID.has(id)),
    drill: parseDrill(query['dr']),
  };
}

export function rangeFor(state: Pick<InsightsState, 'campaignIds' | 'period' | 'custom'>): DateRange {
  const today = PROTOTYPE_TODAY;
  switch (state.period) {
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case 'month':
      return { from: monthStart(today), to: today };
    case 'quarter': {
      const month = Number(today.slice(5, 7));
      const q = Math.floor((month - 1) / 3) * 3 + 1;
      return { from: `${today.slice(0, 4)}-${String(q).padStart(2, '0')}-01`, to: today };
    }
    case 'custom':
      return state.custom.from <= state.custom.to ? state.custom : { from: state.custom.to, to: state.custom.from };
    case 'campaign': {
      const picked = state.campaignIds.flatMap((id) => {
        const found = CAMPAIGN_BY_ID.get(id);
        return found ? [found] : [];
      });
      const from = picked.map((c) => c.startDate).sort()[0] ?? today;
      const end = picked.map((c) => c.endDate).sort().reverse()[0] ?? today;
      return { from, to: end < today ? end : today };
    }
  }
}

export function autoGrain(range: DateRange): TimeGrain {
  const days = daysBetween(range.from, range.to) + 1;
  return days <= 45 ? 'day' : days <= 180 ? 'week' : 'month';
}

/**
 * El contexto de análisis (campaña, periodo, canal, métrica) vive en la URL:
 * se comparte con un enlace, sobrevive a recargar y viaja entre módulos. Un
 * módulo que recibe una alerta o un hallazgo abre con el mismo contexto.
 */
@Injectable()
export class InsightsContext {
  private readonly router = inject(Router);

  private readonly query = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.parseUrl(this.router.url).queryParams),
    ),
    { initialValue: this.router.parseUrl(this.router.url).queryParams },
  );

  readonly state = computed(() => parseState(this.query()));
  readonly range = computed(() => rangeFor(this.state()));
  readonly grain = computed<TimeGrain>(() => {
    const g = this.state().grain;
    return g === 'auto' ? autoGrain(this.range()) : g;
  });
  readonly channels = computed<readonly Channel[]>(() => {
    const picked = this.state().channels;
    const available = new Set(this.state().campaignIds.flatMap((id) => CAMPAIGN_CHANNELS[id] ?? []));
    const base = picked ?? CHANNELS;
    return base.filter((c) => available.has(c));
  });

  /** El filtro del contexto SIN el drill: lo que se está comparando antes de bajar de nivel. */
  readonly baseFilter = computed<InsightsFilter>(() => ({
    campaignIds: this.state().campaignIds,
    range: this.range(),
    grain: this.grain(),
    channels: this.channels(),
    metric: this.state().metric,
  }));

  readonly drill = computed(() => this.state().drill);

  /** El filtro con el drill aplicado: es el que ven los gráficos y los KPI. */
  readonly filter = computed<InsightsFilter>(() => applyDrill(this.baseFilter(), this.drill()));

  readonly campaigns = CAMPAIGNS;

  /** Mezcla cambios en la URL conservando el resto del contexto. */
  update(patch: Partial<Record<'c' | 'p' | 'from' | 'to' | 'g' | 'ch' | 'm' | 'cmp' | 'dr', string | null>>): void {
    void this.router.navigate([], { queryParams: patch, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Baja o sube en el drill-down: deja exactamente estos pasos. */
  setDrill(steps: readonly DrillStep[]): void {
    this.update({ dr: encodeDrill(steps) });
  }

  /** Query para llevar el contexto actual a otro módulo. */
  carry(): Params {
    const s = this.state();
    return {
      c: s.campaignIds.join(','),
      p: s.period,
      ...(s.period === 'custom' ? { from: s.custom.from, to: s.custom.to } : {}),
      ...(s.channels ? { ch: s.channels.join(',') } : {}),
      m: s.metric,
    };
  }
}
