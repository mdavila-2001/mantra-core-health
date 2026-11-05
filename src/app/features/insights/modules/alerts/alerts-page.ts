import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import type { InsightsAlertStatus } from '../../../../core/data-access/insights/insights.types';
import { INSIGHTS_OWNER_TEAMS } from '../../../../core/data-access/insights/insights.types';
import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import type { StackRow, StackSegment } from '../../charts/chart.types';
import { StackedChart } from '../../charts/stacked-chart';
import { AlertCard } from '../../components/alert-card';
import { Panel } from '../../components/panel';
import { buildAlerts } from '../../domain/alerts';
import { isOpen, OWNER_LABELS, STATUS_LABELS, visibleByRules } from '../../domain/alert-workflow';
import { addDays, PROTOTYPE_TODAY, shortDate } from '../../domain/dates';
import { ALERT_LABELS, type AlertSeverity, type MarketingAlert } from '../../domain/insights.types';
import { INSIGHTS_MODULES } from '../../insights-nav';
import { InsightsWorkflow } from '../../insights-workflow';
import { AlertDrawer } from './alert-drawer';
import { AlertsNotifications } from './alerts-notifications';
import { AlertsRules } from './alerts-rules';
import { AlertsTimeline } from './alerts-timeline';

type Tab = 'inbox' | 'timeline' | 'rules' | 'notifications';
const SEVERITIES: readonly AlertSeverity[] = ['critical', 'risk', 'anomaly', 'opportunity'];
const ICON = { critical: '■', risk: '▲', anomaly: '◆', opportunity: '●' } as const;
const SEGMENTS: readonly StackSegment[] = SEVERITIES.map((s, i) => ({ id: s, label: ALERT_LABELS[s], color: i + 1 }));

/**
 * Módulo 08 · Alertas de marketing.
 *
 * La detección es del dominio (a partir de los hechos); el estado y el responsable de cada alerta,
 * las reglas y las preferencias de aviso se guardan en el API (`InsightsWorkflow`). Una regla
 * apagada oculta sus alertas. Ningún aviso se envía en esta versión de demostración.
 */
@Component({
  selector: 'app-insights-alerts',
  imports: [ViewStateHost, Panel, Select, SegmentedControl, StackedChart, AlertCard, AlertDrawer, AlertsTimeline, AlertsRules, AlertsNotifications],
  templateUrl: './alerts-page.html',
  styleUrl: './alerts-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage {
  protected readonly wf = inject(InsightsWorkflow);
  private readonly all = buildAlerts();

  protected readonly tab = signal<Tab>('inbox');
  protected readonly severity = signal<AlertSeverity | 'all'>('all');
  protected readonly module = signal<string>('all');
  protected readonly status = signal<string>('open');
  protected readonly owner = signal<string>('all');
  protected readonly sort = signal<'priority' | 'date'>('priority');
  protected readonly query = signal('');
  protected readonly selected = signal<MarketingAlert | null>(null);

  protected readonly severities = SEVERITIES;
  protected readonly labels = ALERT_LABELS;
  protected readonly icon = ICON;
  protected readonly segments = SEGMENTS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly tabOptions = [
    { value: 'inbox', label: 'Bandeja' },
    { value: 'timeline', label: 'Línea de tiempo' },
    { value: 'rules', label: 'Reglas' },
    { value: 'notifications', label: 'Notificaciones' },
  ];
  protected readonly moduleOptions: readonly SelectOption<string>[] = [{ value: 'all', label: 'Todos los módulos' }, ...INSIGHTS_MODULES.filter((m) => this.all.some((a) => a.module === m.id)).map((m) => ({ value: m.id, label: m.label }))];
  protected readonly statusOptions: readonly SelectOption<string>[] = [
    { value: 'open', label: 'Abiertas (sin resolver)' },
    { value: 'all', label: 'Todas' },
    ...(['new', 'in_progress', 'resolved', 'dismissed'] as const).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];
  protected readonly ownerOptions: readonly SelectOption<string>[] = [
    { value: 'all', label: 'Todos los responsables' },
    { value: 'none', label: 'Sin asignar' },
    ...INSIGHTS_OWNER_TEAMS.map((t) => ({ value: t, label: OWNER_LABELS[t] })),
  ];
  protected readonly sortOptions: readonly SelectOption<string>[] = [{ value: 'priority', label: 'Prioridad' }, { value: 'date', label: 'Más recientes' }];

  /** Las alertas que las reglas activas dejan ver. */
  protected readonly detected = computed(() => visibleByRules(this.all, this.wf.rules()));
  private readonly withStatus = computed(() => this.detected().map((a) => ({ alert: a, status: this.wf.statusOf(a.id), owner: this.wf.ownerOf(a.id) })));

  protected readonly counts = computed(() => {
    const open = this.withStatus().filter((r) => isOpen(r.status));
    return SEVERITIES.map((s) => ({ severity: s, count: open.filter((r) => r.alert.severity === s).length, fresh: open.filter((r) => r.alert.severity === s && r.status === 'new').length }));
  });
  protected readonly openCount = computed(() => this.withStatus().filter((r) => isOpen(r.status)).length);
  protected readonly resolvedCount = computed(() => this.withStatus().filter((r) => r.status === 'resolved').length);

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.withStatus().filter(
      (r) =>
        (this.severity() === 'all' || r.alert.severity === this.severity()) &&
        (this.module() === 'all' || r.alert.module === this.module()) &&
        (this.status() === 'all' || (this.status() === 'open' ? isOpen(r.status) : r.status === (this.status() as InsightsAlertStatus))) &&
        (this.owner() === 'all' || (this.owner() === 'none' ? r.owner === null : r.owner === this.owner())) &&
        (!q || `${r.alert.title} ${r.alert.what} ${r.alert.source}`.toLowerCase().includes(q)),
    );
    const bySeverity = (a: MarketingAlert) => SEVERITIES.indexOf(a.severity);
    return rows.sort((a, b) => (this.sort() === 'priority' ? bySeverity(a.alert) - bySeverity(b.alert) || b.alert.detectedAt.localeCompare(a.alert.detectedAt) : b.alert.detectedAt.localeCompare(a.alert.detectedAt) || bySeverity(a.alert) - bySeverity(b.alert)));
  });

  protected readonly state = computed<ViewState<readonly { alert: MarketingAlert; status: InsightsAlertStatus; owner: string | null }[]>>(() => {
    const v = this.visible();
    if (v.length > 0) return ready(v);
    return empty({ label: 'Quite un filtro para ver más alertas.' }, this.detected().length === 0 ? 'No hay alertas: ninguna señal superó un umbral de una regla activa.' : 'Ninguna alerta coincide con estos filtros.');
  });
  protected readonly cards = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  /** Alertas detectadas por día en las últimas dos semanas, por nivel. */
  protected readonly lastDays = computed<StackRow[]>(() =>
    Array.from({ length: 14 }, (_, i) => addDays(PROTOTYPE_TODAY, i - 13)).map((day) => ({
      id: day,
      label: shortDate(day),
      values: Object.fromEntries(SEVERITIES.map((s) => [s, this.detected().filter((a) => a.detectedAt.slice(0, 10) === day && a.severity === s).length])),
    })),
  );

  protected setTab(v: string | null): void { this.tab.set((v ?? 'inbox') as Tab); }
  protected setSeverity(s: AlertSeverity | 'all'): void { this.severity.set(this.severity() === s ? 'all' : s); }
  protected setModule(v: string | null): void { this.module.set(v ?? 'all'); }
  protected setStatus(v: string | null): void { this.status.set(v ?? 'open'); }
  protected setOwner(v: string | null): void { this.owner.set(v ?? 'all'); }
  protected setSort(v: string | null): void { this.sort.set((v ?? 'priority') as 'priority' | 'date'); }
  protected search(e: Event): void { this.query.set((e.target as HTMLInputElement).value); }
  protected ownerName(o: string | null): string { return o ? (OWNER_LABELS as Record<string, string>)[o] ?? o : 'Sin asignar'; }
}
