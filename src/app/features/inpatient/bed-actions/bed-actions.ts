import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState } from '../../../core/data-access/adt/adt.errors';
import type { AdtViewer, BedBoardCell, StayMovement, StayView } from '../../../core/data-access/adt/adt.types';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { RUTAS, textoDeCama } from '../shared/adt.view';
import { BedActionDialog, type BedActionDone, type BedActionKind } from './bed-action-dialog';

/**
 * Las acciones ADT de una cama o de una internación: **Asignar, Reservar,
 * Trasladar, Intercambiar, Dar de alta y Cancelar** (la reserva o el traslado
 * reciente).
 *
 * ## Contrato del slot `adtActions`
 *
 * El panel de una cama del tablero (F2) deja un hueco
 * `<ng-content select="[adtActions]">`; F3 lo llena con esto:
 *
 * ```html
 * <app-bed-actions adtActions [siteId]="siteId()" [cell]="seleccionada()"
 *                  [viewer]="viewer()" (changed)="recargarTablero()" />
 * ```
 *
 * - `cell`: la `BedBoardCell` que el tablero tiene seleccionada. De ella sale
 *   qué se ofrece (libre → asignar/reservar; ocupada → trasladar, intercambiar,
 *   dar de alta; reservada → convertir o cancelar).
 * - `viewer`: lo que la API declara que la persona puede hacer. **Solo refleja**:
 *   sin él se ofrece todo lo que la celda admite y es la API quien contesta 403.
 * - `changed`: algo se escribió y el tablero debe volver a leerse (la celda
 *   cambió de estado). Trae el texto del resultado.
 *
 * También la monta la ficha de internación (`encounterId` en lugar de `cell`),
 * que no tiene celda: así hay una sola implementación de cada acción.
 *
 * Limpieza nunca ve estos botones con datos de paciente: la celda que recibe
 * no trae `occupancy.encounterId` y la API contesta 403 si alguien insiste.
 */
@Component({
  selector: 'app-bed-actions',
  imports: [Alert, AppButton, BedActionDialog, RouterLink],
  templateUrl: './bed-actions.html',
  styleUrl: './bed-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedActions {
  private readonly client = inject(AdtClient);

  readonly siteId = input.required<string>();
  /** La celda del tablero. Opcional si se da `encounterId`. */
  readonly cell = input<BedBoardCell | null>(null);
  /** La internación (ficha de internación). Si falta, sale de `cell.occupancy.encounterId`. */
  readonly encounterId = input<string | null>(null);
  readonly viewer = input<AdtViewer | null>(null);
  readonly changed = output<BedActionDone>();

  /** `null` = no hay internación que leer (cama libre). */
  protected readonly stay = signal<ViewState<StayView> | null>(null);
  protected readonly abierta = signal<{ kind: BedActionKind; locationId?: string; label?: string } | null>(null);
  protected readonly resultado = signal<string | null>(null);

  protected readonly encuentro = computed(() => this.encounterId() ?? this.cell()?.occupancy.encounterId ?? null);
  protected readonly estancia = computed(() => {
    const s = this.stay();
    return s !== null && (s.status === 'ready' || s.status === 'stale') ? s.data : null;
  });
  protected readonly viewerEfectivo = computed(() => this.viewer() ?? this.estancia()?.viewer ?? null);
  protected readonly puedeOperar = computed(() => this.viewerEfectivo()?.canOperateBeds !== false);

  /** La reserva o el traslado reciente que se puede cancelar. */
  protected readonly cancelable = computed<StayMovement | null>(() => {
    const e = this.estancia();
    if (e === null) return null;
    const ahora = Date.now();
    return [...e.movements].reverse().find((m) => m.cancellableUntil !== null && Date.parse(m.cancellableUntil) > ahora && m.status.code !== 'LOCATION_CANCELLED') ?? null;
  });

  protected readonly modo = computed<'libre' | 'ocupada' | 'reservada' | 'pendiente' | 'no-asignable' | 'sin-acciones'>(() => {
    const c = this.cell();
    const e = this.estancia();
    if (this.encuentro() !== null) {
      if (e === null) return 'sin-acciones';
      if (e.encounter.status.code !== 'IN_PROGRESS') return 'sin-acciones';
      if (e.currentBed === null) return 'pendiente';
      return e.movements.some((m) => m.status.code === 'LOCATION_RESERVED') ? 'reservada' : 'ocupada';
    }
    if (c === null) return 'sin-acciones';
    if (c.assignable) return 'libre';
    return 'no-asignable';
  });

  protected readonly rutaEstancia = RUTAS.estancia;
  protected readonly textoDeCama = textoDeCama;

  constructor() {
    effect(() => {
      const id = this.encuentro();
      untracked(() => (id === null ? this.stay.set(null) : this.cargar(id)));
    });
  }

  protected cargar(id: string | null = this.encuentro()): void {
    if (id === null) return;
    this.stay.set(loading());
    this.client.getStay(id).subscribe({
      next: (s) => this.stay.set(ready(s)),
      error: (e: unknown) => this.stay.set(adtErrorToViewState(e)),
    });
  }

  /** Abre el diálogo de una acción (lo usa también la ficha, desde su pestaña de egreso). */
  abrir(kind: BedActionKind, extra: { locationId?: string; label?: string } = {}): void {
    this.resultado.set(null);
    this.abierta.set({ kind, ...extra });
  }

  protected alTerminar(r: BedActionDone): void {
    this.abierta.set(null);
    this.resultado.set(r.message);
    this.changed.emit(r);
    this.cargar();
  }
}
