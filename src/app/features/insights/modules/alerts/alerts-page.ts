import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { AlertCard } from '../../components/alert-card';
import { Panel } from '../../components/panel';
import { buildAlerts } from '../../domain/alerts';
import { ALERT_LABELS, type AlertSeverity, type MarketingAlert } from '../../domain/insights.types';
import { INSIGHTS_MODULES } from '../../insights-nav';

type Handled = 'seen' | 'resolved';
const KEY = 'alovida-insights-alert-state';
const SEVERITIES: readonly AlertSeverity[] = ['critical', 'risk', 'anomaly', 'opportunity'];
const ICON = { critical: '■', risk: '▲', anomaly: '◆', opportunity: '●' } as const;

function load(): Readonly<Record<string, Handled>> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, Handled] => e[1] === 'seen' || e[1] === 'resolved'));
  } catch {
    return {};
  }
}

function save(state: Readonly<Record<string, Handled>>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento: el estado de lectura es una conveniencia de este navegador */
  }
}

/**
 * Módulo 08 · Alertas de marketing.
 *
 * Reúne las señales de todos los módulos. «Vista» y «Resuelta» se guardan solo
 * en este navegador: son una ayuda para quien revisa, no un registro de
 * auditoría compartido.
 */
@Component({
  selector: 'app-insights-alerts',
  imports: [ViewStateHost, Panel, Select, AlertCard],
  templateUrl: './alerts-page.html',
  styleUrl: './alerts-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage {
  private readonly all = buildAlerts();
  private readonly handled = signal<Readonly<Record<string, Handled>>>(load());

  protected readonly severity = signal<AlertSeverity | 'all'>('all');
  protected readonly module = signal<string>('all');
  protected readonly show = signal<'open' | 'resolved' | 'all'>('open');
  protected readonly query = signal('');

  protected readonly severities = SEVERITIES;
  protected readonly labels = ALERT_LABELS;
  protected readonly icon = ICON;
  protected readonly moduleOptions: readonly SelectOption<string>[] = [{ value: 'all', label: 'Todos los módulos' }, ...INSIGHTS_MODULES.filter((m) => this.all.some((a) => a.module === m.id)).map((m) => ({ value: m.id, label: m.label }))];
  protected readonly showOptions: readonly SelectOption<string>[] = [{ value: 'open', label: 'Abiertas y vistas' }, { value: 'resolved', label: 'Resueltas (historial)' }, { value: 'all', label: 'Todas' }];

  private readonly withStatus = computed<MarketingAlert[]>(() => this.all.map((a) => ({ ...a, status: this.handled()[a.id] ?? a.status })));
  protected readonly counts = computed(() => {
    const open = this.withStatus().filter((a) => a.status !== 'resolved');
    return SEVERITIES.map((s) => ({ severity: s, count: open.filter((a) => a.severity === s).length }));
  });
  protected readonly resolvedCount = computed(() => this.withStatus().filter((a) => a.status === 'resolved').length);

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.withStatus().filter(
      (a) =>
        (this.severity() === 'all' || a.severity === this.severity()) &&
        (this.module() === 'all' || a.module === this.module()) &&
        (this.show() === 'all' || (this.show() === 'resolved' ? a.status === 'resolved' : a.status !== 'resolved')) &&
        (!q || `${a.title} ${a.what} ${a.source}`.toLowerCase().includes(q)),
    );
  });

  protected readonly state = computed<ViewState<readonly MarketingAlert[]>>(() => {
    const v = this.visible();
    if (v.length > 0) return ready(v);
    return empty({ label: 'Quite un filtro para ver más alertas.' }, this.all.length === 0 ? 'No hay alertas: ninguna señal superó un umbral.' : 'Ninguna alerta coincide con estos filtros.');
  });
  protected readonly cards = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  protected setSeverity(s: AlertSeverity | 'all'): void { this.severity.set(this.severity() === s ? 'all' : s); }
  protected setModule(v: string | null): void { this.module.set(v ?? 'all'); }
  protected setShow(v: string | null): void { this.show.set((v ?? 'open') as 'open' | 'resolved' | 'all'); }
  protected search(e: Event): void { this.query.set((e.target as HTMLInputElement).value); }
  protected mark(id: string, to: Handled | null): void {
    const next = { ...this.handled() };
    if (to === null) delete next[id];
    else next[id] = to;
    this.handled.set(next);
    save(next);
  }
}
