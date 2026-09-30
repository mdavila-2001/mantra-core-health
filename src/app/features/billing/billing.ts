import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, type Observable } from 'rxjs';

import { BillingSimulatedClient } from '../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  InvoiceEventKind,
  IssueInvoiceInput,
  SimulatedCatalogs,
  SimulatedCharge,
  SimulatedFiscalStatus,
  SimulatedInvoice,
  SimulatedIssuer,
  SimulatedOutboxEntry,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import { readApiError } from '../../core/http/api-error';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { Input } from '../../shared/components/atoms/input/input';
import { Select } from '../../shared/components/atoms/select/select';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  estadoDeCobro,
  filtrarCobros,
  OPCIONES_DE_ESTADO,
  OPCIONES_DE_ORIGEN,
  resumenDeCobros,
  ROTULO_DE_ESTADO,
  ROTULO_DE_ORIGEN,
  TONO_DE_ESTADO,
  type EstadoDeCobro,
  type FiltroDeEstado,
  type FiltroDeOrigen,
} from './billing-summary';
import { FACTURACION_SIMULADA_DISPONIBLE } from './facturacion-disponible';
import { montoLiteral } from './monto-literal';
import { PlanDePagos } from './plan-de-pagos/plan-de-pagos';
import { descargarRepresentacionGrafica, descargarXml } from './representacion-grafica';

type Operacion = 'pago' | 'factura' | 'anulacion' | 'reversion' | 'correo' | 'pdf';

interface DatosDeFacturacion {
  readonly cobros: readonly SimulatedCharge[];
  readonly catalogos: SimulatedCatalogs;
  readonly estadoFiscal: SimulatedFiscalStatus;
}

const ROTULO_DE_EVENTO: Readonly<Record<InvoiceEventKind, string>> = {
  PAYMENT_REGISTERED: 'Pago registrado',
  INVOICE_BUILT: 'Factura generada',
  SENT_TO_SIAT: 'Enviada al SIAT (SIMULADO)',
  SIAT_RESPONSE: 'Respuesta del SIAT (SIMULADO)',
  ANNULMENT: 'Anulación (SIMULADO)',
  ANNULMENT_REVERSAL: 'Reversión de anulación (SIMULADO)',
  EMAIL_QUEUED: 'Correo en bandeja simulada',
};

function centavos(importe: string): number {
  const [entero, decimales = ''] = importe.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

/**
 * Facturación — cobros de consultas y farmacia, pago y factura contra el
 * **SIAT SIMULADO** (FACT-SIAT-MOCK).
 *
 * Todo lo fiscal de esta pantalla es sintético: lo dice el aviso fijo de
 * arriba, cada estado lleva «(SIMULADO)» y cada documento descargable también.
 * Si la facturación simulada no está disponible (ver
 * {@link FACTURACION_SIMULADA_DISPONIBLE}) la pantalla lo dice y no pide nada.
 */
@Component({
  selector: 'app-billing',
  imports: [ReactiveFormsModule, AppButton, Card, Chip, FormField, Input, PageHeader, PlanDePagos, Select, ViewStateHost],
  templateUrl: './billing.html',
  styleUrl: './billing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing {
  private readonly client = inject(BillingSimulatedClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** El cobro cuyo «Ver» abrió el detalle: al cerrar, el foco vuelve a esa fila. */
  private abiertoDesde: string | null = null;

  readonly disponible = inject(FACTURACION_SIMULADA_DISPONIBLE)();

  readonly estado = signal<ViewState<DatosDeFacturacion>>(loading());
  readonly datos = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });

  readonly origen = signal<FiltroDeOrigen>('TODOS');
  readonly filtroDeEstado = signal<FiltroDeEstado>('TODOS');
  readonly opcionesDeOrigen = OPCIONES_DE_ORIGEN;
  readonly opcionesDeEstado = OPCIONES_DE_ESTADO;

  readonly visibles = computed(() => filtrarCobros(this.datos()?.cobros ?? [], this.origen(), this.filtroDeEstado()));
  readonly resumen = computed(() => resumenDeCobros(this.visibles()));

  readonly seleccionadoId = signal<string | null>(null);
  readonly seleccionado = computed(() => this.datos()?.cobros.find((c) => c.id === this.seleccionadoId()) ?? null);
  readonly factura = signal<SimulatedInvoice | null>(null);
  readonly bandeja = signal<readonly SimulatedOutboxEntry[]>([]);
  /** Qué operación está en curso, para deshabilitar y rotular el botón. */
  readonly operando = signal<Operacion | null>(null);

  readonly opcionesDeMetodo = computed(() =>
    (this.datos()?.catalogos.paymentMethods ?? []).map((m) => ({ value: m.codigo, label: m.descripcion })),
  );
  readonly opcionesDeDocumento = computed(() =>
    (this.datos()?.catalogos.identityDocumentTypes ?? []).map((m) => ({ value: m.codigo, label: m.descripcion })),
  );
  readonly opcionesDeMotivo = computed(() =>
    (this.datos()?.catalogos.annulmentReasons ?? []).map((m) => ({ value: m.codigo, label: m.descripcion })),
  );
  readonly opcionesDeSimulacion = computed(() => [
    { value: 0, label: 'Sin forzar: que respondan las reglas' },
    ...(this.datos()?.catalogos.forceableMessages ?? []).map((m) => ({
      value: m.codigo,
      label: `${m.advertencia ? 'Observar' : 'Rechazar'} con ${m.codigo} · ${m.descripcion}`,
    })),
  ]);

  readonly formularioDePago = new FormGroup({
    methodCode: new FormControl<number | null>(null, Validators.required),
  });

  readonly formularioDeFactura = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    documentTypeCode: new FormControl<number | null>(1, Validators.required),
    documentNumber: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    complement: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    additionalDiscount: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d+(\.\d{1,2})?$/)] }),
    forceMessageCode: new FormControl<number | null>(0),
  });

  readonly formularioDeAnulacion = new FormGroup({
    reasonCode: new FormControl<number | null>(null, Validators.required),
  });

  readonly formularioDeCorreo = new FormGroup({
    to: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  readonly rotuloDeOrigen = ROTULO_DE_ORIGEN;
  readonly rotuloDeEstado = ROTULO_DE_ESTADO;
  readonly tonoDeEstado = TONO_DE_ESTADO;
  readonly rotuloDeEvento = ROTULO_DE_EVENTO;

  constructor() {
    if (this.disponible) this.cargar();
  }

  // ---- lectura ---------------------------------------------------------------

  cargar(): void {
    this.estado.set(loading());
    forkJoin({
      cobros: this.client.charges(),
      catalogos: this.client.catalogs(),
      estadoFiscal: this.client.status(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cobros, catalogos, estadoFiscal }) =>
          this.estado.set(ready({ cobros: cobros.items, catalogos, estadoFiscal })),
        error: (error: unknown) => this.estado.set(errorToViewState(error)),
      });
    this.cargarBandeja();
  }

  estadoDe(cobro: SimulatedCharge): EstadoDeCobro {
    return estadoDeCobro(cobro);
  }

  seleccionar(cobro: SimulatedCharge): void {
    this.seleccionadoId.set(cobro.id);
    this.abiertoDesde = cobro.id;
    // Después del render: el panel es un `@if` y todavía no existe en el DOM.
    afterNextRender(() => this.llevarAlDetalle(), { injector: this.injector });
    this.factura.set(null);
    this.formularioDePago.reset({ methodCode: null });
    this.formularioDeFactura.reset({
      name: cobro.suggestedBuyer.name,
      documentTypeCode: cobro.suggestedBuyer.documentTypeCode,
      documentNumber: cobro.suggestedBuyer.documentNumber,
      complement: '',
      email: cobro.suggestedBuyer.email ?? '',
      additionalDiscount: '',
      forceMessageCode: 0,
    });
    this.formularioDeCorreo.reset({ to: cobro.suggestedBuyer.email ?? '' });
    this.formularioDeAnulacion.reset({ reasonCode: null });
    if (cobro.latestInvoice !== null) {
      this.client
        .invoice(cobro.latestInvoice.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (f) => this.factura.set(f), error: (e: unknown) => this.avisarError(e) });
    }
  }

  cerrarDetalle(): void {
    const origen = this.abiertoDesde;
    this.seleccionadoId.set(null);
    this.factura.set(null);
    this.abiertoDesde = null;
    if (origen !== null) {
      afterNextRender(() => this.volverALaFila(origen), { injector: this.injector });
    }
  }

  /** Se puede facturar: pagado y sin una factura vigente (validada u observada). */
  puedeFacturar(cobro: SimulatedCharge): boolean {
    const estado = estadoDeCobro(cobro);
    return estado === 'SIN_FACTURAR' || estado === 'REJECTED' || estado === 'ANNULLED';
  }

  /** Vista previa del total con el descuento adicional escrito. */
  totalConDescuento(cobro: SimulatedCharge): string | null {
    const descuento = this.formularioDeFactura.controls.additionalDiscount.value.trim();
    if (descuento !== '' && !/^\d+(\.\d{1,2})?$/.test(descuento)) return null;
    const c = centavos(cobro.total) - (descuento === '' ? 0 : centavos(descuento));
    return c < 0 ? null : `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
  }

  literal(importe: string | null): string {
    return importe === null ? '' : montoLiteral(importe);
  }

  // ---- escrituras --------------------------------------------------------------

  registrarPago(cobro: SimulatedCharge): void {
    const metodo = this.formularioDePago.controls.methodCode.value;
    if (metodo === null) {
      this.formularioDePago.markAllAsTouched();
      return;
    }
    this.ejecutar('pago', this.client.registerPayment(cobro.id, Number(metodo)), (actualizado) => {
      this.reemplazarCobro(actualizado);
      this.toast.success('Pago registrado en el simulador. No se movió dinero real.', 'Pago (SIMULADO)');
    });
  }

  confirmarFacturacion(cobro: SimulatedCharge): void {
    if (this.formularioDeFactura.invalid) {
      this.formularioDeFactura.markAllAsTouched();
      return;
    }
    const v = this.formularioDeFactura.getRawValue();
    const forzar = Number(v.forceMessageCode ?? 0);
    const entrada: IssueInvoiceInput = {
      buyer: {
        name: v.name.trim(),
        documentTypeCode: Number(v.documentTypeCode),
        documentNumber: v.documentNumber.trim(),
        complement: v.complement.trim() === '' ? null : v.complement.trim(),
        email: v.email.trim() === '' ? null : v.email.trim(),
      },
      additionalDiscount: v.additionalDiscount.trim() === '' ? null : v.additionalDiscount.trim(),
      ...(forzar > 0 ? { simulation: { forceMessageCode: forzar } } : {}),
    };
    this.ejecutar('factura', this.client.issueInvoice(cobro.id, entrada), (factura) => {
      this.factura.set(factura);
      this.refrescarCobros();
      if (factura.status === 'REJECTED') {
        this.toast.warning(`El SIAT simulado rechazó la factura (${factura.siatResponse.codigoEstado}).`, 'Factura rechazada (SIMULADO)');
      } else {
        this.toast.success(`Factura N.º ${factura.invoiceNumber}: ${factura.siatResponse.codigoDescripcion}.`, 'Factura (SIMULADO)');
      }
    });
  }

  anular(factura: SimulatedInvoice): void {
    const motivo = this.formularioDeAnulacion.controls.reasonCode.value;
    if (motivo === null) {
      this.formularioDeAnulacion.markAllAsTouched();
      return;
    }
    this.ejecutar('anulacion', this.client.annul(factura.id, { reasonCode: Number(motivo) }), (actualizada) => {
      this.factura.set(actualizada);
      this.refrescarCobros();
    });
  }

  revertirAnulacion(factura: SimulatedInvoice): void {
    this.ejecutar('reversion', this.client.revertAnnulment(factura.id), (actualizada) => {
      this.factura.set(actualizada);
      this.refrescarCobros();
    });
  }

  enviarPorCorreo(factura: SimulatedInvoice): void {
    if (this.formularioDeCorreo.invalid) {
      this.formularioDeCorreo.markAllAsTouched();
      return;
    }
    this.ejecutar('correo', this.client.emailInvoice(factura.id, this.formularioDeCorreo.getRawValue().to), (entrada) => {
      this.toast.info(`Quedó en la bandeja simulada para ${entrada.to}. No se envió ningún correo.`, 'Correo (SIMULADO)');
      this.cargarBandeja();
      this.client
        .invoice(factura.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (f) => this.factura.set(f), error: (e: unknown) => this.avisarError(e) });
    });
  }

  async descargarPdf(factura: SimulatedInvoice): Promise<void> {
    this.operando.set('pdf');
    try {
      await descargarRepresentacionGrafica(factura);
    } finally {
      this.operando.set(null);
    }
  }

  descargarXml(factura: SimulatedInvoice): void {
    descargarXml(factura);
  }

  // ---- privados ----------------------------------------------------------------

  private reducirMovimiento(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  }

  /**
   * El detalle se abre debajo de la tabla: sin esto, «Ver» no mostraba nada a
   * la vista (QA manual). Baja hasta el panel y deja el foco en su título, para
   * que el lector de pantalla anuncie qué se abrió y el teclado siga desde ahí.
   */
  private llevarAlDetalle(): void {
    const titulo = this.document.getElementById('titulo-detalle');
    if (titulo === null) return;
    titulo.scrollIntoView?.({ behavior: this.reducirMovimiento() ? 'auto' : 'smooth', block: 'start' });
    titulo.focus({ preventScroll: true });
  }

  /** Al cerrar, el foco vuelve al «Ver» de la fila que abrió el detalle. */
  private volverALaFila(cobroId: string): void {
    const boton = Array.from(this.document.querySelectorAll<HTMLElement>('[data-charge-id]')).find(
      (b) => b.dataset['chargeId'] === cobroId,
    );
    if (boton === undefined) return;
    boton.scrollIntoView?.({ behavior: this.reducirMovimiento() ? 'auto' : 'smooth', block: 'center' });
    boton.focus({ preventScroll: true });
  }

  private ejecutar<T>(operacion: Operacion, peticion: Observable<T>, alTerminar: (valor: T) => void): void {
    this.operando.set(operacion);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (valor) => {
        this.operando.set(null);
        alTerminar(valor);
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarError(error);
      },
    });
  }

  private avisarError(error: unknown): void {
    const cuerpo = error instanceof HttpErrorResponse ? readApiError(error) : null;
    this.toast.error(cuerpo?.message || 'No se pudo completar la operación en el simulador.', 'Facturación (SIMULADO)');
  }

  /** El emisor del cobro, para el encabezado de sus notas de venta. */
  emisorDe(cobro: SimulatedCharge): SimulatedIssuer | null {
    return this.datos()?.estadoFiscal.issuers.find((e) => e.id === cobro.issuerId) ?? null;
  }

  protected reemplazarCobro(cobro: SimulatedCharge): void {
    const actual = this.datos();
    if (actual === null) return;
    this.estado.set(ready({ ...actual, cobros: actual.cobros.map((c) => (c.id === cobro.id ? cobro : c)) }));
  }

  private refrescarCobros(): void {
    forkJoin({ cobros: this.client.charges(), estadoFiscal: this.client.status() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cobros, estadoFiscal }) => {
          const actual = this.datos();
          if (actual !== null) this.estado.set(ready({ ...actual, cobros: cobros.items, estadoFiscal }));
        },
        error: (e: unknown) => this.avisarError(e),
      });
  }

  private cargarBandeja(): void {
    this.client
      .outbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (b) => this.bandeja.set(b.items), error: () => this.bandeja.set([]) });
  }
}
