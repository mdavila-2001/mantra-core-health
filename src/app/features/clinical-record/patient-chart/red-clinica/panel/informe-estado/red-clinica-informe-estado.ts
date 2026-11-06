import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ViewState } from '../../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../../shared/components/atoms/button/button';
import { Skeleton } from '../../../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../../../shared/components/molecules/alert/alert';

/**
 * The M34 states of reading a released report in the panel (everything but
 * `ready`, which the panel draws itself). A 429/412/409 arrives as
 * `validation` (`errorToViewState`): it says what the server answered, how
 * long to wait if it asked to (`retryAfterSeconds`) and offers a retry. A
 * 403 or 404 has nothing to retry: it offers going back to the network.
 *
 * ```html
 * <app-red-clinica-informe-estado [estado]="lectura.estado" (reintentar)="releer()" />
 * ```
 */
@Component({
  selector: 'app-red-clinica-informe-estado',
  imports: [Alert, AppButton, Skeleton],
  templateUrl: './red-clinica-informe-estado.html',
  styleUrl: './red-clinica-informe-estado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaInformeEstado {
  readonly estado = input.required<ViewState<unknown>>();
  readonly reintentar = output<void>();
  /** «Volver a la red» (403, 404): the panel closes and the focus returns to the node. */
  readonly volver = output<void>();

  /** The loading skeleton's rows: the table header and three values. */
  protected readonly filas = [0, 1, 2, 3];

  /** The server's messages, joined; a generic one when it sent none. */
  protected readonly mensajes = computed(() => {
    const e = this.estado();
    if (e.status !== 'validation') return '';
    return e.issues.map((i) => i.message).join(' ') || 'El servidor no pudo atender la lectura ahora.';
  });
}
