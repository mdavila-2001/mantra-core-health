import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { nextControlId } from '../../form-control/form-control.context';

/** Un control marcado inválido por Angular o por el atributo nativo. */
const INVALID_CONTROL_SELECTOR = '.ng-invalid, [aria-invalid="true"]';

/**
 * Agrupa campos relacionados dentro de un formulario largo.
 *
 * ```html
 * <app-form-section legend="Datos de contacto" description="Los usamos para avisos de turnos">
 *   <app-form-field label="Teléfono">…</app-form-field>
 * </app-form-section>
 * ```
 *
 * Es un **`<fieldset>` con `<legend>` de verdad**: un `div role="group"` no
 * asocia el rótulo a los controles de la misma manera y obliga a repetir el
 * contexto en cada campo.
 *
 * **Una sección con un control inválido no se puede plegar** — y si estaba
 * plegada cuando falló la validación, se abre sola. Un error escondido dentro
 * de un acordeón es un error que nadie corrige y un formulario que no se puede
 * enviar sin saber por qué.
 *
 * > Plegada, el contenido **no está en el DOM**, así que la sección no puede
 * > ver sus propios controles. Por eso `invalid` es un input: quien conoce el
 * > `FormGroup` avisa. Con la sección desplegada además se detecta sola por el
 * > DOM, para el caso de formularios sin `FormGroup`.
 */
@Component({
  selector: 'app-form-section',
  templateUrl: './form-section.html',
  styleUrl: './form-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'form-section',
  },
})
export class FormSection {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly legend = input.required<string>();
  readonly description = input<string>('');
  readonly collapsible = input(false, { transform: booleanAttribute });
  readonly expanded = model<boolean>(true);

  /**
   * La sección tiene algún control inválido. Lo declara quien conoce el
   * formulario, porque plegada la sección no puede verlo por el DOM.
   */
  readonly invalid = input(false, { transform: booleanAttribute });

  private readonly baseId = nextControlId('form-section');
  protected readonly descriptionId = `${this.baseId}-description`;
  protected readonly contentId = `${this.baseId}-content`;

  protected readonly describedBy = computed(() =>
    this.description() ? this.descriptionId : null,
  );

  /** Plegable de verdad solo si además está desplegable en este momento. */
  protected readonly showsToggle = computed(() => this.collapsible());

  /** El contenido se renderiza si no es plegable o si está desplegada. */
  protected readonly showsContent = computed(() => !this.collapsible() || this.expanded());

  constructor() {
    // Si la validación falla con la sección plegada, se despliega sola: un
    // error escondido es un formulario que no se puede enviar sin saber por qué.
    afterRenderEffect(() => {
      if (!this.isBrowser || !this.collapsible() || this.expanded()) {
        return;
      }
      if (this.invalid()) {
        this.expanded.set(true);
      }
    });
  }

  protected toggle(): void {
    if (!this.collapsible()) {
      return;
    }
    // Plegar con un error adentro lo escondería: se ignora el pedido.
    if (this.expanded() && this.hasErrors()) {
      return;
    }
    this.expanded.update((open) => !open);
  }

  /**
   * Lo declarado por el consumidor, o lo que se vea en el DOM mientras la
   * sección esté desplegada — para formularios sin `FormGroup`.
   */
  private hasErrors(): boolean {
    if (this.invalid()) {
      return true;
    }
    return (
      this.isBrowser &&
      this.hostElement.nativeElement.querySelector(INVALID_CONTROL_SELECTOR) !== null
    );
  }
}
