import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import type { InsightsAlertSeverity, InsightsChannelKey } from '../../../../core/data-access/insights/insights.types';
import { Panel } from '../../components/panel';
import { ALERT_LABELS } from '../../domain/insights.types';
import { InsightsWorkflow } from '../../insights-workflow';

const SEVERITIES: readonly InsightsAlertSeverity[] = ['critical', 'risk', 'anomaly', 'opportunity'];
const CHANNELS: readonly { id: InsightsChannelKey; label: string }[] = [
  { id: 'app', label: 'En la aplicación' },
  { id: 'mail', label: 'Correo' },
  { id: 'slack', label: 'Slack' },
];

/** Dónde y cuándo quiere enterarse cada persona. El prototipo NO envía nada y lo dice. */
@Component({
  selector: 'app-ins-alerts-notifications',
  imports: [Panel],
  template: `
    @if (prefs(); as p) {
      <app-ins-panel title="Notificaciones" question="¿Dónde quiere enterarse de cada tipo de alerta?">
        <p class="an__warn" role="note">Esta versión de demostración guarda sus preferencias pero no envía ningún aviso por correo ni por Slack.</p>
        <table class="an__table">
          <caption class="an__sr">Canales por tipo de alerta</caption>
          <thead><tr><th scope="col">Tipo</th>@for (c of channels; track c.id) { <th scope="col">{{ c.label }}</th> }</tr></thead>
          <tbody>
            @for (s of severities; track s) {
              <tr>
                <th scope="row">{{ labels[s] }}</th>
                @for (c of channels; track c.id) {
                  <td><input type="checkbox" [checked]="p.matrix[s].includes(c.id)" [disabled]="wf.busy()" [attr.aria-label]="labels[s] + ' por ' + c.label" (change)="toggle(s, c.id, $event)" /></td>
                }
              </tr>
            }
          </tbody>
        </table>
        <fieldset class="an__freq">
          <legend>Frecuencia</legend>
          <label><input type="radio" name="freq" [checked]="p.frequency === 'immediate'" [disabled]="wf.busy()" (change)="frequency('immediate')" /> Inmediata</label>
          <label><input type="radio" name="freq" [checked]="p.frequency === 'daily_digest'" [disabled]="wf.busy()" (change)="frequency('daily_digest')" /> Resumen diario a las {{ p.digestHour }}:00</label>
        </fieldset>
        <label class="an__quiet"><input type="checkbox" [checked]="p.quietExemptCritical" [disabled]="wf.busy()" (change)="exempt($event)" /> No avisar entre {{ p.quietFrom }} y {{ p.quietTo }}, excepto las críticas (hora de La Paz)</label>
      </app-ins-panel>
    }
  `,
  styles: `
    .an__warn { margin: 0 0 var(--sp-3); padding: var(--sp-3); color: var(--st-info-fg); background: var(--st-info-bg); border-radius: var(--r-sm); font-size: var(--fs-caption); }
    .an__table { inline-size: 100%; border-collapse: collapse; }
    .an__table th, .an__table td { padding: var(--sp-2) var(--sp-3); text-align: start; border-block-end: 1px solid var(--border-default); }
    .an__table td { text-align: center; }
    .an__freq { display: grid; gap: var(--sp-2); margin: var(--sp-4) 0 0; padding: 0; border: none; }
    .an__freq legend { padding: 0; font-weight: 600; }
    .an__quiet { display: block; margin-block-start: var(--sp-3); }
    .an__sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
    input:focus-visible { outline: none; box-shadow: var(--focus-ring); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsNotifications {
  protected readonly wf = inject(InsightsWorkflow);
  protected readonly severities = SEVERITIES;
  protected readonly channels = CHANNELS;
  protected readonly labels = ALERT_LABELS;
  protected readonly prefs = computed(() => this.wf.notifications());

  private base() {
    const p = this.wf.notifications()!;
    return { matrix: p.matrix, frequency: p.frequency, digestHour: p.digestHour, quietFrom: p.quietFrom, quietTo: p.quietTo, quietExemptCritical: p.quietExemptCritical };
  }

  protected toggle(severity: InsightsAlertSeverity, channel: InsightsChannelKey, event: Event): void {
    const b = this.base();
    const on = (event.target as HTMLInputElement).checked;
    const current = b.matrix[severity];
    this.wf.saveNotifications({ ...b, matrix: { ...b.matrix, [severity]: on ? [...new Set([...current, channel])] : current.filter((c) => c !== channel) } });
  }

  protected frequency(frequency: 'immediate' | 'daily_digest'): void {
    this.wf.saveNotifications({ ...this.base(), frequency });
  }

  protected exempt(event: Event): void {
    this.wf.saveNotifications({ ...this.base(), quietExemptCritical: (event.target as HTMLInputElement).checked });
  }
}
