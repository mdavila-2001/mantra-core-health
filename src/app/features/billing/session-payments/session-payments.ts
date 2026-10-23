import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';

import { PaymentProofsClient } from '../../../core/data-access/billing/payment-proofs.client';
import {
  CHARGE_STATUS_LABEL,
  COVERAGE_LABEL,
  formatMinor,
  METHOD_LABEL,
  PROOF_STATUS_LABEL,
  type ChargePaymentStatus,
  type ProviderPaymentRow,
  type ProviderPaymentTablePage,
} from '../../../core/data-access/billing/payment-proofs.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { historialDeCursor } from '../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';

type Cell = TemplateRef<{ $implicit: ProviderPaymentRow }>;

const TAMANO_DE_PAGINA = 20;

const VARIANTE_DE_ESTADO: Readonly<Record<ChargePaymentStatus, BadgeVariant>> = {
  PAID: 'success',
  PENDING: 'warning',
  NOT_PRICED: 'info',
};

/**
 * MD-06 / Q-P3 · «Pagos por sesión»: la tabla de pagos del prestador.
 *
 * Una fila por consulta del médico (o de la organización, para la
 * administración): paciente, fecha, monto, lo que cubre el seguro, el estado
 * del cobro —derivado del comprobante aceptado, no de una bandera manual— y
 * el comprobante. Lee `GET /billing/me/provider-payment-table`, paginada por
 * cursor; el alcance lo decide la API.
 */
@Component({
  selector: 'app-session-payments',
  templateUrl: './session-payments.html',
  styleUrl: './session-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, Badge, DatePipe],
})
export class SessionPayments {
  private readonly pagos = inject(PaymentProofsClient);
  private readonly paginado = historialDeCursor();

  protected readonly cursor = this.paginado.cursor;
  protected readonly estado = signal<ViewState<readonly ProviderPaymentRow[]>>(loading());
  protected readonly totales = signal<ProviderPaymentTablePage['totals'] | null>(null);

  private readonly pacienteCell = viewChild<Cell>('pacienteCell');
  private readonly fechaCell = viewChild<Cell>('fechaCell');
  private readonly montoCell = viewChild<Cell>('montoCell');
  private readonly seguroCell = viewChild<Cell>('seguroCell');
  private readonly estadoCell = viewChild<Cell>('estadoCell');
  private readonly comprobanteCell = viewChild<Cell>('comprobanteCell');

  protected readonly columnas = computed<readonly ColumnDef<ProviderPaymentRow>[]>(() => [
    { key: 'patient', header: 'Paciente', priority: 1, cell: this.pacienteCell() },
    { key: 'date', header: 'Fecha', priority: 2, cell: this.fechaCell() },
    { key: 'amount', header: 'Monto', priority: 1, align: 'end', cell: this.montoCell() },
    { key: 'insurance', header: 'Seguro', priority: 2, cell: this.seguroCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.estadoCell() },
    { key: 'proof', header: 'Comprobante', priority: 2, cell: this.comprobanteCell() },
  ]);

  protected readonly resumen = computed(() => {
    const t = this.totales();
    if (t === null) return '';
    return `${t.sessions} ${t.sessions === 1 ? 'sesión' : 'sesiones'} · cobrado ${formatMinor(t.paidMinor)} · pendiente ${formatMinor(t.pendingMinor)}`;
  });

  protected readonly porFila = (fila: ProviderPaymentRow): string => fila.chargeId;
  protected readonly monto = formatMinor;

  // Las celdas reciben la fila sin tipo (`let-fila`): los métodos la tipan.
  protected estadoDe(fila: ProviderPaymentRow): string {
    return CHARGE_STATUS_LABEL[fila.status];
  }

  protected variante(fila: ProviderPaymentRow): BadgeVariant {
    return VARIANTE_DE_ESTADO[fila.status];
  }

  protected seguro(fila: ProviderPaymentRow): string {
    return COVERAGE_LABEL[fila.coverageStatus];
  }

  protected comprobanteDe(fila: ProviderPaymentRow): { metodo: string; estado: string } | null {
    return fila.proof === null
      ? null
      : { metodo: METHOD_LABEL[fila.proof.method], estado: PROOF_STATUS_LABEL[fila.proof.status] };
  }

  constructor() {
    this.cargar();
  }

  protected mover(cursor: string): void {
    this.paginado.mover(cursor);
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    const cursorActual = this.paginado.actual();
    this.pagos
      .providerPaymentTable({
        limit: TAMANO_DE_PAGINA,
        ...(cursorActual === undefined ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          this.paginado.llego(pagina.nextCursor);
          this.totales.set(pagina.totals);
          this.estado.set(
            pagina.items.length > 0
              ? ready(pagina.items)
              : empty(
                  { label: 'Ir a la agenda', route: '/appointments' },
                  'Cuando atienda una consulta, su cobro aparece acá con el estado del pago y el comprobante del paciente.',
                ),
          );
        },
        error: (error: unknown) => {
          this.paginado.llego(null);
          this.estado.set(errorToViewState<readonly ProviderPaymentRow[]>(error));
        },
      });
  }
}
