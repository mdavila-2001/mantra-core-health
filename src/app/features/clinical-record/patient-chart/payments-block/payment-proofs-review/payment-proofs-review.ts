import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { PaymentProofsClient } from '../../../../../core/data-access/billing/payment-proofs.client';
import {
  CHARGE_STATUS_LABEL,
  formatMinor,
  METHOD_LABEL,
  PROOF_STATUS_LABEL,
  type PaymentProof,
  type ProviderPaymentRow,
} from '../../../../../core/data-access/billing/payment-proofs.types';
import { readApiError } from '../../../../../core/http/api-error';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * MD-06 / PA-04 · Los comprobantes que el paciente subió, en la caja «Pagos»
 * de la consulta. El médico los acepta (el cobro queda pagado y la consulta se
 * puede cerrar y facturar) o los rechaza con motivo (el paciente lo ve).
 *
 * Lee la tabla del prestador filtrada por la persona: una sola llamada trae
 * cada consulta con su estado y su comprobante más relevante. La API decide el
 * alcance; ajeno, 404.
 */
@Component({
  selector: 'app-payment-proofs-review',
  templateUrl: './payment-proofs-review.html',
  styleUrl: './payment-proofs-review.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Alert, AppButton, Badge, ContentDialog, DatePipe],
})
export class PaymentProofsReview {
  private readonly pagos = inject(PaymentProofsClient);
  private readonly dialogos = inject(DialogService);
  private readonly avisos = inject(ToastService);

  readonly patientProfileId = input.required<string>();

  protected readonly estado = signal<ViewState<readonly ProviderPaymentRow[]>>(loading());
  /** El comprobante sobre el que hay una revisión en curso: bloquea el doble envío. */
  protected readonly revisando = signal<string | null>(null);
  /** El comprobante cuya captura está abierta en grande. */
  protected readonly ampliado = signal<PaymentProof | null>(null);

  /** S9: el ID de petición del error, para que soporte lo encuentre. */
  protected readonly idDePeticion = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.requestId : null;
  });

  /** Miniaturas ya traídas, por comprobante. */
  protected readonly miniaturas = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly conComprobante = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data.filter((fila) => fila.proof !== null) : [];
  });

  protected readonly monto = formatMinor;
  protected readonly etiquetaDeMetodo = METHOD_LABEL;
  protected readonly etiquetaDeComprobante = PROOF_STATUS_LABEL;
  protected readonly etiquetaDeCobro = CHARGE_STATUS_LABEL;

  constructor() {
    effect(() => {
      const persona = this.patientProfileId();
      untracked(() => this.cargar(persona));
    });
  }

  protected recargar(): void {
    this.cargar(this.patientProfileId());
  }

  protected async aceptar(comprobante: PaymentProof): Promise<void> {
    if (this.revisando() !== null) return;
    const confirmado = await this.dialogos.confirm({
      title: '¿Aceptar el comprobante?',
      message: `Se confirma el pago de ${formatMinor(comprobante.amountMinor, comprobante.currency)} (${METHOD_LABEL[comprobante.method]}). La consulta queda pagada y se puede cerrar y facturar.`,
      confirmLabel: 'Aceptar el pago',
    });
    if (!confirmado) return;
    this.revisando.set(comprobante.id);
    this.pagos.accept(comprobante.id).subscribe({
      next: () => {
        this.revisando.set(null);
        this.avisos.success('El cobro quedó pagado. El paciente recibió el aviso.', 'Pago confirmado');
        this.recargar();
      },
      error: (error: unknown) => this.fallo(error),
    });
  }

  protected async rechazar(comprobante: PaymentProof): Promise<void> {
    if (this.revisando() !== null) return;
    const motivo = await this.dialogos.confirmWithReason(
      {
        title: 'Rechazar el comprobante',
        message: 'El paciente va a ver este motivo y podrá subir otro comprobante.',
        confirmLabel: 'Rechazar',
        destructive: true,
      },
      {
        label: 'Motivo del rechazo',
        hint: 'Por ejemplo: «La captura no muestra el monto».',
        minLength: 3,
        maxLength: 500,
      },
    );
    if (motivo === null) return;
    this.revisando.set(comprobante.id);
    this.pagos.reject(comprobante.id, motivo).subscribe({
      next: () => {
        this.revisando.set(null);
        this.avisos.info('El paciente ve el motivo y puede subir otro.', 'Comprobante rechazado');
        this.recargar();
      },
      error: (error: unknown) => this.fallo(error),
    });
  }

  protected miniatura(comprobante: PaymentProof): string | null {
    return this.miniaturas().get(comprobante.id) ?? null;
  }

  private fallo(error: unknown): void {
    this.revisando.set(null);
    const cuerpo = error instanceof HttpErrorResponse ? readApiError(error) : null;
    if (cuerpo?.details?.['reason'] === 'PROOF_NOT_PENDING') {
      this.avisos.warning('Alguien ya lo revisó. Se muestra el estado actual.', 'Comprobante ya revisado');
    } else {
      this.avisos.error(cuerpo?.message ?? 'No se pudo guardar la revisión. Reintente.', 'Comprobante');
    }
    this.recargar();
  }

  private cargar(patientProfileId: string): void {
    this.estado.set(loading());
    this.pagos.providerPaymentTable({ patientProfileId, limit: 20 }).subscribe({
      next: (pagina) => {
        this.estado.set(ready(pagina.items));
        this.traerMiniaturas(pagina.items);
      },
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly ProviderPaymentRow[]>(error)),
    });
  }

  /**
   * La captura es PHI: viaja por el GET autenticado del comprobante (que la API
   * autoriza por contexto) y se muestra como `data:`. Si falla, la tarjeta dice
   * «Sin imagen» y la revisión sigue disponible.
   */
  private traerMiniaturas(filas: readonly ProviderPaymentRow[]): void {
    for (const fila of filas) {
      const comprobante = fila.proof;
      if (comprobante === null || comprobante.fileId === null || this.miniaturas().has(comprobante.id)) continue;
      this.pagos
        .proofImage(comprobante.id)
        .pipe(catchError(() => of(null)))
        .subscribe((url) => {
          if (url === null) return;
          const siguiente = new Map(this.miniaturas());
          siguiente.set(comprobante.id, url);
          this.miniaturas.set(siguiente);
        });
    }
  }
}
