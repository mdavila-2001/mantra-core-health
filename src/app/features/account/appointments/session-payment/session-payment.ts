import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment';
import { BillingSimulatedClient } from '../../../../core/data-access/billing-simulated/billing-simulated.client';
import type { SimulatedCharge } from '../../../../core/data-access/billing-simulated/billing-simulated.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { dibujarQr } from '../../../../shared/utils/qr/dibujar-qr';

@Component({
  selector: 'app-session-payment',
  imports: [AppButton, Badge],
  templateUrl: './session-payment.html',
  styleUrl: './session-payment.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionPayment {
  private readonly client = inject(BillingSimulatedClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly bookingId = input.required<string>();
  readonly charge = signal<SimulatedCharge | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly busy = signal(false);
  readonly qrReady = signal(true);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('qr');

  constructor() {
    effect(() => {
      const bookingId = this.bookingId();
      this.loading.set(true);
      this.failed.set(false);
      this.client
        .patientChargesForBooking(bookingId)
        .pipe(
          catchError(() => {
            this.failed.set(true);
            return of({ items: [], count: 0, simulated: true as const });
          }),
        )
        .subscribe((page) => {
          this.charge.set(
            page.items.find((item) => item.source === 'CONSULTATION' && item.plan === null) ?? null,
          );
          this.loading.set(false);
          this.drawQr();
        });
    });
    effect(() => this.drawQr());
  }

  report(): void {
    const charge = this.charge();
    if (charge === null || this.busy()) return;
    this.busy.set(true);
    this.client.reportPatientQrPayment(charge.id).subscribe({
      next: (updated) => {
        this.charge.set(updated);
        this.busy.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.busy.set(false);
      },
    });
  }

  private drawQr(): void {
    const canvas = this.canvas();
    const charge = this.charge();
    if (!this.browser || canvas === undefined || charge === null || charge.payment !== null) return;
    dibujarQr(
      canvas.nativeElement,
      `ALOVIDA-PAGO-DEMO|${charge.id}|${charge.total} BOB`,
      176,
    ).catch(() => this.qrReady.set(false));
  }

  protected readonly demoActiva = environment.paymentDemo;
}
