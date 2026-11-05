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
import type { PaymentProof, SimulatedCharge } from '../../../../core/data-access/billing-simulated/billing-simulated.types';
import {
  formatProofSize,
  isValidPaymentProof,
  PAYMENT_PROOF_ACCEPT,
  PAYMENT_PROOF_REJECTION,
  readPaymentProof,
} from '../../../../core/data-access/billing-simulated/payment-proof';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { drawQr } from '../../../../shared/utils/qr/draw-qr';

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
  /** El comprobante elegido, listo para enviar; `null` mientras no haya uno válido. */
  readonly proof = signal<PaymentProof | null>(null);
  readonly proofProblem = signal<string | null>(null);
  protected readonly proofAccept = PAYMENT_PROOF_ACCEPT;
  protected readonly formatProofSize = formatProofSize;
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

  /** Valida y lee el archivo elegido. Un archivo que no sirve se dice, no se descarta en silencio. */
  async chooseProof(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.proof.set(null);
    this.proofProblem.set(null);
    if (file === undefined) return;
    if (!isValidPaymentProof(file)) {
      this.proofProblem.set(PAYMENT_PROOF_REJECTION);
      input.value = '';
      return;
    }
    try {
      this.proof.set(await readPaymentProof(file));
    } catch {
      this.proofProblem.set('No pudimos leer el archivo. Elija el comprobante otra vez.');
      input.value = '';
    }
  }

  report(): void {
    const charge = this.charge();
    const proof = this.proof();
    if (charge === null || proof === null || this.busy()) return;
    this.busy.set(true);
    this.proofProblem.set(null);
    this.client.reportPatientQrPayment(charge.id, proof).subscribe({
      next: (updated) => {
        this.charge.set(updated);
        this.proof.set(null);
        this.busy.set(false);
      },
      error: () => {
        this.proofProblem.set('No pudimos enviar el comprobante. Intente de nuevo.');
        this.busy.set(false);
      },
    });
  }

  private drawQr(): void {
    const canvas = this.canvas();
    const charge = this.charge();
    if (!this.browser || canvas === undefined || charge === null || charge.payment !== null) return;
    drawQr(
      canvas.nativeElement,
      `ALOVIDA-PAGO-DEMO|${charge.id}|${charge.total} BOB`,
      176,
    ).catch(() => this.qrReady.set(false));
  }

  protected readonly demoActiva = environment.paymentDemo;
}
