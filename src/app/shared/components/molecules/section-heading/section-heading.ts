import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/**
 * El encabezado de una card de ficha: ícono, título y cuántos hay.
 *
 * ```html
 * <app-card>
 *   <app-section-heading card-header icono="scan" titulo="Equipos" [cuantos]="4" />
 *   …
 * </app-card>
 * ```
 *
 * ## Por qué existe
 *
 * Las cards de las fichas encabezaban con un `<h2>` suelto. Con una card se
 * leía bien; con cinco apiladas —«Identificación», «Sedes», «Equipos»,
 * «Estudios y servicios», «Acreditaciones»— la página era una lista de títulos
 * del mismo peso donde no se distinguía una sección de otra sin leerlas, y
 * había que contar a mano cuántos equipos traía la de equipos.
 *
 * El ícono resuelve lo primero: se reconoce la sección antes de leerla, que es
 * lo único que un ícono aporta. El recuento resuelve lo segundo, y en el
 * encabezado en vez de al final de la lista, que es donde sirve para decidir si
 * vale la pena bajar.
 *
 * ## El nivel del encabezado se declara, no se adivina
 *
 * `nivel` existe porque una card dentro de una ficha con `<h1>` necesita `h2`,
 * y la misma card dentro de un panel que ya tiene `h2` necesita `h3`. Saltarse
 * un nivel rompe la navegación por encabezados de un lector de pantalla, que es
 * cómo se recorre una ficha larga sin ver.
 *
 * ## Qué NO hace
 *
 * No dibuja acciones. Un botón en el encabezado de una card compite con el
 * título por la primera lectura; las acciones van en el pie de la card, que es
 * el hueco que `app-card` ya tiene para eso.
 */
@Component({
  selector: 'app-section-heading',
  imports: [NavIcon],
  template: `
    <span class="encabezado-seccion__marca" aria-hidden="true">
      <app-nav-icon [name]="icono()" />
    </span>

    @switch (nivel()) {
      @case (3) {
        <h3 class="encabezado-seccion__titulo">{{ titulo() }}</h3>
      }
      @default {
        <h2 class="encabezado-seccion__titulo">{{ titulo() }}</h2>
      }
    }

    <!-- El recuento va en el flujo del título y no en un pseudo-elemento: es un
         dato, no decoración, y tiene que poder leerse en voz alta con él. -->
    @if (cuantos() !== null) {
      <span class="encabezado-seccion__cuantos">{{ cuantos() }}</span>
    }
  `,
  styleUrl: './section-heading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'encabezado-seccion' },
})
export class SectionHeading {
  /** El ícono de la sección, del set cerrado de la navegación. */
  readonly icono = input.required<NavIconName>();

  readonly titulo = input.required<string>();

  /**
   * Cuántos elementos hay en la sección, o `null` cuando no se cuenta nada.
   *
   * `null` y no `0`: una sección con cero elementos no se dibuja —quien la monta
   * la esconde entera—, así que un cero en el encabezado sería un estado que no
   * existe.
   */
  readonly cuantos = input<number | null>(null);

  /** `2` por omisión: la card cuelga del `<h1>` de la ficha. */
  readonly nivel = input<2 | 3>(2);
}
