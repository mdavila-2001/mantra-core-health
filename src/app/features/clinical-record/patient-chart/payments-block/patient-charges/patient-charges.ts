import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { BillingSimulatedClient } from '../../../../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  SimulatedCatalogs,
  SimulatedCharge,
  SimulatedIssuer,
} from '../../../../../core/data-access/billing-simulated/billing-simulated.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { estadoDeCobro, ROTULO_DE_ESTADO, TONO_DE_ESTADO } from '../../../../billing/billing-summary';
import {
  chargeAction,
  bs,
  cents,
  chargeCharged,
  fromCents,
  COMPLETE_ACTION,
  ACTION_LABEL,
  chargeBalance,
  dateAndTime,
  catalogWithoutMark,
  serviceType,
} from '../../../../billing/on-screen-charges';
import { SimulatedInvoiceDialog } from '../../../../billing/simulated-invoice-dialog/simulated-invoice-dialog';
import { PaymentsPlan } from '../../../../billing/payment-plan/payment-plan';

type Cell = TemplateRef<{ $implicit: SimulatedCharge }>;

/** Lo que la vista necesita, leído de una vez. */
export interface PersonCharges {
  readonly cobros: readonly SimulatedCharge[];
  readonly catalogos: SimulatedCatalogs;
  readonly emisores: readonly SimulatedIssuer[];
}

/**
 * **Los cobros de la persona, con su plan de pagos y su factura** — la cara
 * de «Pagos» dentro de la consulta cuando la facturación simulada está
 * encendida (FACT-SIAT-MOCK).
 *
 * ```html
 * <app-patient-charges [patientProfileId]="id" />
 * ```
 *
 * Una fila por servicio, con lo que se esperaba cobrar y lo pagado. Lo que
 * se abre depende del **tipo de servicio**:
 *
 * - si implica más de una instancia de pago —una consulta con su serie de
 *   reconsultas—, se abre la **tabla del plan** (`app-payment-plan`): cada
 *   pago lleva nota de venta hasta saldarlo, y recién entonces se factura;
 * - si es de una sola instancia, se abre **directamente el modal de la
 *   factura** (`app-simulated-invoice-dialog`), que cobra y emite contra el
 *   SIAT simulado.
 *
 * Después de cada escritura se **relee** del backend simulado: lo que se ve
 * es lo que quedó guardado, no lo que la pantalla supone.
 */
@Component({
  selector: 'app-patient-charges',
  imports: [Alert, AppButton, Chip, DataTable, SimulatedInvoiceDialog, PaymentsPlan],
  templateUrl: './patient-charges.html',
  styleUrl: './patient-charges.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientCharges {
  private readonly client = inject(BillingSimulatedClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly patientProfileId = input.required<string>();

  /** Reintento o relectura: cambiarlo vuelve a disparar la lectura. */
  private readonly attempt = signal(0);

  protected readonly status = signal<ViewState<PersonCharges>>(loading());
  /**
   * S7 · cuándo se leyó por última vez lo que se ve, si una relectura falló.
   * Se dice dentro del bloque: el aviso flotante queda debajo del modal.
   */
  protected readonly lateFrom = signal<Date | null>(null);
  private ultimaReading: Date | null = null;
  protected readonly dateAndTime = dateAndTime;
  protected readonly data = computed(() => dataOf(this.status()));
  protected readonly charges = computed(() => this.data()?.cobros ?? []);
  protected readonly rows = computed(() => ready(this.charges()));

  /** El cobro cuyo plan está abierto; se busca por id para ver siempre el releído. */
  protected readonly openPlanId = signal<string | null>(null);
  protected readonly openPlan = computed(() => this.charges().find((c) => c.id === this.openPlanId()) ?? null);
  /** El cobro cuyo modal de factura está abierto. */
  protected readonly invoicingId = signal<string | null>(null);
  protected readonly invoicing = computed(() => this.charges().find((c) => c.id === this.invoicingId()) ?? null);

  protected readonly methods = computed(() =>
    (this.data()?.catalogos.paymentMethods ?? []).map((m) => ({ value: m.codigo, label: catalogWithoutMark(m.descripcion) })),
  );

  protected readonly totals = computed(() => {
    const cobros = this.charges();
    const suma = (f: (c: SimulatedCharge) => string) => fromCents(cobros.reduce((s, c) => s + cents(f(c)), 0));
    return { cobrado: bs(suma(chargeCharged)), saldo: bs(suma(chargeBalance)) };
  });

  protected readonly bs = bs;
  protected readonly statusLabel = ROTULO_DE_ESTADO;
  protected readonly statusTone = TONO_DE_ESTADO;
  protected readonly actionLabel = ACTION_LABEL;
  protected readonly completeAction = COMPLETE_ACTION;
  protected readonly statusOf = estadoDeCobro;
  protected readonly actionOf = chargeAction;
  protected readonly typeOf = serviceType;
  protected readonly chargedOf = chargeCharged;

  private readonly servicioCell = viewChild<Cell>('servicioCell');
  private readonly esperadoCell = viewChild<Cell>('esperadoCell');
  private readonly pagadoCell = viewChild<Cell>('pagadoCell');
  private readonly estadoCell = viewChild<Cell>('estadoCell');
  private readonly accionCell = viewChild<Cell>('accionCell');
  /** `read: ElementRef`: sobre `button[app-button]` la referencia sería el componente. */
  private readonly volver = viewChild<unknown, ElementRef<HTMLElement>>('volver', { read: ElementRef });

  protected readonly columns = computed<readonly ColumnDef<SimulatedCharge>[]>(() => [
    { key: 'service', header: 'Servicio', priority: 1, cell: this.servicioCell() },
    // Con poca caja (`fitContainer`: teléfono, o el modal a 1024 px) los
    // importes se pliegan al detalle de la fila y viajan en la primera celda
    // («Pagado X de Y»): con la acción fija al borde no entra más.
    { key: 'expected', header: 'Monto a cobrar', priority: 3, align: 'end', cell: this.esperadoCell() },
    { key: 'paid', header: 'Monto pagado', priority: 3, align: 'end', cell: this.pagadoCell() },
    { key: 'status', header: 'Estado', priority: 3, cell: this.estadoCell() },
    { key: 'action', header: 'Acción', priority: 1, sticky: 'end', cell: this.accionCell() },
  ]);

  protected readonly byId = (c: SimulatedCharge): string => c.id;
  protected readonly rowName = (c: SimulatedCharge): string => c.description;

  constructor() {
    toObservable(computed(() => ({ paciente: this.patientProfileId(), intento: this.attempt() })), {
      injector: this.injector,
    })
      .pipe(
        switchMap(({ paciente }) =>
          forkJoin({
            cobros: this.client.chargesOfPatient(paciente),
            catalogos: this.client.catalogs(),
            // Sólo aporta el emisor para el encabezado de la nota de venta: si
            // falla, el papel dice «Consultorio» y el resto sigue.
            estadoFiscal: this.client.status().pipe(catchError(() => of(null))),
          }).pipe(
            map(({ cobros, catalogos, estadoFiscal }) =>
              ready<PersonCharges>({
                // Los más recientes primero: es el servicio del que se está hablando.
                cobros: [...cobros.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
                catalogos,
                emisores: estadoFiscal?.issuers ?? [],
              }),
            ),
            // Una relectura no vuelve a «cargando»: la tabla no parpadea ni pierde el foco.
            startWith(this.data() === null ? loading() : this.status()),
            catchError((error: unknown) => {
              // Si ya había datos, una relectura fallida no los borra: el modal
              // de la factura que esté abierto cuelga de ellos. Se dice cuándo
              // se leyeron, en el propio bloque.
              if (this.data() !== null) {
                this.lateFrom.set(this.ultimaReading);
                return of(this.status());
              }
              return of(errorToViewState<PersonCharges>(error));
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((estado) => {
        if (estado.status === 'ready' && estado !== this.status()) {
          this.ultimaReading = new Date();
          this.lateFrom.set(null);
        }
        this.status.set(estado);
      });
  }

  protected reload(): void {
    this.attempt.update((n) => n + 1);
  }

  protected issuerOf(cobro: SimulatedCharge): SimulatedIssuer | null {
    return this.data()?.emisores.find((e) => e.id === cobro.issuerId) ?? null;
  }

  /** Con plan se abre la tabla; sin plan, directamente el modal de la factura. */
  protected open(cobro: SimulatedCharge): void {
    if (cobro.plan !== null) {
      this.openPlanId.set(cobro.id);
      afterNextRender(() => this.volver()?.nativeElement.focus(), { injector: this.injector });
      return;
    }
    this.invoicingId.set(cobro.id);
  }

  protected closePlan(): void {
    const id = this.openPlanId();
    this.openPlanId.set(null);
    // El foco vuelve a la acción de la fila que abrió el plan.
    afterNextRender(
      () => {
        const boton = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-cobro-id]')).find(
          (b) => b.dataset['cobroId'] === id,
        );
        boton?.focus();
      },
      { injector: this.injector },
    );
  }

  protected closeInvoice(): void {
    const id = this.invoicingId();
    this.invoicingId.set(null);
    // El foco vuelve a donde se abrió: la vuelta del plan, o la fila.
    afterNextRender(
      () => {
        if (this.openPlan() !== null) {
          this.volver()?.nativeElement.focus();
          return;
        }
        Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-cobro-id]'))
          .find((b) => b.dataset['cobroId'] === id)
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  /** El identificador de la petición que falló (S9), para dictárselo a soporte. */
  protected readonly requestId = computed(() => {
    const estado = this.status();
    return estado.status === 'error' ? estado.requestId : null;
  });
}
