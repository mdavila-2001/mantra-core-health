import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { estadoDeCama } from '../adt.view';

/**
 * El estado de una cama en **patrón, glifo y texto** a la vez (nunca sólo
 * color): el resumen HL7 v2-0116 de `BedBoardCell.v2Code`. Cada estado tiene un
 * rayado propio (`data-pattern`) además de su tono y su dibujo, para que se
 * distinga en escala de grises y con daltonismo.
 *
 * Es de F3 porque F2 aún no entrega su `bed-tile`; el glifo y el texto son los
 * que F2 defina cuando se integre: este componente no decide nada de la cama.
 */
@Component({
  selector: 'app-bed-status',
  templateUrl: './bed-status.html',
  styleUrl: './bed-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-v2]': 'estado().code', '[attr.data-tone]': 'estado().tone' },
})
export class BedStatus {
  readonly v2Code = input.required<string>();

  protected readonly estado = computed(() => estadoDeCama(this.v2Code()));
}
