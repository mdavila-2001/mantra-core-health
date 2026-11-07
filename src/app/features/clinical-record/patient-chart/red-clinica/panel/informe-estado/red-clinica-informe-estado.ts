import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ViewState } from '../../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../../shared/components/atoms/button/button';
import { Skeleton } from '../../../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../../../shared/components/molecules/alert/alert';

/**
 * The M34 states of reading a released report in the panel (everything but
 * `ready`, which the panel draws itself). S4 (`validation`, ADR-0005) is
 * split by the error `code`, never by its message:
 *
 * - a rate limit (429, `RATE_LIMITED`) says how long to wait and offers a
 *   retry: after the wait the same read is worth repeating;
 * - any other rejection (422, 409, 412) gets a text of its own context: the
 *   server's message speaks of whatever it validated, not of this report, and
 *   repeating the same read would be rejected again. No retry: the support
 *   code and «Volver a la red».
 *
 * A 403 or 404 has nothing to retry either: it offers going back to the network.
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
  /** «Volver a la red» (403, 404, a rejected read): the panel closes and the focus returns to the node. */
  readonly volver = output<void>();

  /** The loading skeleton's rows: the table header and three values. */
  protected readonly filas = [0, 1, 2, 3];

  /** S4 from a rate limit: the only rejection worth retrying, once the wait is over. */
  protected readonly limitado = computed(() => {
    const e = this.estado();
    return e.status === 'validation' && (e.retryAfterSeconds !== undefined || e.issues.some((i) => i.code === 'RATE_LIMITED'));
  });
}
