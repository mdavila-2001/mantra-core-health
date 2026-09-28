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
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { estadoDeCobro, ROTULO_DE_ESTADO, TONO_DE_ESTADO } from '../../../../billing/billing-summary';
import {
  accionDeCobro,
  bs,
  centavos,
  cobradoDeCobro,
  deCentavos,
  ACCION_COMPLETA,
  ROTULO_DE_ACCION,
  saldoDeCobro,
  sinMarcaDeCatalogo,
  tipoDeServicio,
} from '../../../../billing/cobros-en-pantalla';
import { FacturaSimuladaDialog } from '../../../../billing/factura-simulada-dialog/factura-simulada-dialog';
import { PlanDePagos } from '../../../../billing/plan-de-pagos/plan-de-pagos';

type Celda = TemplateRef<{ $implicit: SimulatedCharge }>;

/** Lo que la vista necesita, leído de una vez. */
export interface CobrosDeLaPersona {
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
 * <app-cobros-del-paciente [patientProfileId]="id" />
 * ```
 *
 * Una fila por servicio, con lo que se esperaba cobrar y lo pagado. Lo que
 * se abre depende del **tipo de servicio**:
 *
 * - si implica más de una instancia de pago —una consulta con su serie de
 *   reconsultas—, se abre la **tabla del plan** (`app-plan-de-pagos`): cada
 *   pago lleva nota de venta hasta saldarlo, y recién entonces se factura;
 * - si es de una sola instancia, se abre **directamente el modal de la
 *   factura** (`app-factura-simulada-dialog`), que cobra y emite contra el
 *   SIAT simulado.
 *
 * Después de cada escritura se **relee** del backend simulado: lo que se ve
 * es lo que quedó guardado, no lo que la pantalla supone.
 */
@Component({
  selector: 'app-cobros-del-paciente',
  imports: [Alert, AppButton, Chip, DataTable, FacturaSimuladaDialog, PlanDePagos],
  templateUrl: './cobros-del-paciente.html',
  styleUrl: './cobros-del-paciente.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CobrosDelPaciente {
  private readonly client = inject(BillingSimulatedClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toast = inject(ToastService);

  readonly patientProfileId = input.required<string>();

  /** Reintento o relectura: cambiarlo vuelve a disparar la lectura. */
  private readonly intento = signal(0);

  protected readonly estado = signal<ViewState<CobrosDeLaPersona>>(loading());
  protected readonly datos = computed(() => dataOf(this.estado()));
  protected readonly cobros = computed(() => this.datos()?.cobros ?? []);
  protected readonly filas = computed(() => ready(this.cobros()));

  /** El cobro cuyo plan está abierto; se busca por id para ver siempre el releído. */
  protected readonly planAbiertoId = signal<string | null>(null);
  protected readonly planAbierto = computed(() => this.cobros().find((c) => c.id === this.planAbiertoId()) ?? null);
  /** El cobro cuyo modal de factura está abierto. */
  protected readonly facturandoId = signal<string | null>(null);
  protected readonly facturando = computed(() => this.cobros().find((c) => c.id === this.facturandoId()) ?? null);

  protected readonly metodos = computed(() =>
    (this.datos()?.catalogos.paymentMethods ?? []).map((m) => ({ value: m.codigo, label: sinMarcaDeCatalogo(m.descripcion) })),
  );

  protected readonly totales = computed(() => {
    const cobros = this.cobros();
    const suma = (f: (c: SimulatedCharge) => string) => deCentavos(cobros.reduce((s, c) => s + centavos(f(c)), 0));
    return { cobrado: bs(suma(cobradoDeCobro)), saldo: bs(suma(saldoDeCobro)) };
  });

  protected readonly bs = bs;
  protected readonly rotuloDeEstado = ROTULO_DE_ESTADO;
  protected readonly tonoDeEstado = TONO_DE_ESTADO;
  protected readonly rotuloDeAccion = ROTULO_DE_ACCION;
  protected readonly accionCompleta = ACCION_COMPLETA;
  protected readonly estadoDe = estadoDeCobro;
  protected readonly accionDe = accionDeCobro;
  protected readonly tipoDe = tipoDeServicio;
  protected readonly cobradoDe = cobradoDeCobro;

  private readonly servicioCell = viewChild<Celda>('servicioCell');
  private readonly esperadoCell = viewChild<Celda>('esperadoCell');
  private readonly pagadoCell = viewChild<Celda>('pagadoCell');
  private readonly estadoCell = viewChild<Celda>('estadoCell');
  private readonly accionCell = viewChild<Celda>('accionCell');
  /** `read: ElementRef`: sobre `button[app-button]` la referencia sería el componente. */
  private readonly volver = viewChild<unknown, ElementRef<HTMLElement>>('volver', { read: ElementRef });

  protected readonly columnas = computed<readonly ColumnDef<SimulatedCharge>[]>(() => [
    { key: 'service', header: 'Servicio', priority: 1, cell: this.servicioCell() },
    // Con poca caja (`fitContainer`: teléfono, o el modal a 1024 px) los
    // importes se pliegan al detalle de la fila y viajan en la primera celda
    // («Pagado X de Y»): con la acción fija al borde no entra más.
    { key: 'expected', header: 'Monto a cobrar', priority: 3, align: 'end', cell: this.esperadoCell() },
    { key: 'paid', header: 'Monto pagado', priority: 3, align: 'end', cell: this.pagadoCell() },
    { key: 'status', header: 'Estado', priority: 3, cell: this.estadoCell() },
    { key: 'action', header: 'Acción', priority: 1, sticky: 'end', cell: this.accionCell() },
  ]);

  protected readonly porId = (c: SimulatedCharge): string => c.id;
  protected readonly nombreDeFila = (c: SimulatedCharge): string => c.description;

  constructor() {
    toObservable(computed(() => ({ paciente: this.patientProfileId(), intento: this.intento() })), {
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
              ready<CobrosDeLaPersona>({
                // Los más recientes primero: es el servicio del que se está hablando.
                cobros: [...cobros.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
                catalogos,
                emisores: estadoFiscal?.issuers ?? [],
              }),
            ),
            // Una relectura no vuelve a «cargando»: la tabla no parpadea ni pierde el foco.
            startWith(this.datos() === null ? loading() : this.estado()),
            catchError((error: unknown) => {
              // Si ya había datos, una relectura fallida no los borra: el modal
              // de la factura que esté abierto cuelga de ellos. Se avisa y listo.
              if (this.datos() !== null) {
                this.toast.warning('No pudimos releer los cobros. Lo que ves puede estar atrasado.', 'Pagos');
                return of(this.estado());
              }
              return of(errorToViewState<CobrosDeLaPersona>(error));
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((estado) => this.estado.set(estado));
  }

  protected recargar(): void {
    this.intento.update((n) => n + 1);
  }

  protected emisorDe(cobro: SimulatedCharge): SimulatedIssuer | null {
    return this.datos()?.emisores.find((e) => e.id === cobro.issuerId) ?? null;
  }

  /** Con plan se abre la tabla; sin plan, directamente el modal de la factura. */
  protected abrir(cobro: SimulatedCharge): void {
    if (cobro.plan !== null) {
      this.planAbiertoId.set(cobro.id);
      afterNextRender(() => this.volver()?.nativeElement.focus(), { injector: this.injector });
      return;
    }
    this.facturandoId.set(cobro.id);
  }

  protected cerrarPlan(): void {
    const id = this.planAbiertoId();
    this.planAbiertoId.set(null);
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

  protected cerrarFactura(): void {
    const id = this.facturandoId();
    this.facturandoId.set(null);
    // El foco vuelve a donde se abrió: la vuelta del plan, o la fila.
    afterNextRender(
      () => {
        if (this.planAbierto() !== null) {
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
  protected readonly idDePeticion = computed(() => {
    const estado = this.estado();
    return estado.status === 'error' ? estado.requestId : null;
  });
}
