import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  forwardRef,
  input,
} from '@angular/core';

import { AccordionPanel } from './accordion-panel/accordion-panel';
import { ACCORDION_PARENT, type AccordionHost } from './accordion.types';

/**
 * Agrupa secciones plegables. Con `multi` en `false` —el default— abrir una
 * cierra las demás, que es lo que se espera de un formulario largo: una sola
 * sección a la vista por vez.
 *
 * ```html
 * <app-accordion>
 *   <app-accordion-panel heading="Antecedentes">…</app-accordion-panel>
 *   <app-accordion-panel heading="Medicación habitual">…</app-accordion-panel>
 * </app-accordion>
 * ```
 *
 * La coordinación va por `contentChildren` y signals, sin servicio: dos
 * acordeones en la misma pantalla no tienen por qué conocerse, y un servicio
 * los volvería un solo estado global.
 */
@Component({
  selector: 'app-accordion',
  templateUrl: './accordion.html',
  styleUrl: './accordion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ACCORDION_PARENT, useExisting: forwardRef(() => Accordion) }],
  host: {
    class: 'accordion',
  },
})
export class Accordion implements AccordionHost {
  private readonly panels = contentChildren(AccordionPanel);

  /** Varias secciones abiertas a la vez. Por defecto, una sola. */
  readonly multi = input(false, { transform: booleanAttribute });

  panelOpened(panel: unknown): void {
    if (this.multi()) {
      return;
    }
    for (const candidato of this.panels()) {
      if (candidato !== panel) {
        candidato.collapse();
      }
    }
  }
}
