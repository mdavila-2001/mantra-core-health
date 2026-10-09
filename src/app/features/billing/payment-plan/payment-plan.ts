import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
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
import { bs, centavos, fechaCorta, mensajeDeError, tieneFacturaVigente } from '../on-screen-charges';
import { descargarNotaDeVenta } from '../sales-note';

type Celda = TemplateRef<{ $implicit: SimulatedPlanInstance }>;

const DECIMAL = /^\d+(\.\d{1,2})?$/;

/**
 * **El plan de pagos de un servicio con reconsultas** — la tabla de la
 * pizarra: ítem, monto a cobrar, monto pagado y el comprobante de cada pago.
 *
 * ```html
 * <app-payment-plan [cobro]="cobro" [metodos]="opciones" [emisor]="emisor"
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
  selector: 'app-payment-plan',
  imports: [ReactiveFormsModule, Alert, AppButton, Chip, DataTable, FormField, Input, Select],
  templateUrl: './payment-plan.html',
  styleUrl: './payment-plan.css',
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
  /**
   * La última nota emitida, dicha en el propio plan: el aviso flotante queda
   * debajo del fondo del modal (capa superior del `<dialog>`) y no se lee.
   */
  protected readonly ultimaNota = signal<string | null>(null);
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
    // Con poca caja (`fitContainer`: teléfono, o el modal a 1024 px) los
    // importes se pliegan al detalle de la fila y viajan en la primera celda
    // («Pagado X de Y»): con la acción fija al borde no entra más.
    { key: 'expected', header: 'Monto a cobrar', priority: 3, align: 'end', cell: this.esperadoCell() },
    { key: 'paid', header: 'Monto pagado', priority: 3, align: 'end', cell: this.pagadoCell() },
    { key: 'receipt', header: 'Nota de venta', priority: 3, cell: this.comprobanteCell() },
    { key: 'action', header: 'Acción', priority: 1, sticky: 'end', cell: this.accionCell() },
  ]);

  protected readonly porId = (fila: SimulatedPlanInstance): string => fila.id;
  protected readonly nombreDeFila = (fila: SimulatedPlanInstance): string => fila.label;

  /**
   * Lo que está mal en el monto, dicho antes de enviarlo: más que el saldo, o
   * cero. Se borra al volver a escribir.
   */
  protected readonly errorDeMonto = signal<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly avisoDeNota = viewChild<ElementRef<HTMLElement>>('avisoDeNota');
  private readonly cierre = viewChild<ElementRef<HTMLElement>>('cierre');
  private readonly cobroId = computed(() => this.cobro().id);
  /**
   * El último pago saldó el plan: el cierre todavía no existe (en la consulta
   * el padre relee antes de pasar el cobro nuevo), así que el foco se le da
   * cuando aparece. Sin esto caía en el aviso, que el cierre reemplaza.
   */
  protected readonly enfocarCierre = signal(false);

  constructor() {
    this.formulario.controls.amount.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.errorDeMonto.set(null));
    // Otro cobro, otro plan: en /billing el mismo componente pasa de un cobro
    // a otro sin recrearse, y un formulario abierto habría pagado una
    // instancia del plan anterior contra el cobro nuevo.
    effect(() => {
      const cierre = this.cierre();
      if (cierre !== undefined && untracked(this.enfocarCierre)) {
        this.enfocarCierre.set(false);
        cierre.nativeElement.focus();
      }
    });
    effect(() => {
      this.cobroId();
      untracked(() => {
        this.pagando.set(null);
        this.ultimaNota.set(null);
        this.error.set(null);
        this.errorDeMonto.set(null);
      });
    });
  }

  protected abrirPago(instancia: SimulatedPlanInstance): void {
    this.error.set(null);
    this.ultimaNota.set(null);
    this.pagando.set(instancia);
    this.formulario.reset({ methodCode: this.metodos()[0]?.value ?? null, amount: instancia.balance });
    this.errorDeMonto.set(null);
    // El formulario es un `@if`: el título existe después del render.
    afterNextRender(() => this.tituloDelPago()?.nativeElement.focus(), { injector: this.injector });
  }

  protected cancelarPago(): void {
    const instancia = this.pagando();
    this.pagando.set(null);
    this.error.set(null);
    // El foco vuelve al «Registrar pago» de la fila que abrió el formulario.
    afterNextRender(
      () => {
        const boton = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-instancia-id]')).find(
          (b) => b.dataset['instanciaId'] === instancia?.id,
        );
        boton?.focus();
      },
      { injector: this.injector },
    );
  }

  protected registrarPago(): void {
    const instancia = this.pagando();
    if (instancia === null) return;
    const { methodCode, amount } = this.formulario.getRawValue();
    const valido = DECIMAL.test(amount.trim());
    if (valido && centavos(amount) > centavos(instancia.balance)) {
      this.errorDeMonto.set('No puede superar el saldo de la instancia.');
    } else if (valido && centavos(amount) <= 0) {
      this.errorDeMonto.set('Tiene que ser mayor que cero.');
    }
    if (this.formulario.invalid || methodCode === null || this.errorDeMonto() !== null) {
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
          const aviso = cobro.plan?.complete
            ? `Nota de venta ${nota?.number ?? ''} por ${bs(nota?.amount ?? '0')} emitida. El plan quedó saldado: ya se puede facturar.`
            : `Nota de venta ${nota?.number ?? ''} por ${bs(nota?.amount ?? '0')} emitida. No es una factura: la factura se emite al saldar el plan.`;
          this.ultimaNota.set(aviso);
          this.toast.success(aviso, 'Pago registrado (SIMULADO)');
          // El formulario (y el botón con el foco) se fue: el foco pasa al
          // aviso o, si el plan quedó saldado, al cierre en cuanto exista.
          if (cobro.plan?.complete) {
            this.enfocarCierre.set(true);
          } else {
            afterNextRender(() => this.avisoDeNota()?.nativeElement.focus(), { injector: this.injector });
          }
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
