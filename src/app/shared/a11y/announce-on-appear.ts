import {
  afterNextRender,
  booleanAttribute,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Anuncia un elemento que **aparece** como respuesta a una acción, y le lleva
 * el foco.
 *
 * ## El problema que cierra
 *
 * `ViewStateHost` ya hacía las dos cosas —región viva y foco en S4— pero **solo
 * el panel lo usa**. Las seis pantallas de `auth/` muestran sus errores y sus
 * confirmaciones con un `app-alert` propio, porque el formulario tiene que
 * seguir visible mientras se corrige. Eso es correcto, y traía una consecuencia
 * que no lo era: quien usa lector de pantalla **no se enteraba** de que había
 * aparecido un mensaje.
 *
 * El caso más grave era el acuse de `/auth/recuperar`, que **es toda la
 * respuesta** que recibe la persona.
 *
 * Esta directiva extrae las dos reglas de `ViewStateHost` para que cualquier
 * pantalla las herede sin reimplementarlas.
 *
 * ```html
 * <app-alert appAnuncio tone="error">{{ mensaje }}</app-alert>
 * <div appAnuncio>Te enviamos un correo…</div>
 * ```
 *
 * ## Las tres decisiones
 *
 * - **Solo al aparecer.** La directiva se construye cuando el `@if` la crea, y
 *   ahí anuncia. No observa cambios posteriores: un mensaje que se reescribe en
 *   su sitio es otro caso y merece otra herramienta.
 * - **`role="alert"` por defecto, `status` si se pide.** Un error interrumpe;
 *   una confirmación no tiene por qué. `[asertivo]="false"` baja la urgencia.
 * - **El foco se mueve, salvo que se pida lo contrario.** Es lo que hace que la
 *   persona no tenga que buscar el mensaje — pero robar el foco durante una
 *   carga sería perder el lugar en la página, así que `[enfocar]="false"`
 *   existe para los casos en que el mensaje acompaña en vez de interrumpir.
 */
@Directive({
  selector: '[appAnuncio]',
  host: {
    '[attr.role]': 'asertivo() ? "alert" : "status"',
    // `polite` incluso con `role="alert"`: el rol ya implica assertive, y
    // declarar el atributo hace que los lectores que no infieren el rol se
    // enteren igual.
    '[attr.aria-live]': 'asertivo() ? "assertive" : "polite"',
    // Enfocable por script, fuera del orden de tabulación: la persona no debe
    // tropezarse con él al tabular después de leerlo.
    '[attr.tabindex]': 'enfocar() ? "-1" : null',
  },
})
export class AnnounceOnAppear {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Un error interrumpe; una confirmación puede esperar. */
  readonly asertivo = input(true, { transform: booleanAttribute });

  /** Mover el foco al mensaje. Desactivar solo si acompaña en vez de interrumpir. */
  readonly enfocar = input(true, { transform: booleanAttribute });

  constructor() {
    // `afterNextRender` y no el constructor: el elemento todavía no está en el
    // documento cuando la directiva se instancia, y `focus()` sobre un nodo
    // suelto no hace nada. Es el mismo motivo por el que `ViewStateHost` usa un
    // microtask.
    afterNextRender(
      () => {
        if (!this.isBrowser || !this.enfocar()) {
          return;
        }
        this.host.nativeElement.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }
}
