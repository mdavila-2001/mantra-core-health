import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

import { OrderReferralClient } from '../../../core/data-access/diagnostics/order-referral.client';
import { readApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';

/**
 * The patient accepts or rejects a doctor's referral of an order to a center. The decision is the
 * patient's and the API revalidates the state: a 409 means it was already resolved, and the caller
 * reloads either way so the list shows what the server has.
 */
@Injectable()
export class ReferralResponse {
  private readonly referrals = inject(OrderReferralClient);
  private readonly toasts = inject(ToastService);

  /** One answer in flight at a time (no double submit). */
  readonly busy = signal(false);

  respond(orderId: string, decision: 'accept' | 'reject', done: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.referrals.respondToReferral(orderId, decision).subscribe({
      next: (result) => {
        this.toasts.success(
          decision === 'accept'
            ? `Aceptó la derivación. ${result.performerName} ya puede ver su orden.`
            : 'Rechazó la derivación. El centro no verá su orden.',
        );
        this.finish(done);
      },
      error: (error: unknown) => {
        const message = error instanceof HttpErrorResponse ? readApiError(error)?.message : undefined;
        this.toasts.error(message ?? 'No pudimos registrar su respuesta. Intente de nuevo.');
        this.finish(done);
      },
    });
  }

  private finish(done: () => void): void {
    this.busy.set(false);
    done();
  }
}
