import { afterNextRender, ChangeDetectionStrategy, Component, inject, Injector, output, viewChild } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import type { NodoElegido } from '../../recorrido-clinico/recorrido-clinico';
import { RedClinicaPanel } from '../panel/red-clinica-panel';
import { RedClinicaSuperficie } from '../superficie/red-clinica-superficie';
import { RedDelExpediente, type FilaDeLaRed } from './red-del-expediente';
import { SeleccionDeLaRed } from './seleccion-de-la-red';

/**
 * **The chart's clinical network**: the filter bar, the alerts, the tour and
 * the network on one surface, and next to it (≥ 780 px, with a node open) the
 * detail panel in the same grid. With no node open there is no column: the
 * network takes the whole width. Below 780 px the panel is a sheet.
 *
 * It holds no state: the reads live in {@link RedDelExpediente} and the
 * selection in {@link SeleccionDeLaRed}, both provided by the chart, so they
 * outlive switching views.
 */
@Component({
  selector: 'div[app-red-clinica-del-expediente]',
  imports: [AppButton, RedClinicaPanel, RedClinicaSuperficie],
  templateUrl: './red-clinica-del-expediente.html',
  styleUrl: './red-clinica-del-expediente.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'expediente-red',
    '[class.expediente__red--con-panel]': 'seleccion.panelAlLado()',
  },
})
export class RedClinicaDelExpediente {
  private readonly injector = inject(Injector);
  protected readonly red = inject(RedDelExpediente);
  protected readonly seleccion = inject(SeleccionDeLaRed);

  /** «Ver el registro completo»: the usual detail, the same the table opens. */
  readonly verDetalle = output<FilaDeLaRed>();

  private readonly recorrido = viewChild(RedClinicaSuperficie);

  /**
   * A node was chosen on the network: its detail goes to the panel. It is
   * also brought into view, because opening the panel narrows the map and the
   * canvas, stuck to the most recent, could shift and leave out the node just
   * chosen.
   */
  protected elegir(elegido: NodoElegido): void {
    this.abrirNodo(elegido.id);
  }

  /**
   * Opens a node in the panel and takes the network to it (expands its
   * episode, opens what hides it and brings it into view): what a panel link
   * or an alert asks for, which are not on the node. An id that is not the
   * network's opens nothing.
   */
  protected abrirNodo(id: string): void {
    if (!this.red.nodos().some((n) => n.id === id)) {
      return;
    }
    this.seleccion.nodoAbiertoId.set(id);
    this.recorrido()?.irANodo(id);
  }

  /** Closing the panel returns the focus to the node that was open (not to the first). */
  protected cerrarPanel(): void {
    const id = this.seleccion.nodoAbiertoId();
    this.seleccion.nodoAbiertoId.set(null);
    if (id !== null) {
      afterNextRender(() => this.recorrido()?.irANodo(id, { foco: true }), { injector: this.injector });
    }
  }

  protected verRegistroCompleto(): void {
    const fila = this.seleccion.filaDelNodoAbierto();
    if (fila !== null) {
      this.verDetalle.emit(fila);
    }
  }
}
