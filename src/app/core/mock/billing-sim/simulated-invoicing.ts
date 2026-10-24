/* ============================================================================
    «MANTRA facturación», simulada (FACT-SIAT-MOCK).

    Es el lado de MANTRA del flujo: cobros de consultas y de farmacia, el pago
    (simulado) de un cobro, y la emisión de la factura contra la administración
    tributaria **a través de `FiscalProviderPort`**. No sabe si del otro lado
    hay un simulador o el SIAT: sólo pide CUIS/CUFD, sincroniza la hora, arma
    el XML del documento sector, calcula el CUF, empaqueta y envía.

    Esto es lo que la API hará de verdad cuando exista facturación; acá vive en
    el backend simulado del front (CA-3) y todo lo que produce es sintético y
    va marcado.

    Decisiones que lo gobiernan: CA-1 (consultas y farmacia en sector 1, el 17
    no se emite), CA-2 (Computarizada en Línea), CA-4 (emisores y NIT
    ficticios), CA-6 (sin contingencia).
    ========================================================================== */

import type {
  BuyerInput,
  ChargeLine,
  ChargeSource,
  InvoiceEvent,
  IssueInvoiceInput,
  PlanInstanceKind,
  SiatResponse,
  SimulatedCatalogs,
  SimulatedCharge,
  SimulatedFiscalCredentials,
  SimulatedFiscalStatus,
  SimulatedInvoice,
  SimulatedInvoiceStatus,
  SimulatedInvoiceSummary,
  SimulatedIssuer,
  SimulatedOutboxEntry,
  SimulatedPayment,
  SimulatedPaymentPlan,
  SimulatedPlanInstance,
  SimulatedSalesNote,
  SuggestedBuyer,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { Coleccion } from '../mock-store';
import { sha256Hex } from '../sha256';
import { SIMULATED_CATALOGS, existsInCatalog } from '../siat-sim/simulated-catalogs';
import { SIAT_MESSAGE_DESCRIPTION, SIAT_STATUS, SIAT_MESSAGE, isWarning } from '../siat-sim/siat-codes';
import { fechaHoraParaCuf, generarCuf } from '../siat-sim/cuf';
import { packageXml } from '../siat-sim/packaging';
import { PURCHASE_SALE_SCHEMA } from '../siat-sim/siat-schema';
import { buildInvoiceXml, type RowXml } from '../siat-sim/invoice-xml';
import type {
  ContextoFiscal,
  FiscalProviderPort,
  MensajeServicio,
  RespuestaRecepcion,
  SolicitudRecepcion,
} from '../siat-sim/fiscal-provider.port';

// ---- tipos internos ------------------------------------------------------------

/** El emisor ficticio con lo que sólo MANTRA sabe de él. */
export interface EmisorSimulado {
  readonly issuer: SimulatedIssuer;
  readonly codigoSistema: string;
  /** Código de actividad **sintético** (≤ 10 caracteres, como el XSD). */
  readonly actividadEconomica: string;
  /** `codigoProductoSin` **sintético**. */
  readonly codigoProductoSin: number;
}

/** Un cobro tal como nace: sin pago ni factura. */
export interface InitialCharge {
  readonly id: string;
  readonly source: ChargeSource;
  readonly sourceRef: string;
  readonly issuerId: string;
  readonly patientProfileId: string;
  readonly patientName: string;
  /** Quien atendió la consulta; farmacia no lo tiene. */
  readonly practitionerProfileId?: string | null;
  readonly description: string;
  readonly lines: readonly ChargeLine[];
  readonly createdAt: string;
  readonly suggestedBuyer: SuggestedBuyer;
  /** Si la maqueta ya lo da por pagado (T-E4, consultas pagadas). */
  readonly payment: SimulatedPayment | null;
  /**
   * El plan, si el tipo de servicio implica más de una instancia de pago (una
   * consulta con su serie de reconsultas). Con plan, los renglones del cobro
   * salen de sus instancias: los que traiga el cobro se ignoran.
   */
  readonly plan?: ChargePlan | null;
}

/** Una instancia del plan como se guarda: los importes derivados se calculan al leer. */
export interface PlanInstance {
  readonly id: string;
  readonly kind: PlanInstanceKind;
  readonly label: string;
  readonly expectedAmount: string;
  readonly bookingId: string | null;
  readonly scheduledAt: string | null;
  readonly salesNotes: readonly SimulatedSalesNote[];
}

export interface ChargePlan {
  readonly serviceCode: string;
  readonly serviceName: string;
  readonly instances: readonly PlanInstance[];
}

interface SavedCharge extends InitialCharge {
  readonly total: string;
}

interface SavedInvoice extends SimulatedInvoice {
  /** 908 u 904, para volver ahí después de revertir una anulación. */
  readonly statusAtReception: SimulatedInvoiceStatus;
}

interface Credentials extends SimulatedFiscalCredentials {
  readonly id: string;
  readonly codigoControl: string | null;
}

interface Counter {
  readonly id: string;
  readonly ultimo: number;
}

export type ErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_PAID'
  | 'PAYMENT_REQUIRED'
  | 'ALREADY_INVOICED'
  | 'INVALID_INPUT'
  | 'FISCAL_CREDENTIALS'
  /** El servicio tiene plan: se paga instancia por instancia, no de una vez. */
  | 'PLAN_REQUIRED'
  /** Se pidió pagar una instancia de un servicio que no tiene plan. */
  | 'NOT_A_PLAN';

export interface InvoicingError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly issues?: readonly { readonly field: string; readonly problem: string }[];
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: InvoicingError };

export interface InvoicingOptions {
  readonly siat: FiscalProviderPort;
  readonly emisores: readonly EmisorSimulado[];
  readonly cobros: readonly InitialCharge[];
  readonly reloj?: () => Date;
  readonly clavePersistencia?: string;
}

// ---- utilidades -------------------------------------------------------------------

const DECIMAL = /^\d+(\.\d{1,2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensajes del catálogo oficial que la directiva de simulación puede forzar. */
const FORCEABLE_MESSAGES = [
  SIAT_MESSAGE.MONTO_TOTAL_ERRONEO,
  SIAT_MESSAGE.SUBTOTAL_ERRONEO,
  SIAT_MESSAGE.MONTO_TOTAL_SUJETO_IVA_ERRONEO,
  SIAT_MESSAGE.CUF_INVALIDO,
  SIAT_MESSAGE.CUFD_NO_VIGENTE,
  SIAT_MESSAGE.ADVERTENCIA_CORRELATIVIDAD,
  SIAT_MESSAGE.ADVERTENCIA_NIT_DEL_CLIENTE_NO_VALIDO,
] as const;

function cents(valor: string | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  const [entero, decimales = ''] = valor.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

function importe(centavosTotales: number): string {
  const signo = centavosTotales < 0 ? '-' : '';
  const abs = Math.abs(centavosTotales);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Subtotal de un renglón: cantidad × precio − descuento, en centavos. */
export function lineSubtotal(cantidad: string, precioUnitario: string, descuento: string | null): string {
  return importe(Math.round((cents(cantidad) * cents(precioUnitario)) / 100) - cents(descuento));
}

export function linesTotal(lineas: readonly ChargeLine[]): string {
  return importe(lineas.reduce((suma, l) => suma + cents(l.subtotal), 0));
}

/** Unidad de medida 58 del SIAT, «unidad servicio»: la de consultas y reconsultas. */
const SERVICE_UNIT = 58;

/** Los renglones de un cobro con plan: uno por instancia, al monto esperado. */
export function planLines(plan: ChargePlan): ChargeLine[] {
  return plan.instances.map((i) => ({
    productCode: plan.serviceCode,
    description: `${plan.serviceName} · ${i.label}`,
    quantity: '1',
    unitOfMeasure: SERVICE_UNIT,
    unitPrice: i.expectedAmount,
    discount: null,
    subtotal: lineSubtotal('1', i.expectedAmount, null),
  }));
}

function instancePaid(instancia: PlanInstance): number {
  return instancia.salesNotes.reduce((suma, n) => suma + cents(n.amount), 0);
}

function settledPlan(plan: ChargePlan): boolean {
  return plan.instances.every((i) => instancePaid(i) >= cents(i.expectedAmount));
}

/** El número de una nota de venta, `NV-000042` → 42. */
function noteNumber(nota: SimulatedSalesNote): number {
  return Number(nota.number.replace(/^NV-/, '')) || 0;
}

function responseStatus(codigoEstado: number): SimulatedInvoiceStatus {
  if (codigoEstado === SIAT_STATUS.RECEPCION_VALIDADA) return 'VALIDATED';
  if (codigoEstado === SIAT_STATUS.RECEPCION_OBSERVADA) return 'OBSERVED';
  return 'REJECTED';
}

function error<T>(code: ErrorCode, message: string, issues?: InvoicingError['issues']): Result<T> {
  return { ok: false, error: { code, message, ...(issues === undefined ? {} : { issues }) } };
}

function textAsMessages(mensajes: readonly MensajeServicio[]): string {
  return mensajes.map((m) => `${m.codigo} ${m.descripcion}`).join('; ');
}

// ---- el servicio -------------------------------------------------------------------

export class SimulatedInvoicing {
  private readonly siat: FiscalProviderPort;
  private readonly issuers: ReadonlyMap<string, EmisorSimulado>;
  private readonly clock: () => Date;
  private readonly charges: Coleccion<SavedCharge>;
  private readonly invoices = new Coleccion<SavedInvoice>();
  private readonly credentials = new Coleccion<Credentials>();
  private readonly counters = new Coleccion<Counter>();
  private readonly inbox = new Coleccion<SimulatedOutboxEntry>();

  constructor(opciones: InvoicingOptions) {
    this.siat = opciones.siat;
    this.issuers = new Map(opciones.emisores.map((e) => [e.issuer.id, e]));
    this.clock = opciones.reloj ?? (() => new Date());
    this.charges = new Coleccion<SavedCharge>(opciones.cobros.map((c) => this.normalize(c)));
    const clave = opciones.clavePersistencia;
    if (clave !== undefined) {
      this.charges.persistirEn(`${clave}.cobros`);
      this.invoices.persistirEn(`${clave}.facturas`);
      this.credentials.persistirEn(`${clave}.credenciales`);
      this.counters.persistirEn(`${clave}.contadores`);
      this.inbox.persistirEn(`${clave}.bandeja`);
    }
  }

  // ---- lecturas ------------------------------------------------------------------

  listCharges(): SimulatedCharge[] {
    return this.charges
      .todos()
      .sort((a, b) => (b.payment?.paidAt ?? b.createdAt).localeCompare(a.payment?.paidAt ?? a.createdAt))
      .map((c) => this.aCharge(c));
  }

  charge(id: string): SimulatedCharge | null {
    const guardado = this.charges.get(id);
    return guardado === undefined ? null : this.aCharge(guardado);
  }

  invoice(id: string): SimulatedInvoice | null {
    const guardada = this.invoices.get(id);
    return guardada === undefined ? null : this.toInvoice(guardada);
  }

  outputInbox(): SimulatedOutboxEntry[] {
    return this.inbox.todos().sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
  }

  catalogs(): SimulatedCatalogs {
    const c = SIMULATED_CATALOGS;
    const sinFuente = (e: { codigo: number; descripcion: string; origen: 'EJEMPLO_OFICIAL' | 'SIMULADO' }) => ({
      codigo: e.codigo,
      descripcion: e.descripcion,
      origen: e.origen,
    });
    return {
      paymentMethods: c.metodosDePago.map(sinFuente),
      identityDocumentTypes: c.tiposDeDocumentoDeIdentidad.map(sinFuente),
      annulmentReasons: c.motivosDeAnulacion.map(sinFuente),
      forceableMessages: FORCEABLE_MESSAGES.map((codigo) => ({
        codigo,
        descripcion: SIAT_MESSAGE_DESCRIPTION[codigo],
        advertencia: isWarning(codigo),
      })),
      simulated: true,
    };
  }

  statusFiscal(): SimulatedFiscalStatus {
    const primero = [...this.issuers.values()][0];
    return {
      environment: 'SIMULADO',
      modality: 2,
      serverTime: primero === undefined ? '' : this.siat.sincronizarFechaHora(this.context(primero)).fechaHora,
      issuers: [...this.issuers.values()].map((e) => e.issuer),
      credentials: [...this.issuers.values()].map((e) => {
        const c = this.credentials.get(e.issuer.id);
        return {
          issuerId: e.issuer.id,
          cuis: c?.cuis ?? null,
          cuisValidUntil: c?.cuisValidUntil ?? null,
          cufd: c?.cufd ?? null,
          cufdValidUntil: c?.cufdValidUntil ?? null,
        };
      }),
      simulated: true,
    };
  }

  // ---- pago ------------------------------------------------------------------------

  registerPayment(cobroId: string, methodCode: number): Result<SimulatedCharge> {
    const cobro = this.charges.get(cobroId);
    if (cobro === undefined) return error('NOT_FOUND', 'El cobro no existe');
    if (cobro.payment !== null) return error('ALREADY_PAID', 'El cobro ya está pagado');
    if (cobro.plan) {
      return error('PLAN_REQUIRED', 'El servicio tiene plan de pagos: se paga instancia por instancia, con nota de venta');
    }
    const metodo = SIMULATED_CATALOGS.metodosDePago.find((m) => m.codigo === methodCode);
    if (metodo === undefined) {
      return error('INVALID_INPUT', 'Método de pago inválido', [{ field: 'methodCode', problem: 'no está en el catálogo simulado' }]);
    }
    const payment: SimulatedPayment = {
      id: `pago-${sha256Hex(`${cobroId}|${this.clock().getTime()}`).slice(0, 16)}`,
      methodCode,
      methodLabel: metodo.descripcion,
      amount: cobro.total,
      currency: 'BOB',
      paidAt: this.clock().toISOString(),
      simulated: true,
    };
    return { ok: true, value: this.aCharge(this.charges.actualizar(cobroId, { payment })!) };
  }

  /**
   * El pago de una instancia del plan. Emite una **nota de venta**, nunca una
   * factura: la factura es una sola, por el total del servicio, y se emite
   * cuando el plan queda saldado. Con este pago saldado, el cobro recibe su
   * `payment` y pasa a poder facturarse.
   */
  instanceRegisterPayment(
    cobroId: string,
    instanciaId: string,
    entrada: { readonly methodCode: number; readonly amount: string },
  ): Result<SimulatedCharge> {
    const cobro = this.charges.get(cobroId);
    if (cobro === undefined) return error('NOT_FOUND', 'El cobro no existe');
    const plan = cobro.plan;
    if (!plan) return error('NOT_A_PLAN', 'El servicio es de una sola instancia: se cobra y se factura de una vez');
    const instancia = plan.instances.find((i) => i.id === instanciaId);
    if (instancia === undefined) return error('NOT_FOUND', 'La instancia no es de este plan');

    const problemas: { field: string; problem: string }[] = [];
    const metodo = SIMULATED_CATALOGS.metodosDePago.find((m) => m.codigo === Number(entrada?.methodCode));
    if (metodo === undefined) problemas.push({ field: 'methodCode', problem: 'no está en el catálogo simulado' });
    const monto = String(entrada?.amount ?? '').trim();
    const saldo = cents(instancia.expectedAmount) - instancePaid(instancia);
    if (saldo <= 0) {
      return error('ALREADY_PAID', `«${instancia.label}» ya está pagada`);
    }
    if (!DECIMAL.test(monto) || cents(monto) <= 0) {
      problemas.push({ field: 'amount', problem: 'decimal mayor que cero con hasta 2 decimales' });
    } else if (cents(monto) > saldo) {
      problemas.push({ field: 'amount', problem: `no puede superar el saldo de la instancia (${importe(saldo)})` });
    }
    if (problemas.length > 0 || metodo === undefined) return error('INVALID_INPUT', 'Pago inválido', problemas);

    const ahora = this.clock().toISOString();
    const numero = this.saleUltimaNote(cobro.issuerId) + 1;
    const nota: SimulatedSalesNote = {
      id: `nota-${sha256Hex(`${cobroId}|${instanciaId}|${numero}|${ahora}`).slice(0, 16)}`,
      number: `NV-${String(numero).padStart(6, '0')}`,
      instanceId: instanciaId,
      amount: importe(cents(monto)),
      methodCode: metodo.codigo,
      methodLabel: metodo.descripcion,
      issuedAt: ahora,
      simulated: true,
    };
    const siguiente: ChargePlan = {
      ...plan,
      instances: plan.instances.map((i) => (i.id === instanciaId ? { ...i, salesNotes: [...i.salesNotes, nota] } : i)),
    };
    const actualizado = this.charges.actualizar(cobroId, {
      plan: siguiente,
      payment: settledPlan(siguiente) ? this.planPayment(cobro, nota) : null,
    })!;
    return { ok: true, value: this.aCharge(actualizado) };
  }

  // ---- emisión -----------------------------------------------------------------------

  issueInvoice(cobroId: string, entrada: IssueInvoiceInput, usuario: string): Result<SimulatedInvoice> {
    const cobro = this.charges.get(cobroId);
    if (cobro === undefined) return error('NOT_FOUND', 'El cobro no existe');
    if (cobro.payment === null) {
      return error(
        'PAYMENT_REQUIRED',
        cobro.plan
          ? 'El plan de pagos todavía tiene saldo: hasta saldarlo, cada pago lleva nota de venta y no factura'
          : 'El cobro todavía no está pagado',
      );
    }
    const vigente = this.currentInvoice(cobroId);
    if (vigente !== null) return error('ALREADY_INVOICED', `El cobro ya tiene la factura ${vigente.invoiceNumber} vigente`);

    const problemas = this.entryProblems(entrada, cobro.total);
    if (problemas.length > 0) return error('INVALID_INPUT', 'Datos de facturación inválidos', problemas);

    const emisor = this.issuers.get(cobro.issuerId)!;
    const credenciales = this.ensureCredentials(emisor);
    if (!credenciales.ok) return credenciales;
    const { cuis, cufd, codigoControl } = credenciales.value;

    const contexto = this.context(emisor);
    const fechaEmision = this.siat.sincronizarFechaHora(contexto).fechaHora;
    const numeroFactura = (this.counters.get(emisor.issuer.id)?.ultimo ?? 0) + 1;
    const sector = emisor.issuer.documentSector;
    const cuf = generarCuf(
      {
        nit: emisor.issuer.nit,
        fechaHora: fechaHoraParaCuf(fechaEmision),
        sucursal: emisor.issuer.branchCode,
        modalidad: 2,
        tipoEmision: 1,
        tipoFactura: 1,
        tipoDocumentoSector: sector,
        numeroFactura,
        puntoVenta: emisor.issuer.pointOfSaleCode,
      },
      codigoControl,
    );

    const descuentoAdicional = entrada.additionalDiscount === undefined || entrada.additionalDiscount === null || entrada.additionalDiscount === '' ? null : entrada.additionalDiscount;
    const montoTotal = importe(cents(cobro.total) - cents(descuentoAdicional));
    const cabecera = this.header(emisor, cobro, entrada.buyer, {
      numeroFactura,
      cuf,
      cufd,
      fechaEmision,
      montoTotal,
      descuentoAdicional,
      usuario,
    });
    const detalle = cobro.lines.map((l) => this.line(emisor, l));
    const xml = buildInvoiceXml(PURCHASE_SALE_SCHEMA, { cabecera, detalle });
    const paquete = packageXml(xml);

    const solicitud: SolicitudRecepcion = {
      ...contexto,
      cuis,
      cufd,
      codigoDocumentoSector: sector,
      codigoEmision: 1,
      tipoFacturaDocumento: 1,
    };
    const forzar = entrada.simulation?.forceMessageCode;
    const respuesta = this.siat.recepcionFactura(
      { ...solicitud, archivo: paquete.archivo, hashArchivo: paquete.hashArchivo, fechaEnvio: fechaEmision },
      forzar === undefined ? undefined : { forzarMensaje: forzar },
    );
    const status = responseStatus(respuesta.codigoEstado);
    if (status !== 'REJECTED') this.counters.agregar({ id: emisor.issuer.id, ultimo: numeroFactura });

    const ahora = this.clock().toISOString();
    const events: InvoiceEvent[] = [
      { kind: 'PAYMENT_REGISTERED', at: cobro.payment.paidAt, siatStatusCode: null, detail: this.paymentDetail(cobro) },
      { kind: 'INVOICE_BUILT', at: ahora, siatStatusCode: null, detail: `Factura N.º ${numeroFactura} · sector ${sector} · CUF generado` },
      { kind: 'SENT_TO_SIAT', at: ahora, siatStatusCode: null, detail: `XML gzip ${paquete.bytesComprimidos} bytes · SHA-256 ${paquete.hashArchivo.slice(0, 12)}…` },
      this.responseEvent('SIAT_RESPONSE', respuesta, ahora),
    ];
    const guardada: SavedInvoice = {
      // Con el ordinal: un reintento tras un rechazo puede repetir el CUF
      // (mismo número, mismo instante) y no debe pisar el registro rechazado.
      id: `factura-${sha256Hex(`${cuf}|${this.invoices.tamano}`).slice(0, 16)}`,
      chargeId: cobro.id,
      issuer: emisor.issuer,
      documentSector: sector,
      modality: 2,
      invoiceNumber: numeroFactura,
      cuf,
      cufd,
      issuedAt: fechaEmision,
      cabecera,
      detalle,
      xml,
      hashArchivo: paquete.hashArchivo,
      compressedBytes: paquete.bytesComprimidos,
      status,
      statusAtReception: status,
      siatResponse: this.aResponse(respuesta),
      events,
      simulated: true,
    };
    this.invoices.agregar(guardada);
    return { ok: true, value: this.toInvoice(guardada) };
  }

  // ---- anulación y reversión ---------------------------------------------------------

  void(facturaId: string, reasonCode: number): Result<SimulatedInvoice> {
    return this.operateOnInvoice(facturaId, (base, factura) => {
      const respuesta = this.siat.anulacionFactura({ ...base, cuf: factura.cuf, codigoMotivo: reasonCode });
      const status: SimulatedInvoiceStatus = respuesta.codigoEstado === SIAT_STATUS.ANULACION_CONFIRMADA ? 'ANNULLED' : factura.status;
      return { respuesta, status, kind: 'ANNULMENT' as const };
    });
  }

  revertVoiding(facturaId: string): Result<SimulatedInvoice> {
    return this.operateOnInvoice(facturaId, (base, factura) => {
      const respuesta = this.siat.reversionAnulacionFactura({ ...base, cuf: factura.cuf });
      const status: SimulatedInvoiceStatus =
        respuesta.codigoEstado === SIAT_STATUS.REVERSION_ANULACION_CONFIRMADA ? factura.statusAtReception : factura.status;
      return { respuesta, status, kind: 'ANNULMENT_REVERSAL' as const };
    });
  }

  // ---- entrega -------------------------------------------------------------------------

  /** Encola el «envío» del XML y la representación gráfica. **No envía nada.** */
  enqueueEmail(facturaId: string, to: string): Result<SimulatedOutboxEntry> {
    const factura = this.invoices.get(facturaId);
    if (factura === undefined) return error('NOT_FOUND', 'La factura no existe');
    if (!EMAIL.test(to)) return error('INVALID_INPUT', 'Correo inválido', [{ field: 'to', problem: 'no es un correo' }]);
    if (factura.status === 'REJECTED') {
      return error('INVALID_INPUT', 'Una factura rechazada no se entrega', [{ field: 'invoiceId', problem: 'rechazada' }]);
    }
    const ahora = this.clock().toISOString();
    const entrada: SimulatedOutboxEntry = {
      id: `correo-${sha256Hex(`${facturaId}|${to}|${ahora}|${this.inbox.tamano}`).slice(0, 16)}`,
      invoiceId: facturaId,
      to,
      attachments: [`factura-${factura.invoiceNumber}-SIMULADA.xml`, `factura-${factura.invoiceNumber}-SIMULADA.pdf`],
      status: 'NOT_SENT_SIMULATED',
      queuedAt: ahora,
      simulated: true,
    };
    this.inbox.agregar(entrada);
    this.invoices.actualizar(facturaId, {
      events: [...factura.events, { kind: 'EMAIL_QUEUED', at: ahora, siatStatusCode: null, detail: `A ${to} · bandeja simulada, no se envía` }],
    });
    return { ok: true, value: entrada };
  }

  // ---- privados ----------------------------------------------------------------------

  /** Con plan, los renglones salen de las instancias, y un plan saldado ya trae su pago. */
  private normalize(c: InitialCharge): SavedCharge {
    if (!c.plan) return { ...c, plan: null, total: linesTotal(c.lines) };
    const lines = planLines(c.plan);
    const base: SavedCharge = { ...c, lines, total: linesTotal(lines) };
    if (base.payment !== null || !settledPlan(c.plan)) return base;
    const ultima = c.plan.instances
      .flatMap((i) => i.salesNotes)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
      .at(-1);
    return ultima === undefined ? base : { ...base, payment: this.planPayment(base, ultima) };
  }

  /**
   * El pago de un plan saldado, para que la factura se emita igual que la de
   * un cobro de una sola vez: por el total, con el medio del último pago.
   */
  private planPayment(cobro: SavedCharge, ultima: SimulatedSalesNote): SimulatedPayment {
    return {
      id: `pago-${sha256Hex(`${cobro.id}|plan|${ultima.id}`).slice(0, 16)}`,
      methodCode: ultima.methodCode,
      methodLabel: ultima.methodLabel,
      amount: cobro.total,
      currency: 'BOB',
      paidAt: ultima.issuedAt,
      simulated: true,
    };
  }

  private paymentDetail(cobro: SavedCharge): string {
    const pago = cobro.payment!;
    if (!cobro.plan) return `${pago.methodLabel} · Bs ${pago.amount}`;
    const notas = cobro.plan.instances.flatMap((i) => i.salesNotes).map((n) => n.number);
    return `Plan saldado · ${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} de venta (${notas.join(', ')}) · Bs ${pago.amount}`;
  }

  /** El correlativo de notas de venta es por emisor, como el de facturas. */
  private saleUltimaNote(issuerId: string): number {
    return this.charges
      .filtrar((c) => c.issuerId === issuerId)
      .flatMap((c) => c.plan?.instances.flatMap((i) => i.salesNotes) ?? [])
      .reduce((mayor, n) => Math.max(mayor, noteNumber(n)), 0);
  }

  private aPlan(plan: ChargePlan): SimulatedPaymentPlan {
    const instances = plan.instances.map((i, indice): SimulatedPlanInstance => {
      const pagado = instancePaid(i);
      return {
        id: i.id,
        sequence: indice + 1,
        kind: i.kind,
        label: i.label,
        expectedAmount: i.expectedAmount,
        paidAmount: importe(pagado),
        balance: importe(Math.max(cents(i.expectedAmount) - pagado, 0)),
        bookingId: i.bookingId,
        scheduledAt: i.scheduledAt,
        salesNotes: [...i.salesNotes].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)),
      };
    });
    const esperado = plan.instances.reduce((s, i) => s + cents(i.expectedAmount), 0);
    const pagado = plan.instances.reduce((s, i) => s + instancePaid(i), 0);
    return {
      serviceCode: plan.serviceCode,
      serviceName: plan.serviceName,
      instances,
      expectedTotal: importe(esperado),
      paidTotal: importe(pagado),
      balance: importe(Math.max(esperado - pagado, 0)),
      complete: settledPlan(plan),
    };
  }

  private context(emisor: EmisorSimulado): ContextoFiscal {
    return {
      nit: emisor.issuer.nit,
      codigoSistema: emisor.codigoSistema,
      codigoSucursal: emisor.issuer.branchCode,
      codigoPuntoVenta: emisor.issuer.pointOfSaleCode,
      codigoModalidad: 2,
    };
  }

  private currentInvoice(cobroId: string): SavedInvoice | null {
    return this.invoices.filtrar((f) => f.chargeId === cobroId && (f.status === 'VALIDATED' || f.status === 'OBSERVED'))[0] ?? null;
  }

  private ultimaInvoice(cobroId: string): SavedInvoice | null {
    return (
      this.invoices
        .filtrar((f) => f.chargeId === cobroId)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0] ?? null
    );
  }

  private entryProblems(entrada: IssueInvoiceInput, total: string): { field: string; problem: string }[] {
    const problemas: { field: string; problem: string }[] = [];
    const comprador: Partial<BuyerInput> = entrada?.buyer ?? {};
    const nombre = (comprador.name ?? '').trim();
    if (nombre.length < 1 || nombre.length > 500) problemas.push({ field: 'buyer.name', problem: 'entre 1 y 500 caracteres' });
    if (!existsInCatalog(SIMULATED_CATALOGS.tiposDeDocumentoDeIdentidad, Number(comprador.documentTypeCode))) {
      problemas.push({ field: 'buyer.documentTypeCode', problem: 'no está en el catálogo simulado' });
    }
    const documento = (comprador.documentNumber ?? '').trim();
    if (documento.length < 1 || documento.length > 20) problemas.push({ field: 'buyer.documentNumber', problem: 'entre 1 y 20 caracteres' });
    const complemento = comprador.complement ?? null;
    if (complemento !== null && complemento.length > 5) problemas.push({ field: 'buyer.complement', problem: 'hasta 5 caracteres' });
    const correo = comprador.email ?? null;
    if (correo !== null && correo !== '' && !EMAIL.test(correo)) problemas.push({ field: 'buyer.email', problem: 'no es un correo' });
    const descuento = entrada?.additionalDiscount ?? null;
    if (descuento !== null && descuento !== '') {
      if (!DECIMAL.test(descuento)) problemas.push({ field: 'additionalDiscount', problem: 'decimal no negativo con hasta 2 decimales' });
      else if (cents(descuento) >= cents(total)) problemas.push({ field: 'additionalDiscount', problem: 'tiene que ser menor que el total' });
    }
    return problemas;
  }

  /** CUIS y CUFD vigentes; los pide al proveedor si faltan o vencieron. */
  private ensureCredentials(emisor: EmisorSimulado): Result<{ cuis: string; cufd: string; codigoControl: string }> {
    const ahora = this.clock();
    const id = emisor.issuer.id;
    const contexto = this.context(emisor);
    let actual: Credentials = this.credentials.get(id) ?? {
      id,
      issuerId: id,
      cuis: null,
      cuisValidUntil: null,
      cufd: null,
      cufdValidUntil: null,
      codigoControl: null,
    };
    if (actual.cuis === null || actual.cuisValidUntil === null || new Date(actual.cuisValidUntil) <= ahora) {
      const r = this.siat.solicitudCuis(contexto);
      if (!r.transaccion || r.codigo === null) {
        return error('FISCAL_CREDENTIALS', `No se obtuvo el CUIS simulado: ${textAsMessages(r.mensajesList)}`);
      }
      actual = { ...actual, cuis: r.codigo, cuisValidUntil: r.fechaVigencia, cufd: null, cufdValidUntil: null, codigoControl: null };
    }
    if (actual.cufd === null || actual.cufdValidUntil === null || actual.codigoControl === null || new Date(actual.cufdValidUntil) <= ahora) {
      const r = this.siat.solicitudCufd({ ...contexto, cuis: actual.cuis! });
      if (!r.transaccion || r.codigo === null || r.codigoControl === null) {
        return error('FISCAL_CREDENTIALS', `No se obtuvo el CUFD simulado: ${textAsMessages(r.mensajesList)}`);
      }
      actual = { ...actual, cufd: r.codigo, cufdValidUntil: r.fechaVigencia, codigoControl: r.codigoControl };
    }
    this.credentials.agregar(actual);
    return { ok: true, value: { cuis: actual.cuis!, cufd: actual.cufd!, codigoControl: actual.codigoControl! } };
  }

  private header(
    emisor: EmisorSimulado,
    cobro: SavedCharge,
    comprador: BuyerInput,
    datos: {
      numeroFactura: number;
      cuf: string;
      cufd: string;
      fechaEmision: string;
      montoTotal: string;
      descuentoAdicional: string | null;
      usuario: string;
    },
  ): RowXml {
    const leyendas = SIMULATED_CATALOGS.leyendas;
    const leyenda = leyendas[datos.numeroFactura % leyendas.length]!.descripcionLeyenda;
    const complemento = comprador.complement === undefined || comprador.complement === '' ? null : comprador.complement;
    return {
      nitEmisor: emisor.issuer.nit,
      razonSocialEmisor: emisor.issuer.legalName,
      municipio: emisor.issuer.municipality,
      telefono: emisor.issuer.phone,
      numeroFactura: datos.numeroFactura,
      cuf: datos.cuf,
      cufd: datos.cufd,
      codigoSucursal: emisor.issuer.branchCode,
      direccion: emisor.issuer.address,
      codigoPuntoVenta: emisor.issuer.pointOfSaleCode,
      fechaEmision: datos.fechaEmision,
      nombreRazonSocial: comprador.name.trim(),
      codigoTipoDocumentoIdentidad: Number(comprador.documentTypeCode),
      numeroDocumento: comprador.documentNumber.trim(),
      complemento,
      codigoCliente: cobro.patientProfileId,
      codigoMetodoPago: cobro.payment!.methodCode,
      numeroTarjeta: null,
      montoTotal: datos.montoTotal,
      montoTotalSujetoIva: datos.montoTotal,
      codigoMoneda: 1,
      tipoCambio: '1',
      montoTotalMoneda: datos.montoTotal,
      montoGiftCard: null,
      descuentoAdicional: datos.descuentoAdicional,
      codigoExcepcion: null,
      cafc: null,
      leyenda,
      usuario: datos.usuario.slice(0, 100) || 'operador-simulado',
      codigoDocumentoSector: emisor.issuer.documentSector,
    };
  }

  private line(emisor: EmisorSimulado, linea: ChargeLine): RowXml {
    return {
      actividadEconomica: emisor.actividadEconomica,
      codigoProductoSin: emisor.codigoProductoSin,
      codigoProducto: linea.productCode.slice(0, 50),
      descripcion: linea.description.slice(0, 500),
      cantidad: linea.quantity,
      unidadMedida: linea.unitOfMeasure,
      precioUnitario: linea.unitPrice,
      montoDescuento: linea.discount,
      subTotal: linea.subtotal,
      numeroSerie: null,
      numeroImei: null,
    };
  }

  private operateOnInvoice(
    facturaId: string,
    operacion: (
      base: SolicitudRecepcion,
      factura: SavedInvoice,
    ) => { respuesta: RespuestaRecepcion; status: SimulatedInvoiceStatus; kind: 'ANNULMENT' | 'ANNULMENT_REVERSAL' },
  ): Result<SimulatedInvoice> {
    const factura = this.invoices.get(facturaId);
    if (factura === undefined) return error('NOT_FOUND', 'La factura no existe');
    const emisor = this.issuers.get(factura.issuer.id)!;
    const credenciales = this.ensureCredentials(emisor);
    if (!credenciales.ok) return credenciales;
    const base: SolicitudRecepcion = {
      ...this.context(emisor),
      cuis: credenciales.value.cuis,
      cufd: credenciales.value.cufd,
      codigoDocumentoSector: factura.documentSector,
      codigoEmision: 1,
      tipoFacturaDocumento: 1,
    };
    const { respuesta, status, kind } = operacion(base, factura);
    const ahora = this.clock().toISOString();
    const actualizada = this.invoices.actualizar(facturaId, {
      status,
      siatResponse: this.aResponse(respuesta),
      events: [...factura.events, this.responseEvent(kind, respuesta, ahora)],
    })!;
    return { ok: true, value: this.toInvoice(actualizada) };
  }

  private responseEvent(kind: InvoiceEvent['kind'], respuesta: RespuestaRecepcion, at: string): InvoiceEvent {
    const mensajes = respuesta.mensajesList.map((m) => `${m.codigo}${m.forzadoPorSimulacion ? ' (forzado)' : ''}`).join(', ');
    return {
      kind,
      at,
      siatStatusCode: respuesta.codigoEstado,
      detail: `${respuesta.codigoEstado} ${respuesta.codigoDescripcion}${mensajes === '' ? '' : ` · ${mensajes}`} (SIMULADO)`,
    };
  }

  private aResponse(r: RespuestaRecepcion): SiatResponse {
    return {
      transaccion: r.transaccion,
      codigoEstado: r.codigoEstado,
      codigoDescripcion: r.codigoDescripcion,
      codigoRecepcion: r.codigoRecepcion,
      mensajesList: r.mensajesList.map((m) => ({
        codigo: m.codigo,
        descripcion: m.descripcion,
        advertencia: m.advertencia,
        ...(m.forzadoPorSimulacion ? { forzadoPorSimulacion: true as const } : {}),
      })),
      simulated: true,
    };
  }

  private toInvoice(f: SavedInvoice): SimulatedInvoice {
    const { statusAtReception: _omitido, ...publica } = f;
    return publica;
  }

  private toSummary(f: SavedInvoice): SimulatedInvoiceSummary {
    return {
      id: f.id,
      invoiceNumber: f.invoiceNumber,
      cuf: f.cuf,
      status: f.status,
      siatStatusCode: f.siatResponse.codigoEstado,
      issuedAt: f.issuedAt,
      total: String(f.cabecera['montoTotal']),
      simulated: true,
    };
  }

  private aCharge(c: SavedCharge): SimulatedCharge {
    const ultima = this.ultimaInvoice(c.id);
    return {
      id: c.id,
      source: c.source,
      sourceRef: c.sourceRef,
      issuerId: c.issuerId,
      patientProfileId: c.patientProfileId,
      patientName: c.patientName,
      practitionerProfileId: c.practitionerProfileId ?? null,
      description: c.description,
      lines: c.lines,
      total: c.total,
      currency: 'BOB',
      createdAt: c.createdAt,
      payment: c.payment,
      suggestedBuyer: c.suggestedBuyer,
      latestInvoice: ultima === null ? null : this.toSummary(ultima),
      plan: c.plan ? this.aPlan(c.plan) : null,
      simulated: true,
    };
  }
}
