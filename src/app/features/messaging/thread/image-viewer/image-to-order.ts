import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { orderIdFromQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { readApiError } from '../../../../core/http/api-error';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { QrReader } from '../../../../shared/utils/qr/qr-reader';

/**
 * «Usar para una orden»: laboratory/imaging staff open the photo of the QR a patient sent in the
 * chat and, with one click, create the order (same call as «Nueva orden → QR del paciente»).
 * Offered only to `DIAGNOSTIC_CENTER` accounts; that is presentation, the API decides again.
 */
@Injectable({ providedIn: 'root' })
export class ImageToOrder {
  private readonly session = inject(SessionStore);
  private readonly lab = inject(LabPortalClient);
  private readonly qr = inject(QrReader);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly available = computed(() => this.session.activeTenantType() === 'DIAGNOSTIC_CENTER');

  /** Reads the QR of the image (a `data:` or `blob:` URL) and creates the order. */
  async use(url: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const text = await this.qr.readImage(await (await fetch(url)).blob());
      if (text === null) return void this.toasts.error('No encontramos un QR en esa imagen.');
      if (orderIdFromQrCode(text) === null) return void this.toasts.error('Ese QR no es el de una orden de AloVida.');
      const { order, created } = await firstValueFrom(this.lab.createOrderFromQr(text));
      this.toasts.success(created ? `Orden creada para ${order.patientName}.` : `Esa orden ya estaba cargada (${order.patientName}).`);
      await this.router.navigate(['/administration/laboratory-orders'], { queryParams: { estado: order.status === 'DRAFT' ? 'draft' : 'all' } });
    } catch (error: unknown) {
      const message = error instanceof HttpErrorResponse ? readApiError(error)?.message : undefined;
      this.toasts.error(message ?? 'No pudimos crear la orden con esa imagen.');
    } finally {
      this.busy.set(false);
    }
  }
}
