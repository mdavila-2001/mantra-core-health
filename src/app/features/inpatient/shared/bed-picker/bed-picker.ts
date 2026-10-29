import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { BedBoardCell } from '../../../../core/data-access/adt/adt.types';
import { bedPathText } from '../../../../core/data-access/adt/adt.logic';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import { motivoDeNoAsignable } from '../adt.view';
import { BedStatus } from '../bed-status/bed-status';

/**
 * **Elegir una cama** entre las que ofrece el tablero de F2.
 *
 * ## Es el hueco del plano
 *
 * Esta lista de camas agrupadas por unidad es la forma mínima de elegir; el
 * plano interactivo de la franja Plano la sustituye después **sin tocar a
 * quien la usa**: el contrato es sólo `cells` (lo que entrega
 * `GET /sites/:siteId/bed-board`), `value` (el id elegido) y `picked` (la celda
 * elegida). Quien lo sustituya conserva esas tres cosas.
 *
 * ## Qué muestra
 *
 * Por omisión, **sólo las asignables**: ofrecer una cama que se sabe que va a
 * ser rechazada es hacer perder tiempo. «Ver también las no asignables» las
 * muestra apagadas y con el motivo (sucia, ocupada, en mantenimiento): es la
 * salida del S3 «sin camas asignables», que dice qué mirar y no sólo que no hay.
 * Lo que decide si una cama sirve para *esta* persona no es esta lista sino
 * `bed-compatibility`.
 */
@Component({
  selector: 'app-bed-picker',
  imports: [AppButton, BedStatus, EmptyState, Input],
  templateUrl: './bed-picker.html',
  styleUrl: './bed-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedPicker {
  readonly cells = input.required<readonly BedBoardCell[]>();
  /** Id de la cama elegida (`BedBoardCell.id`). */
  readonly value = input<string | null>(null);
  /** Una cama que no se ofrece aunque sea asignable (la actual, en un traslado). */
  readonly excludeId = input<string | null>(null);
  /** Para el rótulo del grupo cuando se pide «sólo ocupadas» (intercambio). */
  readonly mode = input<'assignable' | 'occupied'>('assignable');
  readonly picked = output<BedBoardCell>();

  protected readonly texto = signal('');
  protected readonly verTodas = signal(false);

  protected readonly candidatas = computed(() => {
    const t = this.texto().trim().toLowerCase();
    const modo = this.mode();
    return this.cells()
      .filter((c) => c.id !== this.excludeId())
      .filter((c) => (modo === 'occupied' ? c.occupancy.code === 'OCC_OCCUPIED' && c.occupancy.encounterId != null : true))
      .filter((c) => t === '' || `${c.code} ${c.name} ${bedPathText(c.path)}`.toLowerCase().includes(t));
  });

  protected readonly ofrecidas = computed(() => {
    const todas = this.candidatas();
    if (this.mode() === 'occupied') return todas;
    return this.verTodas() ? todas : todas.filter((c) => c.assignable);
  });

  protected readonly cuantasNoAsignables = computed(() => this.candidatas().filter((c) => !c.assignable).length);

  protected readonly grupos = computed(() => {
    const mapa = new Map<string, BedBoardCell[]>();
    for (const c of this.ofrecidas()) {
      const lugar = c.path.at(-1)?.name ?? 'Sin ubicación';
      mapa.set(lugar, [...(mapa.get(lugar) ?? []), c]);
    }
    return [...mapa.entries()].map(([lugar, camas]) => ({ lugar, camas }));
  });

  protected readonly motivo = motivoDeNoAsignable;

  protected elegir(c: BedBoardCell): void {
    if (this.mode() === 'assignable' && !c.assignable) return;
    this.picked.emit(c);
  }

  protected etiqueta(c: BedBoardCell): string {
    const quien = c.occupancy.patient === undefined || c.occupancy.patient === null ? '' : `, ${c.occupancy.patient.initials}`;
    return `Cama ${c.code}, ${bedPathText(c.path)}, ${c.function.display}${quien}${c.assignable ? '' : `. No asignable: ${motivoDeNoAsignable(c)}`}`;
  }
}
