import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

import { Switch } from '../../../shared/components/atoms/switch/switch';
import { PRESCRIPTION_DISPENSE_TESTIDS } from '../prescription-dispense.testids';

/**
 * «Lo tengo / No lo tengo» de un producto en una sede (FAR-02, REQ-FAR-02-009).
 *
 * Presentacional: no llama a la API. Quien lo contiene manda el pedido, lo
 * marca en vuelo y le pasa lo que respondió la API —o el valor anterior y el
 * motivo, si falló—. Así el estado sobrevive a que la pestaña del ítem se
 * cierre y se vuelva a abrir mientras la petición viaja.
 *
 * Mientras viaja está deshabilitado: un segundo toque no puede cruzarse con
 * la respuesta del primero.
 *
 * ## Accesibilidad
 *
 * - El nombre del control es **fijo**, «Lo tengo en {sede}» (patrón APG
 *   Switch): el estado lo dice `aria-checked`. El texto visible «Lo tengo /
 *   No lo tengo» va aparte y oculto al lector, para no anunciar «No lo tengo…
 *   desactivado», que se oye como una doble negación.
 * - El `disabled` nativo del átomo hace que el navegador saque el foco al
 *   `body` mientras viaja. Si el pedido salió de este control con el foco
 *   puesto y al terminar nadie lo tomó, se le devuelve: quien recorre las
 *   sedes con el teclado no pierde su lugar. No se toca el átomo compartido.
 * - La región `role="status"` existe siempre y solo cambia su texto: una
 *   región viva creada junto con su contenido no la anuncian todos los
 *   lectores.
 */
@Component({
  selector: 'app-site-availability-toggle',
  imports: [Switch],
  templateUrl: './site-availability-toggle.html',
  styleUrl: './site-availability-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteAvailabilityToggle {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  /** El nombre de la sede: nombra el interruptor para el lector de pantalla. */
  readonly siteName = input.required<string>();
  /** Lo que se muestra: lo que devolvió la API, o lo pedido mientras viaja. */
  readonly available = input.required<boolean>();
  /** La petición está en vuelo. */
  readonly pending = input<boolean>(false);
  /** Por qué no se guardó el último cambio, o `null`. */
  readonly failure = input<string | null>(null);

  /** El valor que la persona pidió. */
  readonly toggled = output<boolean>();

  protected readonly testids = PRESCRIPTION_DISPENSE_TESTIDS;

  protected readonly stateLabel = computed(() => (this.available() ? 'Lo tengo' : 'No lo tengo'));

  protected readonly accessibleName = computed(() => `Lo tengo en ${this.siteName()}`);

  /** El pedido salió de este control con el foco puesto. */
  private restoreFocus = false;

  constructor() {
    afterRenderEffect(() => {
      if (this.pending() || !this.restoreFocus) {
        return;
      }
      this.restoreFocus = false;
      const active = this.document.activeElement;
      if (active === null || active === this.document.body) {
        this.control()?.focus();
      }
    });
  }

  protected request(next: boolean): void {
    this.restoreFocus = this.document.activeElement === this.control();
    this.toggled.emit(next);
  }

  private control(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector<HTMLInputElement>('input[role="switch"]');
  }
}
