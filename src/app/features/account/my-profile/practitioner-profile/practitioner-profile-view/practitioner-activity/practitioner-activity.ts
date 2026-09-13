import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Card } from '../../../../../../shared/components/molecules/card/card';
import type { ActividadVisible } from '../practitioner-profile-view.types';

/**
 * Los contadores de la pestaña «Actividad» de la ficha del médico.
 *
 * ## Qué dibuja
 *
 * Contadores, no renglones de ficha. Vivían en la rejilla `dt`/`dd` de «Tus
 * datos» —rótulo chico, valor al tamaño del cuerpo— y cuatro cifras sueltas en
 * media pestaña se leían como el pie de una lista. El cliente pidió el
 * 13/09/2026 que se vieran como lo que son: cada una su caja y el número al
 * tamaño de un titular.
 *
 * Es el mismo dibujo que las cifras del panel (`panel__cifra-*`): `app-card`
 * `outlined` para la caja, rótulo en «overline» y valor en tipografía de
 * titular con cifras tabulares. Se repite el patrón y no el componente porque
 * el panel tiene además un pie por tarjeta que acá no existe; unificarlos es
 * trabajo aparte y está anotado.
 *
 * ## Por qué es un componente y no unas reglas más en la ficha
 *
 * Porque `practitioner-profile-view.css` ya estaba a **20 bytes** del techo de
 * 9 kB que `angular.json` pone por hoja de componente: cualquier regla nueva
 * volteaba el build. Un componente propio trae su propia hoja y su propio
 * presupuesto, y de paso deja el CSS al lado del marcado que lo usa.
 */
@Component({
  selector: 'app-practitioner-activity',
  imports: [Card],
  templateUrl: './practitioner-activity.html',
  styleUrl: './practitioner-activity.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerActivity {
  /** Las cuentas a mostrar, en el orden en que vienen. */
  readonly actividad = input.required<readonly ActividadVisible[]>();
}
