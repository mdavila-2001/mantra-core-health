import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { orderIdFromQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { readApiError } from '../../../../core/http/api-error';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { QrReader, QrReaderUnavailableError } from '../../../../shared/utils/qr/read-qr';

/**
 * «Usar para una orden» (06/11/2026): el personal de un laboratorio o centro de
 * imagenología abre en el chat la foto del QR que le mandó el paciente y, con un
 * clic, crea la orden. Es la misma alta que «Nueva orden → QR del paciente»
 * (`POST /diagnostics/lab/orders/from-qr`), con la imagen como origen.
 *
 * Sólo se ofrece a una cuenta de `DIAGNOSTIC_CENTER`: es presentación, la API
 * vuelve a decidir si quien pide puede crear la orden.
 */
@Injectable({ providedIn: 'root' })
export class ImageToOrder {
  private readonly session = inject(SessionStore);
  private readonly lab = inject(LabPortalClient);
  private readonly qr = inject(QrReader);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly busy = signal(false);

  /** Si la acción se ofrece: cuenta de laboratorio y un navegador que lee QR. */
  readonly available = computed(
    () => this.session.activeTenantType() === 'DIAGNOSTIC_CENTER' && this.qr.canRead(),
  );

  /** Lee el QR de la imagen (una `data:` URL o `blob:`) y crea la orden. */
  async use(url: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const text = await this.qr.readImage(await (await fetch(url)).blob());
      if (text === null) {
        this.toasts.error('No encontramos un QR en esa imagen.');
        return;
      }
      if (orderIdFromQrCode(text) === null) {
        this.toasts.error('Ese QR no es el de una orden de AloVida.');
        return;
      }
      const { order, created } = await firstValueFrom(this.lab.createOrderFromQr(text));
      this.toasts.success(
        created
          ? `Orden creada para ${order.patientName}.`
          : `Esa orden ya estaba cargada (${order.patientName}).`,
      );
      await this.router.navigate(['/administration/laboratory-orders'], {
        queryParams: { estado: order.status === 'DRAFT' ? 'draft' : 'all' },
      });
    } catch (error: unknown) {
      this.toasts.error(messageOf(error));
    } finally {
      this.busy.set(false);
    }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof QrReaderUnavailableError) {
    return 'Este navegador no puede leer QR. Cree la orden desde «Nueva orden».';
  }
  if (error instanceof HttpErrorResponse) {
    const message = readApiError(error)?.message;
    if (message !== undefined && message !== '') return message;
  }
  return 'No pudimos crear la orden con esa imagen.';
}
