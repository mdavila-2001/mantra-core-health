import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { InsightsAlertStatus, InsightsOwnerTeam } from '../../../../core/data-access/insights/insights.types';
import { INSIGHTS_OWNER_TEAMS } from '../../../../core/data-access/insights/insights.types';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { RouterLink } from '@angular/router';
import { OWNER_LABELS, STATUS_LABELS } from '../../domain/alert-workflow';
import { shortDate } from '../../domain/dates';
import { ALERT_LABELS, CONFIDENCE_LABELS, type MarketingAlert } from '../../domain/insights.types';
import { INSIGHTS_BASE, MODULE_BY_ID } from '../../insights-nav';
import { InsightsWorkflow } from '../../insights-workflow';

/**
 * Gestión de una alerta: qué ocurrió, por qué importa, la causa (siempre como hipótesis), la
 * acción recomendada y la evidencia; y lo que se hace con ella: responsable y estado. Cada cambio
 * se guarda en el API y deja una transición en la línea de tiempo.
 */
@Component({
  selector: 'app-ins-alert-drawer',
  imports: [DrawerPanel, RouterLink],
  templateUrl: './alert-drawer.html',
  styleUrl: './alert-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertDrawer {
  protected readonly wf = inject(InsightsWorkflow);

  readonly alert = input<MarketingAlert | null>(null);
  readonly closed = output<void>();

  protected readonly teams = INSIGHTS_OWNER_TEAMS;
  protected readonly ownerLabels = OWNER_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly typeLabel = computed(() => ALERT_LABELS[this.alert()?.severity ?? 'risk']);
  protected readonly confidence = computed(() => CONFIDENCE_LABELS[this.alert()?.confidence ?? 'medium']);
  protected readonly status = computed(() => this.wf.statusOf(this.alert()?.id ?? ''));
  protected readonly owner = computed(() => this.wf.ownerOf(this.alert()?.id ?? ''));
  protected readonly detected = computed(() => shortDate((this.alert()?.detectedAt ?? '').slice(0, 10)));
  protected readonly link = computed(() => {
    const a = this.alert();
    return a ? { path: [INSIGHTS_BASE, MODULE_BY_ID.get(a.module)?.path ?? 'campaigns'], query: a.query } : null;
  });
  protected readonly history = computed(() => [...(this.wf.workflow()[this.alert()?.id ?? '']?.transitions ?? [])].reverse());

  protected set(status: InsightsAlertStatus): void {
    const a = this.alert();
    if (a) this.wf.setAlert(a, status, this.owner());
  }

  protected setOwner(event: Event): void {
    const a = this.alert();
    const value = (event.target as HTMLSelectElement).value;
    if (a) this.wf.setAlert(a, this.status(), value === '' ? null : (value as InsightsOwnerTeam));
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
