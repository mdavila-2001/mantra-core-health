import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  ageLabel,
  AVAILABILITY_LABEL,
  HYGIENE_LABEL,
  ISOLATION_LABEL,
  summarizeCell,
} from '../../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type { BedBoardCell, BlockReason } from '../../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { BedStatusBadge, lookOfHygiene, lookOfV2, type StatusLook } from './bed-status';

/**
 * **El recuadro de una cama** en el tablero de camas (§F2.4): su código, su
 * estado (texto + glifo + patrón, nunca solo color), el motivo y «hasta
 * cuándo» si no está disponible, el icono de aislamiento y la antigüedad del
 * último cambio.
 *
 * Es un `button`: se alcanza con teclado, se activa con Enter o espacio y su
 * `aria-label` dice todo lo que el recuadro muestra, así que un lector de
 * pantalla no depende de los glifos. Mide al menos 44 px de alto (táctil).
 *
 * ## Presentacional puro
 *
 * No pide nada ni decide nada: recibe la celda que la API devolvió y la
 * pinta. Con `hygieneOnly` (la vista de Limpieza) dibuja solo el eje de
 * higiene —el contrato dice que Limpieza ve únicamente ese eje—, sin motivo de
 * bloqueo, aislamiento ni paciente. `now` lo ponen los padres para que la
 * antigüedad avance con el reloj de la pantalla y no con cada recuadro.
 */
@Component({
  selector: 'app-bed-tile',
  imports: [BedStatusBadge],
  templateUrl: './bed-tile.html',
  styleUrl: './bed-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"tone--" + look().tone + " pat--" + look().pattern',
    '[class.bed-tile--selected]': 'selected()',
  },
})
export class BedTile {
  readonly cell = input.required<BedBoardCell>();
  readonly selected = input(false);
  /** Vista de Limpieza: solo higiene. */
  readonly hygieneOnly = input(false);
  readonly now = input<Date>(new Date());
  readonly reasons = input<readonly BlockReason[]>([]);

  readonly activated = output<BedBoardCell>();

  protected readonly look = computed<StatusLook>(() => {
    const cell = this.cell();
    return this.hygieneOnly()
      ? lookOfHygiene(cell.hygiene.code, cell.hygiene.code === 'HYG_CLEAN')
      : lookOfV2(cell.v2Code);
  });

  protected readonly summary = computed(() => {
    const cell = this.cell();
    if (this.hygieneOnly()) {
      return {
        headline: cell.hygiene.terminalRequired ? 'Limpieza terminal' : HYGIENE_LABEL[cell.hygiene.code],
        detail: null,
      };
    }
    return summarizeCell(cell, this.reasons());
  });

  /** Un aislamiento que el estado principal no está diciendo ya. */
  protected readonly isolationFlag = computed(() => {
    const cell = this.cell();
    return !this.hygieneOnly() && cell.isolation.code !== 'ISO_NONE' && cell.v2Code !== 'I';
  });

  protected readonly age = computed(() => ageLabel(this.cell().lastEventAt, this.now()));

  protected readonly ariaLabel = computed(() => {
    const cell = this.cell();
    const s = this.summary();
    const partes = [
      `${cell.form.display} ${cell.code}`,
      this.look().label,
      s.headline,
      s.detail,
      this.isolationFlag() ? ISOLATION_LABEL[cell.isolation.code] : null,
      !this.hygieneOnly() && cell.availability.code !== 'SPACE_OP_AVAILABLE' ? AVAILABILITY_LABEL[cell.availability.code] : null,
      `último cambio ${this.age()}`,
    ];
    return [...new Set(partes.filter((p): p is string => p !== null && p !== ''))].join('. ');
  });

  protected activate(): void {
    this.activated.emit(this.cell());
  }
}
