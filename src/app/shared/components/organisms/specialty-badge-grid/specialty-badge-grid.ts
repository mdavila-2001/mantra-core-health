import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SpecialtyBadge } from '../specialty-badge/specialty-badge';
import type { SpecialtyBadgeItem } from '../specialty-badge/specialty-badge.types';

/**
 * Las especialidades de un profesional, como grid de insignias.
 *
 * ```html
 * <app-specialty-badge-grid [especialidades]="perfil().especialidades" />
 * ```
 *
 * ## Por qué existe además de la insignia
 *
 * Porque el orden y el hueco entre insignias son una decisión, y si la toma
 * cada pantalla se separan en el primer retoque: hoy el perfil lista las
 * especialidades en tres lugares y en ninguno están ordenadas igual.
 *
 * ## La principal va primera
 *
 * El orden lo pone el componente, no quien lo monta: lo primero que alguien
 * quiere saber de un médico es qué ejerce principalmente. **Se ordena una copia**
 * — `sort` muta el arreglo, y el de arriba llega `readonly` justamente para que
 * nadie lo cambie desde acá.
 *
 * El resto conserva el orden en que llegó. Alfabetizarlo sería inventar un
 * criterio: quien manda los datos ya eligió uno.
 *
 * ## `<ul>` y no `<div>`
 *
 * Son una lista y se anuncian como tal: un lector dice cuántas son antes de
 * leerlas, que es el dato que alguien busca cuando compara dos profesionales.
 */
@Component({
  selector: 'app-specialty-badge-grid',
  imports: [SpecialtyBadge],
  templateUrl: './specialty-badge-grid.html',
  styleUrl: './specialty-badge-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'specialty-badge-grid' },
})
export class SpecialtyBadgeGrid {
  readonly especialidades = input.required<readonly SpecialtyBadgeItem[]>();

  /**
   * El nombre accesible de la lista. Con más de un grid en la pantalla
   * —el perfil tiene el del encabezado y el de la pestaña— «lista de 4
   * elementos» dos veces no distingue cuál es cuál.
   */
  readonly etiqueta = input('Especialidades');

  protected readonly ordenadas = computed<readonly SpecialtyBadgeItem[]>(() =>
    [...this.especialidades()].sort(
      (a, b) => Number(b.principal) - Number(a.principal),
    ),
  );
}
