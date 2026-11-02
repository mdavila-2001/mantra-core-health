import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { BedTileView } from './bed-tile.types';

/**
 * **Una cama del tablero** (F2.4, primitiva nueva permitida por el contrato).
 *
 * Es un `button` con el nombre accesible completo —código, estado, motivo,
 * fecha estimada, aislamiento y antigüedad—, porque una grilla de colores no se
 * lee con un lector de pantalla ni con daltonismo: el estado va **escrito** en
 * el badge, y el color sólo lo refuerza.
 */
@Component({
  selector: 'app-bed-tile',
  templateUrl: './bed-tile.html',
  styleUrl: './bed-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bed-tile-host' },
})
export class BedTile {
  readonly bed = input.required<BedTileView>();
  readonly selected = input(false);
  readonly activated = output<void>();

  protected readonly ariaLabel = computed(() => {
    const b = this.bed();
    return [
      `Cama ${b.code}`,
      b.statusLabel,
      b.reason ? `motivo: ${b.reason}` : null,
      b.until ? b.until : null,
      b.isolation ?? null,
      b.hygiene ?? null,
      b.patient ? `paciente ${b.patient}` : null,
      b.age ? `último cambio ${b.age}` : null,
    ]
      .filter((x): x is string => x !== null)
      .join(', ');
  });
}
