import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, type Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  IssueInvoiceInput,
  SimulatedCatalogs,
  SimulatedCharge,
  SimulatedInvoice,
} from '../../../core/data-access/billing-simulated/billing-simulated.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ROTULO_DE_ESTADO, TONO_DE_ESTADO } from '../billing-summary';
import { bs, dateAndTime, errorMessage, catalogWithoutMark, hasCurrentInvoice } from '../on-screen-charges';
import { amountLiteral } from '../amount-in-words';
import { downloadGraphicRepresentation, downloadXml } from '../graphic-representation';

/**
 * **El modal que emite la factura contra el SIAT simulado.**
 *
 * ```html
 * @if (facturando(); as cobro) {
 *   <app-simulated-invoice-dialog [cobro]="cobro" [catalogos]="catalogos"
 *                                (emitida)="recargar()" (cerrado)="facturando.set(null)" />
 * }
 * ```
 *
 * Tres entradas, un solo modal:
 *
 * - **Un servicio de una sola instancia sin pagar**: pide también el medio de
 *   pago; al confirmar registra el pago y enseguida emite la factura —el cobro
 *   real de mostrador, de punta a punta—.
 * - **Pagado (o un plan saldado) y sin factura vigente**: sólo los datos del
 *   comprador. Un plan se factura por el total, con un renglón por instancia.
 * - **Con factura vigente**: la muestra, con su respuesta del SIAT y las
 *   descargas.
 *
 * Todo lo fiscal es sintético (FACT-SIAT-MOCK) y lo dice: el título, cada
 * código y cada descarga llevan «SIMULADO».
 */
@Component({
  selector: 'app-simulated-invoice-dialog',
  imports: [PaginatedForm, CustomField, ReactiveFormsModule, Alert, AppButton, Chip, ContentDialog, FormField, Input, Select],
  templateUrl: './simulated-invoice-dialog.html',
  styleUrl: './simulated-invoice-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulatedInvoiceDialog implements OnInit {
  protected readonly invoicePages = computed<readonly PaginaDeFormulario[]>(() => [
    { titulo: 'Comprador', campos: ['name', 'documentTypeCode', 'documentNumber', 'complement'].map((key) => ({ key, label: '', control: 'custom' })) },
    { titulo: 'Entrega y pago', campos: ['email', ...(this.paymentMeansRequests() ? ['methodCode'] : [])].map((key) => ({ key, label: '', control: 'custom' })) },
  ]);

  private readonly client = inject(BillingSimulatedClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly cobro = input.required<SimulatedCharge>();
  readonly catalogos = input.required<SimulatedCatalogs>();

  /** La factura quedó emitida (validada, observada o rechazada): el padre relee. */
  readonly emitida = output<SimulatedInvoice>();
  /** Se registró el pago (o ya estaba) aunque la factura falle: el padre también relee. */
  readonly pagado = output<void>();
  readonly cerrado = output<void>();

  protected readonly invoice = signal<SimulatedInvoice | null>(null);
  protected readonly invoiceLoading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  /** El pago ya quedó registrado en este modal: un reintento sólo factura. */
  private readonly registeredPayment = signal(false);

  protected readonly paymentMeansRequests = computed(() => this.cobro().payment === null && !this.registeredPayment());
  protected readonly literal = computed(() => amountLiteral(this.cobro().total));
  protected readonly bs = bs;
  protected readonly dateAndTime = dateAndTime;
  protected readonly statusLabel = ROTULO_DE_ESTADO;
  protected readonly statusTone = TONO_DE_ESTADO;
  protected readonly planNotes = computed(
    () => this.cobro().plan?.instances.flatMap((i) => i.salesNotes.map((n) => n.number)) ?? [],
  );

  protected readonly methodOptions = computed(() =>
    this.catalogos().paymentMethods.map((m) => ({ value: m.codigo, label: catalogWithoutMark(m.descripcion) })),
  );
  protected readonly documentOptions = computed(() =>
    this.catalogos().identityDocumentTypes.map((m) => ({ value: m.codigo, label: catalogWithoutMark(m.descripcion) })),
  );

  protected readonly form = new FormGroup({
    methodCode: new FormControl<number | null>(null),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    documentTypeCode: new FormControl<number | null>(1, Validators.required),
    documentNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    complement: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
  });

  ngOnInit(): void {
    const cobro = this.cobro();
    this.form.reset({
      methodCode: null,
      name: cobro.suggestedBuyer.name,
      documentTypeCode: cobro.suggestedBuyer.documentTypeCode,
      documentNumber: cobro.suggestedBuyer.documentNumber,
      complement: '',
      email: cobro.suggestedBuyer.email ?? '',
    });
    if (cobro.payment === null) {
      this.form.controls.methodCode.addValidators(Validators.required);
    }
    // Con factura vigente, el modal abre mostrándola: no se factura dos veces.
    if (hasCurrentInvoice(cobro) && cobro.latestInvoice !== null) {
      this.invoiceLoading.set(true);
      this.client
        .invoice(cobro.latestInvoice.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (f) => {
            this.invoiceLoading.set(false);
            this.invoice.set(f);
          },
          error: (e: unknown) => {
            this.invoiceLoading.set(false);
            this.error.set(errorMessage(e, 'No se pudo leer la factura del simulador.'));
          },
        });
    }
  }

  protected confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const entrada: IssueInvoiceInput = {
      buyer: {
        name: v.name.trim(),
        documentTypeCode: Number(v.documentTypeCode),
        documentNumber: v.documentNumber.trim(),
        complement: v.complement.trim() === '' ? null : v.complement.trim(),
        email: v.email.trim() === '' ? null : v.email.trim(),
      },
    };
    const id = this.cobro().id;
    const pago: Observable<unknown> = this.paymentMeansRequests()
      ? this.client.registerPayment(id, Number(v.methodCode))
      : of(null);

    this.sending.set(true);
    this.error.set(null);
    pago
      .pipe(
        switchMap((cobroPagado) => {
          if (cobroPagado !== null) {
            this.registeredPayment.set(true);
            this.pagado.emit();
          }
          return this.client.issueInvoice(id, entrada);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (factura) => {
          this.sending.set(false);
          this.emitida.emit(factura);
          if (factura.status === 'REJECTED') {
            this.error.set(
              `El SIAT simulado rechazó la factura (${factura.siatResponse.codigoEstado} · ${factura.siatResponse.codigoDescripcion}). Revise los datos y vuelva a intentar.`,
            );
            return;
          }
          this.invoice.set(factura);
        },
        error: (e: unknown) => {
          this.sending.set(false);
          // El cobro ya estaba pagado (lo pagó otra persona, o el dato era
          // viejo): el reintento sólo tiene que facturar, no volver a cobrar.
          if (!this.registeredPayment() && alreadyPaidWas(e)) {
            this.registeredPayment.set(true);
            this.pagado.emit();
            this.error.set('El cobro ya estaba pagado. Confirme de nuevo para emitir la factura.');
            return;
          }
          this.error.set(errorMessage(e, 'No se pudo emitir la factura en el simulador.'));
        },
      });
  }

  protected async downloadPdf(factura: SimulatedInvoice): Promise<void> {
    await downloadGraphicRepresentation(factura);
  }

  protected downloadXml(factura: SimulatedInvoice): void {
    downloadXml(factura);
  }
}

/** 409 con `reason: ALREADY_PAID`: el pago que se quería registrar ya existía. */
function alreadyPaidWas(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return false;
  const cuerpo: unknown = error.error;
  if (typeof cuerpo !== 'object' || cuerpo === null) return false;
  const detalles = (cuerpo as { details?: { reason?: unknown } }).details;
  return detalles?.reason === 'ALREADY_PAID';
}
