import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { AlertCard } from '../../components/alert-card';
import { Panel } from '../../components/panel';
import { OWNER_LABELS, STATUS_LABELS } from '../../domain/alert-workflow';
import { longDate } from '../../domain/dates';
import type { MarketingAlert } from '../../domain/insights.types';
import { InsightsWorkflow } from '../../insights-workflow';

/** Todas las alertas agrupadas por el día en que se detectaron, la más nueva primero, y los cambios de estado. */
@Component({
  selector: 'app-ins-alerts-timeline',
  imports: [AlertCard, Panel],
  template: `
    <app-ins-panel title="Línea de tiempo" question="¿Qué se detectó cada día y qué se hizo después?">
      @for (g of groups(); track g.day) {
        <section class="tl__day" [attr.aria-label]="g.label">
          <h3 class="tl__h">{{ g.label }}</h3>
          <div class="tl__stack">
            @for (a of g.alerts; track a.id) { <app-ins-alert-card [alert]="a" [compact]="true" /> }
          </div>
        </section>
      } @empty {
        <p class="tl__none">No hay alertas detectadas con las reglas activas.</p>
      }
    </app-ins-panel>
    <app-ins-panel title="Cambios de estado" question="Quién movió qué, y cuándo.">
      @if (changes().length) {
        <ul class="tl__changes">
          @for (c of changes(); track c.key) {
            <li>
              <span class="tl__when">{{ c.when }}</span> · <strong>{{ c.title }}</strong>: {{ c.from }} → {{ c.to }}@if (c.owner) { · responsable: {{ c.owner }} }
            </li>
          }
        </ul>
      } @else {
        <p class="tl__none">Todavía nadie cambió el estado de una alerta.</p>
      }
    </app-ins-panel>
  `,
  styles: `
    :host { display: grid; gap: var(--sp-5); }
    .tl__h { margin: 0 0 var(--sp-2); font-size: var(--fs-body); }
    .tl__day + .tl__day { margin-block-start: var(--sp-4); }
    .tl__stack { display: grid; gap: var(--sp-3); }
    .tl__none { margin: 0; color: var(--text-secondary); }
    .tl__changes { margin: 0; padding-inline-start: var(--sp-5); display: grid; gap: var(--sp-2); }
    .tl__when { color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsTimeline {
  private readonly wf = inject(InsightsWorkflow);
  readonly alerts = input.required<readonly MarketingAlert[]>();

  protected readonly groups = computed(() => {
    const byDay = new Map<string, MarketingAlert[]>();
    for (const a of this.alerts()) {
      const day = a.detectedAt.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), a]);
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, alerts]) => ({ day, label: longDate(day), alerts }));
  });

  protected readonly changes = computed(() => {
    const titles = new Map(this.alerts().map((a) => [a.id, a.title]));
    return Object.values(this.wf.workflow())
      .flatMap((w) => w.transitions.map((t) => ({ w, t })))
      .sort((a, b) => b.t.at.localeCompare(a.t.at))
      .slice(0, 20)
      .map(({ w, t }) => ({
        key: `${w.fingerprint}|${t.at}`,
        when: new Date(t.at).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }),
        title: titles.get(w.fingerprint) ?? w.fingerprint,
        from: t.fromStatus ? STATUS_LABELS[t.fromStatus] : 'Alta',
        to: STATUS_LABELS[t.toStatus],
        owner: t.toOwner ? OWNER_LABELS[t.toOwner] : null,
      }));
  });
}
