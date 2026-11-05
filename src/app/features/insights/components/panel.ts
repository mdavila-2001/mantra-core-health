import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Card } from '../../../shared/components/molecules/card/card';

/**
 * Panel de análisis: una tarjeta con título, la pregunta de negocio que responde
 * el gráfico (si no responde una, no debería existir) y un espacio para sus
 * controles propios. Los filtros que solo afectan a este panel viven en su
 * cabecera, rotulados, para no confundirlos con los globales.
 */
@Component({
  selector: 'app-ins-panel',
  imports: [Card],
  template: `
    <app-card variant="outlined" padding="md">
      <div card-header class="pn__head">
        <div class="pn__text">
          <h2 class="pn__title">{{ title() }}</h2>
          @if (question()) {
            <p class="pn__q">{{ question() }}</p>
          }
        </div>
        <div class="pn__tools"><ng-content select="[panel-tools]" /></div>
      </div>
      <ng-content />
    </app-card>
  `,
  styles: `
    :host { display: block; min-inline-size: 0; }
    .pn__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
    .pn__text { min-inline-size: 0; flex: 1 1 260px; }
    .pn__title { margin: 0; font-family: var(--font-display); font-size: var(--fs-h3); line-height: var(--lh-h3); font-weight: 500; color: var(--text-primary); }
    .pn__q { margin: 2px 0 0; font-size: var(--fs-caption); line-height: var(--lh-caption); color: var(--text-muted); }
    .pn__tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
  readonly title = input.required<string>();
  readonly question = input('');
}
