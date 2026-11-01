import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';

import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  PaymentProof,
  SimulatedCatalogs,
  SimulatedCharge,
} from '../../../core/data-access/billing-simulated/billing-simulated.types';
import { formatProofSize } from '../../../core/data-access/billing-simulated/payment-proof';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { estadoDeCobro, ROTULO_DE_ESTADO } from '../billing-summary';
import { COMPLETE_ACTION, chargeAction, bs, errorMessage, ACTION_LABEL } from '../on-screen-charges';
import { SimulatedInvoiceDialog } from '../simulated-invoice-dialog/simulated-invoice-dialog';

/** Prefijo con el que el servidor simulado deja un PDF: lo único que se acepta como enlace. */
const PDF_DATA_URL_PREFIX = 'data:application/pdf;base64,';

/**
 * **Pagos de una cita** — lo que el médico necesita para cerrar el cobro de
 * una consulta, en dos pestañas:
 *
 * - **Comprobantes**: lo que el paciente envió para ESTA cita. Se ve el
 *   archivo, se confirma el pago y el paciente pasa a figurar como pagado.
 * - **Factura**: genera (o muestra) la factura de ese cobro.
 *
 * ```html
 * <app-booking-payments [bookingId]="cita.id" [patientName]="cita.paciente"
 *   (changed)="recargarAgenda()" (closed)="cerrarPagos()" />
 * ```
 *
 * Después de cada escritura se **relee** del servidor: lo que se ve es lo que
 * quedó guardado. `changed` avisa a la agenda para que refresque la columna
 * «Pago» sin esperar a que se cierre el modal.
 */
@Component({
  selector: 'app-booking-payments',
  imports: [Alert, AppButton, Badge, ContentDialog, DatePipe, SimulatedInvoiceDialog, Tab, Tabs],
  templateUrl: './booking-payments.html',
  styleUrl: './booking-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPayments {
  private readonly client = inject(BillingSimulatedClient);
  private readonly sanitizer = inject(DomSanitizer);

  readonly bookingId = input.required<string>();
  readonly patientName = input('la persona');

  /** Algo cambió (se confirmó un pago o se emitió una factura). */
  readonly changed = output<void>();
  readonly closed = output<void>();

  protected readonly loading = signal(true);
  protected readonly problem = signal<string | null>(null);
  protected readonly charges = signal<readonly SimulatedCharge[]>([]);
  protected readonly catalogs = signal<SimulatedCatalogs | null>(null);
  protected readonly confirming = signal<string | null>(null);
  protected readonly invoicingId = signal<string | null>(null);
  protected readonly selectedTab = signal(0);
  protected readonly notice = signal<string | null>(null);

  protected readonly invoicing = computed(
    () => this.charges().find((charge) => charge.id === this.invoicingId()) ?? null,
  );
  protected readonly pendingCount = computed(
    () => this.charges().filter((charge) => charge.patientPaymentReport?.status === 'PENDING_CONFIRMATION').length,
  );

  protected readonly bs = bs;
  protected readonly formatProofSize = formatProofSize;
  protected readonly stateLabel = ROTULO_DE_ESTADO;
  protected readonly actionLabel = ACTION_LABEL;
  protected readonly actionFull = COMPLETE_ACTION;
  protected readonly actionOf = chargeAction;
  protected readonly stateOf = estadoDeCobro;

  constructor() {
    queueMicrotask(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    forkJoin({
      page: this.client.chargesOfBooking(this.bookingId()),
      catalogs: this.client.catalogs(),
    }).subscribe({
      next: ({ page, catalogs }) => {
        this.charges.set(page.items.filter((charge) => charge.source === 'CONSULTATION'));
        this.catalogs.set(catalogs);
        this.problem.set(null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.problem.set(errorMessage(error, 'No pudimos leer los pagos de esta cita.'));
        this.loading.set(false);
      },
    });
  }

  protected confirm(charge: SimulatedCharge): void {
    if (this.confirming() !== null) return;
    this.confirming.set(charge.id);
    this.notice.set(null);
    this.client.confirmPaymentReport(charge.id).subscribe({
      next: () => {
        this.confirming.set(null);
        this.notice.set('Pago confirmado. La cita figura como pagada.');
        this.changed.emit();
        this.load();
      },
      error: (error: unknown) => {
        this.confirming.set(null);
        this.problem.set(errorMessage(error, 'No pudimos confirmar el pago.'));
      },
    });
  }

  protected onInvoiceDone(): void {
    this.changed.emit();
    this.load();
  }

  /** Las imágenes se pintan tal cual; el PDF sólo si es el `data:` URL que el servidor validó. */
  protected pdfLink(proof: PaymentProof): SafeUrl | null {
    return proof.dataUrl.startsWith(PDF_DATA_URL_PREFIX) ? this.sanitizer.bypassSecurityTrustUrl(proof.dataUrl) : null;
  }

  protected isImage(proof: PaymentProof): boolean {
    return proof.mimeType.startsWith('image/');
  }
}
