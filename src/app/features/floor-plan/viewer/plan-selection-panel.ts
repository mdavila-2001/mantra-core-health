import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { PlanCardModel } from '../../../core/floor-plan/card-model';
import type { SpaceView } from '../../../core/floor-plan/plan-view';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { PlanSpaceCard } from '../../../shared/components/molecules/plan-space-card/plan-space-card';

/**
 * Panel de selección (CONTRATO-PLANO §5.2): la misma información que la tarjeta
 * —todo lo que muestra la tarjeta existe también acá— más los hijos y el botón
 * «Abrir ficha completa». Presentacional.
 */
@Component({
  selector: 'app-plan-selection-panel',
  imports: [AppButton, PlanSpaceCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: grid; gap: var(--sp-3); align-content: start; }
    .panel__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
    .panel__title { margin: 0; font-size: var(--fs-overline); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary); font-weight: 700; }
    .panel__children { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-1); }
    .panel__child { width: 100%; text-align: left; min-height: 36px; padding: var(--sp-1) var(--sp-2); border: 1px solid var(--border-default); border-radius: var(--r-sm); background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
    .panel__child:hover { background: var(--bg-hover); }
    .panel__child:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 1px; }
    .panel__muted { margin: 0; color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
  template: `
    <div class="panel__head">
      <h2 class="panel__title">Espacio seleccionado</h2>
      <button app-button size="sm" variant="outline" type="button" data-testid="plan-selection-close" (clicked)="closed.emit()">Quitar selección</button>
    </div>
    <app-plan-space-card [model]="model()" [inline]="true" cardId="plan-selection-card" />
    @if (children().length > 0) {
      <section aria-label="Espacios que contiene">
        <h3 class="panel__title">Contiene</h3>
        <ul class="panel__children">
          @for (child of children(); track child.id) {
            <li><button type="button" class="panel__child" (click)="pickChild.emit(child.id)">{{ child.name }}</button></li>
          }
        </ul>
      </section>
    }
    @if (canOpenFile() && model().inScope) {
      <button app-button variant="primary" type="button" data-testid="plan-open-file" (clicked)="openFile.emit()">Abrir ficha completa</button>
    } @else {
      <p class="panel__muted">La ficha completa no está disponible para su rol.</p>
    }
  `,
})
export class PlanSelectionPanel {
  readonly model = input.required<PlanCardModel>();
  readonly children = input<readonly SpaceView[]>([]);
  readonly canOpenFile = input(true);

  readonly closed = output<void>();
  readonly openFile = output<void>();
  readonly pickChild = output<string>();
}
