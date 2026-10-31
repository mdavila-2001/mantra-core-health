import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import type { InsightsAlertRule } from '../../../../core/data-access/insights/insights.types';
import { Panel } from '../../components/panel';
import { ALERT_LABELS } from '../../domain/insights.types';
import { InsightsWorkflow } from '../../insights-workflow';

/**
 * Reglas de detección: encender o apagar cada una y fijar su umbral (1 a 500). El cambio se guarda
 * en el API. Hoy una regla apagada oculta sus alertas; el umbral queda guardado y lo aplicará la
 * detección en el servidor, y la pantalla lo dice.
 */
@Component({
  selector: 'app-ins-alerts-rules',
  imports: [Panel],
  template: `
    <app-ins-panel title="Reglas de detección" question="¿Qué cambio dispara cada alerta? Apague las que no le sirvan.">
      <ul class="ar__list">
        @for (r of wf.rules(); track r.code) {
          <li class="ar__rule" [class.ar__rule--off]="!r.enabled">
            <div class="ar__text">
              <strong>{{ r.name }}</strong>
              <span class="ar__desc">{{ labels[r.severity] }} · {{ r.description }}</span>
            </div>
            <label class="ar__th">
              <span>Umbral ({{ r.unit === 'hours' ? 'h' : '%' }})</span>
              <input type="number" min="1" max="500" [value]="r.threshold" [disabled]="wf.busy()" (change)="threshold(r, $event)" />
            </label>
            <label class="ar__on">
              <input type="checkbox" [checked]="r.enabled" [disabled]="wf.busy()" (change)="toggle(r, $event)" />
              <span>{{ r.enabled ? 'Activa' : 'Apagada' }}</span>
            </label>
          </li>
        } @empty {
          <li class="ar__none">No hay reglas cargadas.</li>
        }
      </ul>
      <p class="ar__note">Una regla apagada oculta sus alertas. El umbral se guarda y lo aplicará la detección del servidor; hasta entonces la pantalla detecta con los umbrales de fábrica.</p>
    </app-ins-panel>
  `,
  styles: `
    .ar__list { display: grid; gap: var(--sp-3); margin: 0; padding: 0; list-style: none; }
    .ar__rule { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: var(--sp-4); align-items: center; padding: var(--sp-3); border: 1px solid var(--border-default); border-radius: var(--r-md); }
    .ar__rule--off { opacity: 0.7; }
    .ar__text { display: grid; gap: var(--sp-1); min-inline-size: 0; }
    .ar__desc, .ar__note, .ar__th span { color: var(--text-secondary); font-size: var(--fs-caption); }
    .ar__th { display: grid; gap: var(--sp-1); }
    .ar__th input { inline-size: 6rem; font: inherit; padding: var(--sp-2); color: var(--text-primary); background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r-sm); }
    .ar__on { display: flex; align-items: center; gap: var(--sp-2); }
    .ar__th input:focus-visible, .ar__on input:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .ar__note { margin: var(--sp-3) 0 0; }
    @media (max-width: 649px) { .ar__rule { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsRules {
  protected readonly wf = inject(InsightsWorkflow);
  protected readonly labels = ALERT_LABELS;

  protected toggle(rule: InsightsAlertRule, event: Event): void {
    this.wf.patchRule(rule.code, { enabled: (event.target as HTMLInputElement).checked });
  }

  protected threshold(rule: InsightsAlertRule, event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(n) && n !== rule.threshold) this.wf.patchRule(rule.code, { threshold: n });
  }
}
