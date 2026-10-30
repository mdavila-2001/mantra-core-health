import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { STATUS_ICON } from '../domain/format';
import { HEALTH_LABELS, type HealthStatus } from '../domain/insights.types';

/**
 * Estado de salud de un KPI. El estado se comunica con ícono, texto y color a
 * la vez: nunca solo con color (WCAG 1.4.1). Colores del trío `--st-*`.
 */
@Component({
  selector: 'ins-status',
  template: `<span class="pill" [class]="'pill pill--' + status()"
    ><span class="pill__icon" aria-hidden="true">{{ icon() }}</span>{{ label() }}</span
  >`,
  styleUrl: './status-pill.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPill {
  readonly status = input.required<HealthStatus>();
  readonly short = input(false);
  protected readonly icon = computed(() => STATUS_ICON[this.status()]);
  protected readonly label = computed(() => (this.short() && this.status() === 'insufficient' ? 'Sin evidencia' : HEALTH_LABELS[this.status()]));
}
