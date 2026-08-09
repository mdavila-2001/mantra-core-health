import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { ACCORDION_PARENT } from '../accordion.types';

/**
 * Una sección plegable. La cabecera es un `<button>` dentro de un `<h3>` —lo
 * que exige WAI-ARIA— y no un `div` con `role="button"`: el botón nativo trae
 * teclado, foco y anuncio sin escribir una línea.
 *
 * ```html
 * <app-accordion-panel heading="Antecedentes familiares">
 *   <app-textarea [(value)]="antecedentes" />
 * </app-accordion-panel>
 * ```
 *
 * El contenido plegado **no está en el DOM**: en un formulario clínico largo,
 * ocho secciones ocultas con CSS siguen siendo ocho secciones de controles
 * que el lector de pantalla recorre y el navegador mantiene vivos.
 */
@Component({
  selector: 'app-accordion-panel',
  templateUrl: './accordion-panel.html',
  styleUrl: './accordion-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'accordion-panel',
    '[class.is-expanded]': 'expanded()',
    '[class.is-disabled]': 'disabled()',
  },
})
export class AccordionPanel {
  private readonly accordion = inject(ACCORDION_PARENT, { optional: true });

  readonly heading = input.required<string>();
  readonly expanded = model<boolean>(false);
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly baseId = nextControlId('accordion');
  protected readonly headerId = `${this.baseId}-header`;
  protected readonly regionId = `${this.baseId}-region`;

  /** Un panel deshabilitado no se abre ni se cierra, esté como esté. */
  protected readonly isInteractive = computed(() => !this.disabled());

  protected toggle(): void {
    if (!this.isInteractive()) {
      return;
    }
    const abierto = !this.expanded();
    this.expanded.set(abierto);

    if (abierto) {
      // El contenedor decide si esto cierra a los hermanos.
      this.accordion?.panelOpened(this);
    }
  }

  /** Lo usa el contenedor para cerrar los demás; no toca al hermano por dentro. */
  collapse(): void {
    this.expanded.set(false);
  }
}
