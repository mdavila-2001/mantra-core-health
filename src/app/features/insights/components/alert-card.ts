import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ALERT_LABELS, CONFIDENCE_LABELS, type MarketingAlert } from '../domain/insights.types';
import { INSIGHTS_BASE, MODULE_BY_ID } from '../insights-nav';
import { shortDate } from '../domain/dates';
import { Sparkline } from './sparkline';

const SEVERITY_ICON = { critical: '■', risk: '▲', anomaly: '◆', opportunity: '●' } as const;

/**
 * Alerta de marketing. Dice qué ocurrió, cuándo, qué magnitud, de dónde sale el
 * dato, la posible causa (siempre como hipótesis), el impacto, la confianza y
 * la recomendación, y enlaza al módulo donde se investiga. El nivel se
 * comunica con ícono, texto y color.
 */
@Component({
  selector: 'app-ins-alert-card',
  imports: [RouterLink, Sparkline],
  templateUrl: './alert-card.html',
  styleUrl: './alert-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"al al--" + alert().severity' },
})
export class AlertCard {
  readonly alert = input.required<MarketingAlert>();
  readonly compact = input(false);
  protected readonly labels = ALERT_LABELS;
  protected readonly confidence = CONFIDENCE_LABELS;
  protected readonly icon = computed(() => SEVERITY_ICON[this.alert().severity]);
  protected readonly when = computed(() => shortDate(this.alert().detectedAt));
  protected readonly link = computed(() => [INSIGHTS_BASE, MODULE_BY_ID.get(this.alert().module)?.path ?? 'campaigns']);
  protected readonly moduleName = computed(() => MODULE_BY_ID.get(this.alert().module)?.label ?? '');
}
