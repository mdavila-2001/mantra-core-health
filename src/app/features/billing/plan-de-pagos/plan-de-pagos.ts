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
  output,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  SimulatedCharge,
  SimulatedIssuer,
  SimulatedPlanInstance,
  SimulatedSalesNote,
} from '../../../core/data-access/billing-simulated/billing-simulated.types';
import { ready } from '../../../core/view-state/view-state';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { ROTULO_DE_ESTADO, TONO_DE_ESTADO, estadoDeCobro } from '../billing-summary';
import { bs, centavos, fechaCorta, mensajeDeError, tieneFacturaVigente } from '../cobros-en-pantalla';
import { descargarNotaDeVenta } from '../nota-de-venta';

type Celda = TemplateRef<{ $implicit: SimulatedPlanInstance }>;

const DECIMAL = /^\d+(\.\d{1,2})?$/;

/**
 * **El plan de pagos de un servicio con reconsultas** — la tabla de la
 * pizarra: ítem, monto a cobrar, monto pagado y el comprobante de cada pago.
 *
 * ```html
 * <app-plan-de-pagos [cobro]="cobro" [metodos]="opciones" [emisor]="emisor"
 *                    (actualizado)="reemplazar($event)" (facturar)="abrirFactura(cobro)" />
 * ```
 *
 * ## Nota de venta, no factura, mientras haya saldo
 *
 * Cada pago de una instancia emite una **nota de venta** —comprobante
 * interno, sin validez fiscal— y no una factura. La factura es una sola, por
 * el total del servicio, y recién se ofrece cuando el plan queda saldado
 * (`plan.complete`): la emite el padre, con el modal del SIAT simulado, al
 * escuchar `facturar`.
 *
 * ## La autoridad es el backend simulado
 *
 * El formulario valida para no mandar lo que va a volver con 422, pero el
 * tope del monto lo decide el motor: si responde otra cosa, se muestra su
 * mensaje tal cual y la tabla no cambia.
 */
@Component({
  selector: 'app-plan-de-pagos',
  imports: [ReactiveFormsModule, Alert, AppButton, Chip, DataTable, FormField, Input, Select],
  templateUrl: './plan-de-pagos.html',
  styleUrl: './plan-de-pagos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanDePagos {
  private readonly client = inject(BillingSimulatedClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Un cobro **con** plan. Sin plan no hay nada que dibujar. */
  readonly cobro = input.required<SimulatedCharge>();
  readonly metodos = input.required<readonly SelectOption<number>[]>();
  /** Para el encabezado de la nota de venta; sin él, el papel dice «Consultorio». */
  readonly emisor = input<SimulatedIssuer | null>(null);
  /** En la pantalla de facturación la factura tiene su propio formulario. */
  readonly ofrecerFactura = input(true);

  /** El cobro como quedó después de un pago: el padre lo reemplaza en su lista. */
  readonly actualizado = output<SimulatedCharge>();
  /** El plan está saldado y se pidió la factura. */
  readonly facturar = output<void>();

  protected readonly plan = computed(() => this.cobro().plan);
  protected readonly filas = computed(() => ready(this.plan()?.instances ?? []));
  protected readonly vigente = computed(() => tieneFacturaVigente(this.cobro()));
  protected readonly estado = computed(() => estadoDeCobro(this.cobro()));
  protected readonly rotuloDeEstado = ROTULO_DE_ESTADO;
  protected readonly tonoDeEstado = TONO_DE_ESTADO;
  protected readonly bs = bs;
  protected readonly fecha = fechaCorta;

  /** La instancia cuyo pago se está cargando, o `null` con el formulario cerrado. */
  protected readonly pagando = signal<SimulatedPlanInstance | null>(null);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = new FormGroup({
    methodCode: new FormControl<number | null>(null, Validators.required),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(DECIMAL)],
    }),
  });

  private readonly itemCell = viewChild<Celda>('itemCell');
  private readonly esperadoCell = viewChild<Celda>('esperadoCell');
  private readonly pagadoCell = viewChild<Celda>('pagadoCell');
  private readonly comprobanteCell = viewChild<Celda>('comprobanteCell');
  private readonly accionCell = viewChild<Celda>('accionCell');
  private readonly tituloDelPago = viewChild<ElementRef<HTMLElement>>('tituloDelPago');

  protected readonly columnas = computed<readonly ColumnDef<SimulatedPlanInstance>[]>(() => [
    { key: 'item', header: 'Ítem', priority: 1, cell: this.itemCell() },
    // En el teléfono los importes se pliegan al detalle de la fila y viajan en
    // la primera celda («Pagado X de Y»): con la acción fija al borde, más de
    // dos columnas no entran en un modal de 340 px.
    { key: 'expected', header: 'Monto a cobrar', priority: 3, align: 'end', cell: this.esperadoCell() },
    { key: 'paid', header: 'Monto pagado', priority: 3, align: 'end', cell: this.pagadoCell() },
    { key: 'receipt', header: 'Nota de venta', priority: 3, cell: this.comprobanteCell() },
    { key: 'action', header: 'Acción', priority: 1, sticky: 'end', cell: this.accionCell() },
  ]);

  protected readonly porId = (fila: SimulatedPlanInstance): string => fila.id;
  protected readonly nombreDeFila = (fila: SimulatedPlanInstance): string => fila.label;

  /** Si el monto escrito supera el saldo de la instancia: se dice antes de enviarlo. */
  protected readonly excede = signal(false);

  protected abrirPago(instancia: SimulatedPlanInstance): void {
    this.error.set(null);
    this.excede.set(false);
    this.pagando.set(instancia);
    this.formulario.reset({ methodCode: this.metodos()[0]?.value ?? null, amount: instancia.balance });
    // El formulario es un `@if`: el título existe después del render.
    afterNextRender(() => this.tituloDelPago()?.nativeElement.focus(), { injector: this.injector });
  }

  protected cancelarPago(): void {
    this.pagando.set(null);
    this.error.set(null);
  }

  protected registrarPago(): void {
    const instancia = this.pagando();
    if (instancia === null) return;
    const { methodCode, amount } = this.formulario.getRawValue();
    const excede = DECIMAL.test(amount.trim()) && centavos(amount) > centavos(instancia.balance);
    this.excede.set(excede);
    if (this.formulario.invalid || methodCode === null || excede || centavos(amount) <= 0) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.client
      .registerInstancePayment(this.cobro().id, instancia.id, { methodCode, amount: amount.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cobro) => {
          this.enviando.set(false);
          this.pagando.set(null);
          const nota = cobro.plan?.instances.find((i) => i.id === instancia.id)?.salesNotes.at(-1);
          this.toast.success(
            cobro.plan?.complete
              ? `Nota de venta ${nota?.number ?? ''} emitida. El plan quedó saldado: ya se puede facturar.`
              : `Nota de venta ${nota?.number ?? ''} emitida. No es una factura: la factura se emite al saldar el plan.`,
            'Pago registrado (SIMULADO)',
          );
          this.actualizado.emit(cobro);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.error.set(mensajeDeError(error, 'No se pudo registrar el pago en el simulador.'));
        },
      });
  }

  protected descargar(instancia: SimulatedPlanInstance, nota: SimulatedSalesNote): void {
    descargarNotaDeVenta(this.cobro(), instancia, nota, this.emisor());
  }
}
