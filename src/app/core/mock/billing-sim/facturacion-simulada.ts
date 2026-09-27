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
  SuggestedBuyer,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { Coleccion } from '../mock-store';
import { sha256Hex } from '../sha256';
import { CATALOGOS_SIMULADOS, existeEnCatalogo } from '../siat-sim/catalogos-simulados';
import { DESCRIPCION_MENSAJE_SIAT, ESTADO_SIAT, MENSAJE_SIAT, esAdvertencia } from '../siat-sim/codigos-siat';
import { fechaHoraParaCuf, generarCuf } from '../siat-sim/cuf';
import { empaquetarXml } from '../siat-sim/empaquetado';
import { ESQUEMA_COMPRA_VENTA } from '../siat-sim/esquema-siat';
import { construirXmlFactura, type FilaXml } from '../siat-sim/factura-xml';
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
export interface CobroInicial {
  readonly id: string;
  readonly source: ChargeSource;
  readonly sourceRef: string;
  readonly issuerId: string;
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly description: string;
  readonly lines: readonly ChargeLine[];
  readonly createdAt: string;
  readonly suggestedBuyer: SuggestedBuyer;
  /** Si la maqueta ya lo da por pagado (T-E4, consultas pagadas). */
  readonly payment: SimulatedPayment | null;
}

interface CobroGuardado extends CobroInicial {
  readonly total: string;
}

interface FacturaGuardada extends SimulatedInvoice {
  /** 908 u 904, para volver ahí después de revertir una anulación. */
  readonly statusAtReception: SimulatedInvoiceStatus;
}

interface Credenciales extends SimulatedFiscalCredentials {
  readonly id: string;
  readonly codigoControl: string | null;
}

interface Contador {
  readonly id: string;
  readonly ultimo: number;
}

export type CodigoDeError =
  | 'NOT_FOUND'
  | 'ALREADY_PAID'
  | 'PAYMENT_REQUIRED'
  | 'ALREADY_INVOICED'
  | 'INVALID_INPUT'
  | 'FISCAL_CREDENTIALS';

export interface ErrorDeFacturacion {
  readonly code: CodigoDeError;
  readonly message: string;
  readonly issues?: readonly { readonly field: string; readonly problem: string }[];
}

export type Resultado<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ErrorDeFacturacion };

export interface OpcionesFacturacion {
  readonly siat: FiscalProviderPort;
  readonly emisores: readonly EmisorSimulado[];
  readonly cobros: readonly CobroInicial[];
  readonly reloj?: () => Date;
  readonly clavePersistencia?: string;
}

// ---- utilidades -------------------------------------------------------------------

const DECIMAL = /^\d+(\.\d{1,2})?$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensajes del catálogo oficial que la directiva de simulación puede forzar. */
const MENSAJES_FORZABLES = [
  MENSAJE_SIAT.MONTO_TOTAL_ERRONEO,
  MENSAJE_SIAT.SUBTOTAL_ERRONEO,
  MENSAJE_SIAT.MONTO_TOTAL_SUJETO_IVA_ERRONEO,
  MENSAJE_SIAT.CUF_INVALIDO,
  MENSAJE_SIAT.CUFD_NO_VIGENTE,
  MENSAJE_SIAT.ADVERTENCIA_CORRELATIVIDAD,
  MENSAJE_SIAT.ADVERTENCIA_NIT_DEL_CLIENTE_NO_VALIDO,
] as const;

function centavos(valor: string | null | undefined): number {
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
export function subtotalDeRenglon(cantidad: string, precioUnitario: string, descuento: string | null): string {
  return importe(Math.round((centavos(cantidad) * centavos(precioUnitario)) / 100) - centavos(descuento));
}

export function totalDeRenglones(lineas: readonly ChargeLine[]): string {
  return importe(lineas.reduce((suma, l) => suma + centavos(l.subtotal), 0));
}

function estadoDeRespuesta(codigoEstado: number): SimulatedInvoiceStatus {
  if (codigoEstado === ESTADO_SIAT.RECEPCION_VALIDADA) return 'VALIDATED';
  if (codigoEstado === ESTADO_SIAT.RECEPCION_OBSERVADA) return 'OBSERVED';
  return 'REJECTED';
}

function error<T>(code: CodigoDeError, message: string, issues?: ErrorDeFacturacion['issues']): Resultado<T> {
  return { ok: false, error: { code, message, ...(issues === undefined ? {} : { issues }) } };
}

function mensajesComoTexto(mensajes: readonly MensajeServicio[]): string {
  return mensajes.map((m) => `${m.codigo} ${m.descripcion}`).join('; ');
}

// ---- el servicio -------------------------------------------------------------------

export class FacturacionSimulada {
  private readonly siat: FiscalProviderPort;
  private readonly emisores: ReadonlyMap<string, EmisorSimulado>;
  private readonly reloj: () => Date;
  private readonly cobros: Coleccion<CobroGuardado>;
  private readonly facturas = new Coleccion<FacturaGuardada>();
  private readonly credenciales = new Coleccion<Credenciales>();
  private readonly contadores = new Coleccion<Contador>();
  private readonly bandeja = new Coleccion<SimulatedOutboxEntry>();

  constructor(opciones: OpcionesFacturacion) {
    this.siat = opciones.siat;
    this.emisores = new Map(opciones.emisores.map((e) => [e.issuer.id, e]));
    this.reloj = opciones.reloj ?? (() => new Date());
    this.cobros = new Coleccion<CobroGuardado>(opciones.cobros.map((c) => ({ ...c, total: totalDeRenglones(c.lines) })));
    const clave = opciones.clavePersistencia;
    if (clave !== undefined) {
      this.cobros.persistirEn(`${clave}.cobros`);
      this.facturas.persistirEn(`${clave}.facturas`);
      this.credenciales.persistirEn(`${clave}.credenciales`);
      this.contadores.persistirEn(`${clave}.contadores`);
      this.bandeja.persistirEn(`${clave}.bandeja`);
    }
  }

  // ---- lecturas ------------------------------------------------------------------

  listarCobros(): SimulatedCharge[] {
    return this.cobros
      .todos()
      .sort((a, b) => (b.payment?.paidAt ?? b.createdAt).localeCompare(a.payment?.paidAt ?? a.createdAt))
      .map((c) => this.aCobro(c));
  }

  cobro(id: string): SimulatedCharge | null {
    const guardado = this.cobros.get(id);
    return guardado === undefined ? null : this.aCobro(guardado);
  }

  factura(id: string): SimulatedInvoice | null {
    const guardada = this.facturas.get(id);
    return guardada === undefined ? null : this.aFactura(guardada);
  }

  bandejaDeSalida(): SimulatedOutboxEntry[] {
    return this.bandeja.todos().sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
  }

  catalogos(): SimulatedCatalogs {
    const c = CATALOGOS_SIMULADOS;
    const sinFuente = (e: { codigo: number; descripcion: string; origen: 'EJEMPLO_OFICIAL' | 'SIMULADO' }) => ({
      codigo: e.codigo,
      descripcion: e.descripcion,
      origen: e.origen,
    });
    return {
      paymentMethods: c.metodosDePago.map(sinFuente),
      identityDocumentTypes: c.tiposDeDocumentoDeIdentidad.map(sinFuente),
      annulmentReasons: c.motivosDeAnulacion.map(sinFuente),
      forceableMessages: MENSAJES_FORZABLES.map((codigo) => ({
        codigo,
        descripcion: DESCRIPCION_MENSAJE_SIAT[codigo],
        advertencia: esAdvertencia(codigo),
      })),
      simulated: true,
    };
  }

  estadoFiscal(): SimulatedFiscalStatus {
    const primero = [...this.emisores.values()][0];
    return {
      environment: 'SIMULADO',
      modality: 2,
      serverTime: primero === undefined ? '' : this.siat.sincronizarFechaHora(this.contexto(primero)).fechaHora,
      issuers: [...this.emisores.values()].map((e) => e.issuer),
      credentials: [...this.emisores.values()].map((e) => {
        const c = this.credenciales.get(e.issuer.id);
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

  registrarPago(cobroId: string, methodCode: number): Resultado<SimulatedCharge> {
    const cobro = this.cobros.get(cobroId);
    if (cobro === undefined) return error('NOT_FOUND', 'El cobro no existe');
    if (cobro.payment !== null) return error('ALREADY_PAID', 'El cobro ya está pagado');
    const metodo = CATALOGOS_SIMULADOS.metodosDePago.find((m) => m.codigo === methodCode);
    if (metodo === undefined) {
      return error('INVALID_INPUT', 'Método de pago inválido', [{ field: 'methodCode', problem: 'no está en el catálogo simulado' }]);
    }
    const payment: SimulatedPayment = {
      id: `pago-${sha256Hex(`${cobroId}|${this.reloj().getTime()}`).slice(0, 16)}`,
      methodCode,
      methodLabel: metodo.descripcion,
      amount: cobro.total,
      currency: 'BOB',
      paidAt: this.reloj().toISOString(),
      simulated: true,
    };
    return { ok: true, value: this.aCobro(this.cobros.actualizar(cobroId, { payment })!) };
  }

  // ---- emisión -----------------------------------------------------------------------

  emitirFactura(cobroId: string, entrada: IssueInvoiceInput, usuario: string): Resultado<SimulatedInvoice> {
    const cobro = this.cobros.get(cobroId);
    if (cobro === undefined) return error('NOT_FOUND', 'El cobro no existe');
    if (cobro.payment === null) return error('PAYMENT_REQUIRED', 'El cobro todavía no está pagado');
    const vigente = this.facturaVigente(cobroId);
    if (vigente !== null) return error('ALREADY_INVOICED', `El cobro ya tiene la factura ${vigente.invoiceNumber} vigente`);

    const problemas = this.problemasDeEntrada(entrada, cobro.total);
    if (problemas.length > 0) return error('INVALID_INPUT', 'Datos de facturación inválidos', problemas);

    const emisor = this.emisores.get(cobro.issuerId)!;
    const credenciales = this.asegurarCredenciales(emisor);
    if (!credenciales.ok) return credenciales;
    const { cuis, cufd, codigoControl } = credenciales.value;

    const contexto = this.contexto(emisor);
    const fechaEmision = this.siat.sincronizarFechaHora(contexto).fechaHora;
    const numeroFactura = (this.contadores.get(emisor.issuer.id)?.ultimo ?? 0) + 1;
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
    const montoTotal = importe(centavos(cobro.total) - centavos(descuentoAdicional));
    const cabecera = this.cabecera(emisor, cobro, entrada.buyer, {
      numeroFactura,
      cuf,
      cufd,
      fechaEmision,
      montoTotal,
      descuentoAdicional,
      usuario,
    });
    const detalle = cobro.lines.map((l) => this.renglon(emisor, l));
    const xml = construirXmlFactura(ESQUEMA_COMPRA_VENTA, { cabecera, detalle });
    const paquete = empaquetarXml(xml);

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
    const status = estadoDeRespuesta(respuesta.codigoEstado);
    if (status !== 'REJECTED') this.contadores.agregar({ id: emisor.issuer.id, ultimo: numeroFactura });

    const ahora = this.reloj().toISOString();
    const events: InvoiceEvent[] = [
      { kind: 'PAYMENT_REGISTERED', at: cobro.payment.paidAt, siatStatusCode: null, detail: `${cobro.payment.methodLabel} · Bs ${cobro.payment.amount}` },
      { kind: 'INVOICE_BUILT', at: ahora, siatStatusCode: null, detail: `Factura N.º ${numeroFactura} · sector ${sector} · CUF generado` },
      { kind: 'SENT_TO_SIAT', at: ahora, siatStatusCode: null, detail: `XML gzip ${paquete.bytesComprimidos} bytes · SHA-256 ${paquete.hashArchivo.slice(0, 12)}…` },
      this.eventoDeRespuesta('SIAT_RESPONSE', respuesta, ahora),
    ];
    const guardada: FacturaGuardada = {
      // Con el ordinal: un reintento tras un rechazo puede repetir el CUF
      // (mismo número, mismo instante) y no debe pisar el registro rechazado.
      id: `factura-${sha256Hex(`${cuf}|${this.facturas.tamano}`).slice(0, 16)}`,
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
      siatResponse: this.aRespuesta(respuesta),
      events,
      simulated: true,
    };
    this.facturas.agregar(guardada);
    return { ok: true, value: this.aFactura(guardada) };
  }

  // ---- anulación y reversión ---------------------------------------------------------

  anular(facturaId: string, reasonCode: number): Resultado<SimulatedInvoice> {
    return this.operarSobreFactura(facturaId, (base, factura) => {
      const respuesta = this.siat.anulacionFactura({ ...base, cuf: factura.cuf, codigoMotivo: reasonCode });
      const status: SimulatedInvoiceStatus = respuesta.codigoEstado === ESTADO_SIAT.ANULACION_CONFIRMADA ? 'ANNULLED' : factura.status;
      return { respuesta, status, kind: 'ANNULMENT' as const };
    });
  }

  revertirAnulacion(facturaId: string): Resultado<SimulatedInvoice> {
    return this.operarSobreFactura(facturaId, (base, factura) => {
      const respuesta = this.siat.reversionAnulacionFactura({ ...base, cuf: factura.cuf });
      const status: SimulatedInvoiceStatus =
        respuesta.codigoEstado === ESTADO_SIAT.REVERSION_ANULACION_CONFIRMADA ? factura.statusAtReception : factura.status;
      return { respuesta, status, kind: 'ANNULMENT_REVERSAL' as const };
    });
  }

  // ---- entrega -------------------------------------------------------------------------

  /** Encola el «envío» del XML y la representación gráfica. **No envía nada.** */
  encolarCorreo(facturaId: string, to: string): Resultado<SimulatedOutboxEntry> {
    const factura = this.facturas.get(facturaId);
    if (factura === undefined) return error('NOT_FOUND', 'La factura no existe');
    if (!CORREO.test(to)) return error('INVALID_INPUT', 'Correo inválido', [{ field: 'to', problem: 'no es un correo' }]);
    if (factura.status === 'REJECTED') {
      return error('INVALID_INPUT', 'Una factura rechazada no se entrega', [{ field: 'invoiceId', problem: 'rechazada' }]);
    }
    const ahora = this.reloj().toISOString();
    const entrada: SimulatedOutboxEntry = {
      id: `correo-${sha256Hex(`${facturaId}|${to}|${ahora}|${this.bandeja.tamano}`).slice(0, 16)}`,
      invoiceId: facturaId,
      to,
      attachments: [`factura-${factura.invoiceNumber}-SIMULADA.xml`, `factura-${factura.invoiceNumber}-SIMULADA.pdf`],
      status: 'NOT_SENT_SIMULATED',
      queuedAt: ahora,
      simulated: true,
    };
    this.bandeja.agregar(entrada);
    this.facturas.actualizar(facturaId, {
      events: [...factura.events, { kind: 'EMAIL_QUEUED', at: ahora, siatStatusCode: null, detail: `A ${to} · bandeja simulada, no se envía` }],
    });
    return { ok: true, value: entrada };
  }

  // ---- privados ----------------------------------------------------------------------

  private contexto(emisor: EmisorSimulado): ContextoFiscal {
    return {
      nit: emisor.issuer.nit,
      codigoSistema: emisor.codigoSistema,
      codigoSucursal: emisor.issuer.branchCode,
      codigoPuntoVenta: emisor.issuer.pointOfSaleCode,
      codigoModalidad: 2,
    };
  }

  private facturaVigente(cobroId: string): FacturaGuardada | null {
    return this.facturas.filtrar((f) => f.chargeId === cobroId && (f.status === 'VALIDATED' || f.status === 'OBSERVED'))[0] ?? null;
  }

  private ultimaFactura(cobroId: string): FacturaGuardada | null {
    return (
      this.facturas
        .filtrar((f) => f.chargeId === cobroId)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0] ?? null
    );
  }

  private problemasDeEntrada(entrada: IssueInvoiceInput, total: string): { field: string; problem: string }[] {
    const problemas: { field: string; problem: string }[] = [];
    const comprador: Partial<BuyerInput> = entrada?.buyer ?? {};
    const nombre = (comprador.name ?? '').trim();
    if (nombre.length < 1 || nombre.length > 500) problemas.push({ field: 'buyer.name', problem: 'entre 1 y 500 caracteres' });
    if (!existeEnCatalogo(CATALOGOS_SIMULADOS.tiposDeDocumentoDeIdentidad, Number(comprador.documentTypeCode))) {
      problemas.push({ field: 'buyer.documentTypeCode', problem: 'no está en el catálogo simulado' });
    }
    const documento = (comprador.documentNumber ?? '').trim();
    if (documento.length < 1 || documento.length > 20) problemas.push({ field: 'buyer.documentNumber', problem: 'entre 1 y 20 caracteres' });
    const complemento = comprador.complement ?? null;
    if (complemento !== null && complemento.length > 5) problemas.push({ field: 'buyer.complement', problem: 'hasta 5 caracteres' });
    const correo = comprador.email ?? null;
    if (correo !== null && correo !== '' && !CORREO.test(correo)) problemas.push({ field: 'buyer.email', problem: 'no es un correo' });
    const descuento = entrada?.additionalDiscount ?? null;
    if (descuento !== null && descuento !== '') {
      if (!DECIMAL.test(descuento)) problemas.push({ field: 'additionalDiscount', problem: 'decimal no negativo con hasta 2 decimales' });
      else if (centavos(descuento) >= centavos(total)) problemas.push({ field: 'additionalDiscount', problem: 'tiene que ser menor que el total' });
    }
    return problemas;
  }

  /** CUIS y CUFD vigentes; los pide al proveedor si faltan o vencieron. */
  private asegurarCredenciales(emisor: EmisorSimulado): Resultado<{ cuis: string; cufd: string; codigoControl: string }> {
    const ahora = this.reloj();
    const id = emisor.issuer.id;
    const contexto = this.contexto(emisor);
    let actual: Credenciales = this.credenciales.get(id) ?? {
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
        return error('FISCAL_CREDENTIALS', `No se obtuvo el CUIS simulado: ${mensajesComoTexto(r.mensajesList)}`);
      }
      actual = { ...actual, cuis: r.codigo, cuisValidUntil: r.fechaVigencia, cufd: null, cufdValidUntil: null, codigoControl: null };
    }
    if (actual.cufd === null || actual.cufdValidUntil === null || actual.codigoControl === null || new Date(actual.cufdValidUntil) <= ahora) {
      const r = this.siat.solicitudCufd({ ...contexto, cuis: actual.cuis! });
      if (!r.transaccion || r.codigo === null || r.codigoControl === null) {
        return error('FISCAL_CREDENTIALS', `No se obtuvo el CUFD simulado: ${mensajesComoTexto(r.mensajesList)}`);
      }
      actual = { ...actual, cufd: r.codigo, cufdValidUntil: r.fechaVigencia, codigoControl: r.codigoControl };
    }
    this.credenciales.agregar(actual);
    return { ok: true, value: { cuis: actual.cuis!, cufd: actual.cufd!, codigoControl: actual.codigoControl! } };
  }

  private cabecera(
    emisor: EmisorSimulado,
    cobro: CobroGuardado,
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
  ): FilaXml {
    const leyendas = CATALOGOS_SIMULADOS.leyendas;
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

  private renglon(emisor: EmisorSimulado, linea: ChargeLine): FilaXml {
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

  private operarSobreFactura(
    facturaId: string,
    operacion: (
      base: SolicitudRecepcion,
      factura: FacturaGuardada,
    ) => { respuesta: RespuestaRecepcion; status: SimulatedInvoiceStatus; kind: 'ANNULMENT' | 'ANNULMENT_REVERSAL' },
  ): Resultado<SimulatedInvoice> {
    const factura = this.facturas.get(facturaId);
    if (factura === undefined) return error('NOT_FOUND', 'La factura no existe');
    const emisor = this.emisores.get(factura.issuer.id)!;
    const credenciales = this.asegurarCredenciales(emisor);
    if (!credenciales.ok) return credenciales;
    const base: SolicitudRecepcion = {
      ...this.contexto(emisor),
      cuis: credenciales.value.cuis,
      cufd: credenciales.value.cufd,
      codigoDocumentoSector: factura.documentSector,
      codigoEmision: 1,
      tipoFacturaDocumento: 1,
    };
    const { respuesta, status, kind } = operacion(base, factura);
    const ahora = this.reloj().toISOString();
    const actualizada = this.facturas.actualizar(facturaId, {
      status,
      siatResponse: this.aRespuesta(respuesta),
      events: [...factura.events, this.eventoDeRespuesta(kind, respuesta, ahora)],
    })!;
    return { ok: true, value: this.aFactura(actualizada) };
  }

  private eventoDeRespuesta(kind: InvoiceEvent['kind'], respuesta: RespuestaRecepcion, at: string): InvoiceEvent {
    const mensajes = respuesta.mensajesList.map((m) => `${m.codigo}${m.forzadoPorSimulacion ? ' (forzado)' : ''}`).join(', ');
    return {
      kind,
      at,
      siatStatusCode: respuesta.codigoEstado,
      detail: `${respuesta.codigoEstado} ${respuesta.codigoDescripcion}${mensajes === '' ? '' : ` · ${mensajes}`} (SIMULADO)`,
    };
  }

  private aRespuesta(r: RespuestaRecepcion): SiatResponse {
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

  private aFactura(f: FacturaGuardada): SimulatedInvoice {
    const { statusAtReception: _omitido, ...publica } = f;
    return publica;
  }

  private aResumen(f: FacturaGuardada): SimulatedInvoiceSummary {
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

  private aCobro(c: CobroGuardado): SimulatedCharge {
    const ultima = this.ultimaFactura(c.id);
    return {
      id: c.id,
      source: c.source,
      sourceRef: c.sourceRef,
      issuerId: c.issuerId,
      patientProfileId: c.patientProfileId,
      patientName: c.patientName,
      description: c.description,
      lines: c.lines,
      total: c.total,
      currency: 'BOB',
      createdAt: c.createdAt,
      payment: c.payment,
      suggestedBuyer: c.suggestedBuyer,
      latestInvoice: ultima === null ? null : this.aResumen(ultima),
      simulated: true,
    };
  }
}
