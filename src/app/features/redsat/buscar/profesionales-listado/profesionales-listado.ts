/* V65-02·L · Profesionales
   Portada de V65-buscador/publico/V65-02-profesionales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { RouterLink } from '@angular/router';

import { SearchResult } from '../../../../shared/components/molecules';
import { PROFESIONALES_DE_MUESTRA } from './profesionales-listado.data';

/**
 * El listado de profesionales de la superficie pública.
 *
 * ## Qué cambió respecto del marcado portado
 *
 * La maqueta repite la misma tarjeta cinco veces. Acá esa tarjeta es
 * {@link SearchResult} —la molécula del banco, con el marcado y las clases de
 * `redsat.css` §25 intactos— y la pantalla recorre una lista.
 *
 * **El resultado renderizado es el mismo**: se movieron los datos del HTML a un
 * archivo tipado, no se rediseñó nada. Lo que se gana es que el día que
 * `CommunityClient` pueda llamarse sin sesión, cambiar la fuente es reemplazar
 * un `signal` por una lectura — la plantilla no se toca.
 *
 * ## Por qué los datos siguen siendo de mentira
 *
 * `community` no tiene un solo `@Public()`: un visitante sin sesión recibiría
 * 401. Es F4 del plan, y es lo único que separa a esta pantalla de mostrar
 * datos reales.
 */
@Component({
  selector: 'app-redsat-buscar-profesionales-listado',
  imports: [RouterLink, SearchResult],
  templateUrl: './profesionales-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarProfesionalesListado {
  /**
   * Los profesionales que se listan.
   *
   * Señal y no constante: es el punto exacto donde entra la lectura real, y
   * dejarlo como señal ahora evita tener que tocar la plantilla después.
   */
  protected readonly profesionales = signal(PROFESIONALES_DE_MUESTRA);
}
