import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { LineChart } from '../../charts/line-chart';
import { Sparkline } from '../../components/sparkline';
import { longDate, PROTOTYPE_TODAY, shortDate } from '../../domain/dates';
import { CONFIDENCE_LABELS } from '../../domain/insights.types';
import {
  CATEGORY_LABELS, IMPACT_LABELS, OBSERVATORY, OBSERVATORY_NOTICE, RELEVANCE_LABELS, SCOPE_LABELS, exposureByCategory, filterObservatory, observatoryTrend, scopeOf, sectorTrends,
  type Impact, type ObservatoryCategory, type ObservatoryItem, type ObservatoryOrder, type ObservatoryScope, type Relevance,
} from '../../domain/observatory';
import { INSIGHTS_BASE } from '../../insights-nav';

const QUESTIONS: readonly { key: keyof ObservatoryItem['answers']; label: string }[] = [
  { key: 'happened', label: '¿Qué ocurrió?' },
  { key: 'whyItMatters', label: '¿Por qué importa?' },
  { key: 'whoIsAffected', label: '¿A quién afecta?' },
  { key: 'affectsAlovida', label: '¿Afecta a AloVida?' },
  { key: 'risk', label: '¿Qué riesgo genera?' },
  { key: 'opportunity', label: '¿Qué oportunidad abre?' },
  { key: 'monitor', label: '¿Qué conviene monitorear?' },
];

/**
 * Módulo 07 · Observatorio de salud: contexto del sector que explica la demanda.
 * Cada elemento responde siete preguntas para pasar de «interesante» a decisión.
 */
@Component({
  selector: 'app-insights-observatory',
  imports: [RouterLink, ViewStateHost, SegmentedControl, Sparkline, LineChart],
  templateUrl: './observatory-page.html',
  styleUrl: './observatory-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservatoryPage {
  protected readonly notice = OBSERVATORY_NOTICE;
  protected readonly category = signal<ObservatoryCategory | 'all'>('all');
  protected readonly impact = signal<Impact | 'all'>('all');
  protected readonly scope = signal<ObservatoryScope | 'all'>('all');
  protected readonly minRelevance = signal<Relevance>('low');
  protected readonly order = signal<ObservatoryOrder>('relevance');
  protected readonly query = signal('');
  protected readonly scopeOptions = [{ value: 'all', label: 'Todos' }, ...(Object.keys(SCOPE_LABELS) as ObservatoryScope[]).map((k) => ({ value: k, label: SCOPE_LABELS[k] }))];
  protected readonly relevanceOptions = [{ value: 'low', label: 'Cualquiera' }, { value: 'medium', label: 'Media o alta' }, { value: 'high', label: 'Solo alta' }];
  protected readonly orderOptions = [{ value: 'relevance', label: 'Por relevancia' }, { value: 'date', label: 'Más recientes' }];
  protected readonly scopes = SCOPE_LABELS;
  protected readonly byCategory = exposureByCategory();
  protected readonly trends = (() => {
    const t = sectorTrends(PROTOTYPE_TODAY);
    return { labels: t.labels.map((d) => shortDate(d)), series: t.series.map((s, i) => ({ id: s.id, label: s.label, values: s.values, color: i + 1 })) };
  })();
  protected scopeName(o: ObservatoryItem): string { return SCOPE_LABELS[scopeOf(o)]; }
  protected readonly opened = signal<string | null>(OBSERVATORY[0]?.id ?? null);

  protected readonly categoryOptions = [{ value: 'all', label: 'Todas' }, ...(Object.keys(CATEGORY_LABELS) as ObservatoryCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))];
  protected readonly impactOptions = [{ value: 'all', label: 'Todo' }, ...(Object.keys(IMPACT_LABELS) as Impact[]).map((i) => ({ value: i, label: IMPACT_LABELS[i] }))];

  protected readonly summary = computed(() => (Object.keys(IMPACT_LABELS) as Impact[]).map((i) => ({ impact: i, label: IMPACT_LABELS[i], count: OBSERVATORY.filter((o) => o.impact === i).length })));
  protected readonly items = computed(() => filterObservatory({ category: this.category(), impact: this.impact(), scope: this.scope(), minRelevance: this.minRelevance(), order: this.order(), query: this.query() }).map((o) => ({ ...o, trend: observatoryTrend(o, PROTOTYPE_TODAY).values })));
  protected readonly state = computed<ViewState<number>>(() => (this.items().length ? ready(this.items().length) : empty({ label: 'Quite un filtro para ver más elementos.' }, 'Ningún elemento coincide con estos filtros.')));

  protected readonly questions = QUESTIONS;
  protected readonly categories = CATEGORY_LABELS;
  protected readonly impacts = IMPACT_LABELS;
  protected readonly relevance = RELEVANCE_LABELS;
  protected readonly confidence = CONFIDENCE_LABELS;
  protected readonly date = longDate;
  protected readonly opinionLink = [INSIGHTS_BASE, 'opinion'];

  protected setCategory(v: string): void { this.category.set(v as ObservatoryCategory | 'all'); }
  protected setImpact(v: string): void { this.impact.set(v as Impact | 'all'); }
  protected setScope(v: string): void { this.scope.set(v as ObservatoryScope | 'all'); }
  protected setRelevance(v: string): void { this.minRelevance.set(v as Relevance); }
  protected setOrder(v: string): void { this.order.set(v as ObservatoryOrder); }
  protected search(e: Event): void { this.query.set((e.target as HTMLInputElement).value); }
  protected toggle(id: string): void { this.opened.set(this.opened() === id ? null : id); }
}
