import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Tooltip } from '../tooltip/tooltip';
import type { TooltipPosition } from '../tooltip/tooltip.types';

/**
 * El «i» que explica una columna, un campo, un indicador o un término.
 *
 * ```html
 * <th>Cobertura <app-info-hint label="Cobertura" text="Personas asignadas sobre las requeridas." /></th>
 * ```
 *
 * Regla del cliente: **cada columna, métrica y estado que no se explique solo
 * lleva su «i»**. Es un botón (se alcanza con Tab y se activa con Enter o con un
 * toque) y no un `title` suelto, porque `title` no aparece con el teclado ni en
 * el celular. El globo es el `Tooltip` de siempre en modo rico: el puntero puede
 * pasar al globo, Escape lo cierra, no lo recorta ningún `overflow`.
 *
 * - `text`: la explicación, en una o dos frases, de usted y sin jerga.
 * - `label`: el nombre de lo que se explica; arma el nombre accesible
 *   «Más información sobre {label}».
 */
@Component({
  selector: 'app-info-hint',
  imports: [Tooltip],
  templateUrl: './info-hint.html',
  styleUrl: './info-hint.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoHint {
  /** Qué explica el globo. Obligatorio: un «i» sin texto es ruido. */
  readonly text = input.required<string>();
  /** Nombre de lo explicado, para el lector de pantalla. */
  readonly label = input('');
  readonly position = input<TooltipPosition>('top');

  protected readonly ariaLabel = computed(() => {
    const label = this.label().trim();
    return label ? `Más información sobre ${label}` : 'Más información';
  });
}
