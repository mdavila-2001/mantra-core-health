/* ============================================================================
    SiatSimuladoAdapter — la administración tributaria **simulada**.

    Implementa `FiscalProviderPort` imitando el flujo oficial del SIAT
    (modalidad Computarizada en Línea, emisión individual en línea):

    - CUIS con vigencia de 365 días por sucursal/punto de venta; si ya hay uno
      vigente responde 980, como el catálogo oficial.
    - CUFD con vigencia de 24 horas y `codigoControl`, que se concatena al CUF.
    - `recepcionFactura`: desempaqueta (hash + gzip), lee el XML, lo contrasta
      con el esquema del sector, recalcula el CUF, revisa los montos y responde
      908 (validada), 904 (observada) o 902 (rechazada) con los códigos de
      mensaje del catálogo oficial. La emisión individual responde en el acto:
      901 (pendiente) es de paquetes, que no entran en esta entrega (CA-6).
    - Anulación hasta el día 9 del mes siguiente a la emisión (905/906) y una
      sola reversión (907/909).

    Fuentes: siatinfo.impuestos.gob.bo —solicitud-cuis, solicitud-cufd,
    emision-y-envio, codigos-error-siat, anulacion-de-documentos-fiscales,
    reversion-anulacion-documentos-fiscales— leídas el 2026-09-26.

    **Nada de esto sale del navegador ni habla con el SIN.** Los códigos (CUIS,
    CUFD, `codigoControl`, `codigoRecepcion`) son sintéticos y cada respuesta
    lleva `simulated: true`.

    ## Reglas de montos

    Las comprobaciones de subtotal, total, total sujeto a IVA y total en moneda
    son **INFERENCIA**: coinciden con el XML de ejemplo oficial
    (subTotal = cantidad × precioUnitario − montoDescuento; montoTotal =
    Σ subTotal − descuentoAdicional; montoTotalSujetoIva = montoTotal −
    montoGiftCard; montoTotalMoneda = montoTotal ÷ tipoCambio), pero la
    especificación de cálculo del SIN no se leyó. Los códigos que devuelven sí
    son los del catálogo (1018, 1013, 1058, 1014).
    ========================================================================== */

import { Coleccion } from '../mock-store';
import { sha256Hex } from '../sha256';
import { SIMULATED_CATALOGS, existsInCatalog, type FiscalCatalogs } from './simulated-catalogs';
import {
  SIAT_STATUS_DESCRIPTION,
  SIAT_MESSAGE_DESCRIPTION,
  SIAT_STATUS,
  SIAT_MESSAGE,
  isWarning,
  isKnownMessageCode,
  type SiatStatusCode,
  type SiatMessageCode,
} from './siat-codes';
import { fechaHoraParaCuf, generarCuf } from './cuf';
import { unpackageFile, PackagingError } from './packaging';
import { sectorSchema, schemaByRoot } from './siat-schema';
import { ReadingXmlError, invoiceFromXml, readInvoiceXml, type RowXml } from './invoice-xml';
import type {
  ContextoFiscal,
  DirectivaDeSimulacion,
  FiscalProviderPort,
  MensajeRecepcion,
  MensajeServicio,
  RespuestaCufd,
  RespuestaCuis,
  RespuestaFechaHora,
  RespuestaRecepcion,
  SolicitudAnulacion,
  SolicitudConCuf,
  SolicitudCufd,
  SolicitudRecepcion,
  SolicitudRecepcionFactura,
} from './fiscal-provider.port';

/** Lo que el «padrón» simulado sabe de un contribuyente ficticio. */
export interface SimulatedTaxpayer {
  readonly nit: string;
  readonly razonSocial: string;
  readonly codigoSistema: string;
  readonly direccion: string;
  readonly sucursales: readonly number[];
  readonly puntosDeVenta: readonly number[];
  readonly sectoresHabilitados: readonly number[];
}

interface RecordCuis {
  readonly id: string;
  readonly clave: string;
  readonly codigo: string;
  readonly fechaVigencia: string;
}

interface RecordCufd {
  readonly id: string;
  readonly clave: string;
  readonly codigo: string;
  readonly codigoControl: string;
  readonly direccion: string;
  readonly fechaVigencia: string;
}

interface InvoiceRecord {
  /** El CUF. */
  readonly id: string;
  readonly clave: string;
  readonly codigoDocumentoSector: number;
  readonly numeroFactura: number;
  readonly fechaEmision: string;
  readonly codigoRecepcion: string;
  /** 908 u 904: cómo quedó recibida. */
  readonly estadoDeRecepcion: SiatStatusCode;
  readonly anulada: boolean;
  readonly revertida: boolean;
}

export interface SiatSimulatedOptions {
  readonly padron: readonly SimulatedTaxpayer[];
  readonly reloj?: () => Date;
  /** Prefijo de `sessionStorage`; sin él, el estado vive sólo en memoria. */
  readonly clavePersistencia?: string;
}

const MS_DAY = 24 * 60 * 60 * 1000;
const VALIDITY_CUIS_MS = 365 * MS_DAY;
const VALIDITY_CUFD_MS = MS_DAY;
/** Bolivia: UTC−4, sin horario de verano. */
const DESFASE_BOLIVIA_MS = -4 * 60 * 60 * 1000;

/** `yyyy-MM-ddTHH:mm:ss.SSS` en hora de Bolivia. */
export function boliviaTime(instante: Date): string {
  return new Date(instante.getTime() + DESFASE_BOLIVIA_MS).toISOString().slice(0, 23);
}

function keyOf(contexto: Pick<ContextoFiscal, 'nit' | 'codigoSucursal' | 'codigoPuntoVenta'>): string {
  return `${contexto.nit}|${contexto.codigoSucursal}|${contexto.codigoPuntoVenta}`;
}

function hexSintetico(semilla: string, largo: number): string {
  let hex = '';
  for (let i = 0; hex.length < largo; i++) hex += sha256Hex(`${semilla}|${i}`);
  return hex.slice(0, largo).toUpperCase();
}

function message(codigo: SiatMessageCode): MensajeRecepcion {
  return { codigo, descripcion: SIAT_MESSAGE_DESCRIPTION[codigo], advertencia: isWarning(codigo) };
}

function response(
  codigoEstado: SiatStatusCode,
  mensajesList: readonly MensajeRecepcion[] = [],
  codigoRecepcion: string | null = null,
): RespuestaRecepcion {
  const aceptada =
    codigoEstado === SIAT_STATUS.RECEPCION_VALIDADA ||
    codigoEstado === SIAT_STATUS.RECEPCION_OBSERVADA ||
    codigoEstado === SIAT_STATUS.ANULACION_CONFIRMADA ||
    codigoEstado === SIAT_STATUS.REVERSION_ANULACION_CONFIRMADA;
  return {
    transaccion: aceptada,
    codigoEstado,
    codigoDescripcion: SIAT_STATUS_DESCRIPTION[codigoEstado],
    codigoRecepcion,
    mensajesList,
    simulated: true,
  };
}

/** Importe en centavos. Admite los decimales del XSD (hasta 2). */
function cents(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const [entero, decimales = ''] = String(valor).split('.');
  const signo = entero!.startsWith('-') ? -1 : 1;
  return signo * (Math.abs(Number(entero)) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2)));
}

export class SiatSimulatedAdapter implements FiscalProviderPort {
  readonly ambiente = 'SIMULADO' as const;

  private readonly registry: readonly SimulatedTaxpayer[];
  private readonly clock: () => Date;
  private readonly cuis = new Coleccion<RecordCuis>();
  private readonly cufds = new Coleccion<RecordCufd>();
  private readonly invoices = new Coleccion<InvoiceRecord>();

  constructor(opciones: SiatSimulatedOptions) {
    this.registry = opciones.padron;
    this.clock = opciones.reloj ?? (() => new Date());
    if (opciones.clavePersistencia !== undefined) {
      this.cuis.persistirEn(`${opciones.clavePersistencia}.cuis`);
      this.cufds.persistirEn(`${opciones.clavePersistencia}.cufd`);
      this.invoices.persistirEn(`${opciones.clavePersistencia}.facturas`);
    }
  }

  // ---- códigos ---------------------------------------------------------------

  solicitudCuis(contexto: ContextoFiscal): RespuestaCuis {
    const errores = this.contextErrors(contexto);
    if (errores.length > 0) return { transaccion: false, codigo: null, fechaVigencia: null, mensajesList: errores, simulated: true };
    const clave = keyOf(contexto);
    const ahora = this.clock();
    if (this.currentCuis(clave, ahora) !== null) {
      return {
        transaccion: false,
        codigo: null,
        fechaVigencia: null,
        mensajesList: [this.serviceMessage(SIAT_MESSAGE.EXISTE_CUIS_VIGENTE)],
        simulated: true,
      };
    }
    const registro = this.cuis.agregar({
      id: `${clave}|${ahora.getTime()}`,
      clave,
      codigo: hexSintetico(`cuis|${clave}|${ahora.getTime()}`, 8),
      fechaVigencia: new Date(ahora.getTime() + VALIDITY_CUIS_MS).toISOString(),
    });
    return { transaccion: true, codigo: registro.codigo, fechaVigencia: registro.fechaVigencia, mensajesList: [], simulated: true };
  }

  solicitudCufd(solicitud: SolicitudCufd): RespuestaCufd {
    const vacia = { transaccion: false, codigo: null, codigoControl: null, direccion: null, fechaVigencia: null, simulated: true } as const;
    const errores = this.contextErrors(solicitud);
    const ahora = this.clock();
    const errorCuis = errores.length > 0 ? null : this.cuisError(solicitud, ahora);
    if (errores.length > 0 || errorCuis !== null) {
      return { ...vacia, mensajesList: errorCuis === null ? errores : [errorCuis] };
    }
    const clave = keyOf(solicitud);
    const contribuyente = this.contribuyente(solicitud.nit)!;
    const semilla = `cufd|${clave}|${ahora.getTime()}|${this.cufds.tamano}`;
    const registro = this.cufds.agregar({
      id: semilla,
      clave,
      codigo: `SIMCUFD${hexSintetico(semilla, 36)}`,
      codigoControl: hexSintetico(`${semilla}|control`, 15),
      direccion: contribuyente.direccion,
      fechaVigencia: new Date(ahora.getTime() + VALIDITY_CUFD_MS).toISOString(),
    });
    return {
      transaccion: true,
      codigo: registro.codigo,
      codigoControl: registro.codigoControl,
      direccion: registro.direccion,
      fechaVigencia: registro.fechaVigencia,
      mensajesList: [],
      simulated: true,
    };
  }

  sincronizarFechaHora(): RespuestaFechaHora {
    return { transaccion: true, fechaHora: boliviaTime(this.clock()), simulated: true };
  }

  sincronizarParametricas(): FiscalCatalogs {
    return SIMULATED_CATALOGS;
  }

  // ---- recepción ---------------------------------------------------------------

  recepcionFactura(solicitud: SolicitudRecepcionFactura, simulacion?: DirectivaDeSimulacion): RespuestaRecepcion {
    const ahora = this.clock();
    const previos = this.requestErrors(solicitud, ahora);
    if (previos.length > 0) return response(SIAT_STATUS.RECEPCION_RECHAZADA, previos);

    let xml: string;
    try {
      xml = unpackageFile(solicitud.archivo, solicitud.hashArchivo);
    } catch (error: unknown) {
      if (error instanceof PackagingError || error instanceof TypeError) {
        return response(SIAT_STATUS.RECEPCION_RECHAZADA, [message(SIAT_MESSAGE.ARCHIVO_INVALIDO)]);
      }
      throw error;
    }

    let cabecera: RowXml;
    let detalle: readonly RowXml[];
    try {
      const leido = readInvoiceXml(xml);
      const esquema = schemaByRoot(leido.raiz);
      if (esquema === null || esquema.codigoDocumentoSector !== solicitud.codigoDocumentoSector) {
        return response(SIAT_STATUS.RECEPCION_RECHAZADA, [message(SIAT_MESSAGE.NO_CUMPLE_XSD)]);
      }
      const { factura, problemas } = invoiceFromXml(esquema, leido);
      if (problemas.length > 0) {
        return response(SIAT_STATUS.RECEPCION_RECHAZADA, [message(SIAT_MESSAGE.NO_CUMPLE_XSD)]);
      }
      cabecera = factura.cabecera;
      detalle = factura.detalle;
    } catch (error: unknown) {
      if (error instanceof ReadingXmlError) {
        return response(SIAT_STATUS.RECEPCION_RECHAZADA, [message(SIAT_MESSAGE.NO_CUMPLE_XSD)]);
      }
      throw error;
    }

    const errores: MensajeRecepcion[] = [];
    const advertencias: MensajeRecepcion[] = [];
    const cufd = this.cufds.filtrar((c) => c.codigo === solicitud.cufd)[0]!;

    if (String(cabecera['nitEmisor']) !== solicitud.nit) errores.push(message(SIAT_MESSAGE.NIT_NO_CORRESPONDE_AL_CUFD));
    if (cabecera['cufd'] !== solicitud.cufd) errores.push(message(SIAT_MESSAGE.CUFD_DEL_XML_INVALIDO));
    if (Number(cabecera['codigoSucursal']) !== solicitud.codigoSucursal) {
      errores.push(message(SIAT_MESSAGE.SUCURSAL_NO_CORRESPONDE_AL_CUFD));
    }

    const cuf = String(cabecera['cuf']);
    let fechaHora: string | null = null;
    try {
      fechaHora = fechaHoraParaCuf(String(cabecera['fechaEmision']));
    } catch {
      errores.push(message(SIAT_MESSAGE.FORMATO_DE_FECHA_INCORRECTO));
    }
    if (fechaHora !== null) {
      const esperado = generarCuf(
        {
          nit: solicitud.nit,
          fechaHora,
          sucursal: solicitud.codigoSucursal,
          modalidad: solicitud.codigoModalidad,
          tipoEmision: solicitud.codigoEmision,
          tipoFactura: solicitud.tipoFacturaDocumento,
          tipoDocumentoSector: solicitud.codigoDocumentoSector,
          numeroFactura: Number(cabecera['numeroFactura']),
          puntoVenta: Number(cabecera['codigoPuntoVenta'] ?? 0),
        },
        cufd.codigoControl,
      );
      if (esperado !== cuf) errores.push(message(SIAT_MESSAGE.CUF_INVALIDO));
    }
    if (this.invoices.has(cuf)) errores.push(message(SIAT_MESSAGE.CUF_YA_EXISTE));

    errores.push(...this.amountErrors(cabecera, detalle));

    const clave = keyOf(solicitud);
    const numeroFactura = Number(cabecera['numeroFactura']);
    const anterior = this.lastNumber(clave, solicitud.codigoDocumentoSector);
    if (anterior !== null && numeroFactura !== anterior + 1) {
      advertencias.push(message(SIAT_MESSAGE.ADVERTENCIA_CORRELATIVIDAD));
    }

    const forzado = simulacion?.forzarMensaje;
    if (forzado !== undefined && isKnownMessageCode(forzado)) {
      const m: MensajeRecepcion = { ...message(forzado), forzadoPorSimulacion: true };
      (m.advertencia ? advertencias : errores).push(m);
    }

    if (errores.length > 0) {
      return response(SIAT_STATUS.RECEPCION_RECHAZADA, [...errores, ...advertencias]);
    }
    const estado = advertencias.length > 0 ? SIAT_STATUS.RECEPCION_OBSERVADA : SIAT_STATUS.RECEPCION_VALIDADA;
    const codigoRecepcion = `SIMREC-${hexSintetico(`recepcion|${cuf}`, 24)}`;
    this.invoices.agregar({
      id: cuf,
      clave,
      codigoDocumentoSector: solicitud.codigoDocumentoSector,
      numeroFactura,
      fechaEmision: String(cabecera['fechaEmision']),
      codigoRecepcion,
      estadoDeRecepcion: estado,
      anulada: false,
      revertida: false,
    });
    return response(estado, advertencias, codigoRecepcion);
  }

  verificacionEstadoFactura(solicitud: SolicitudConCuf): RespuestaRecepcion {
    const registro = this.invoices.get(solicitud.cuf);
    if (registro === undefined || registro.clave !== keyOf(solicitud)) {
      return response(SIAT_STATUS.RECEPCION_RECHAZADA, [message(SIAT_MESSAGE.FACTURA_INEXISTENTE)]);
    }
    const estado = registro.anulada ? SIAT_STATUS.ANULACION_CONFIRMADA : registro.estadoDeRecepcion;
    return response(estado, [], registro.codigoRecepcion);
  }

  // ---- anulación ---------------------------------------------------------------

  anulacionFactura(solicitud: SolicitudAnulacion): RespuestaRecepcion {
    const registro = this.invoices.get(solicitud.cuf);
    if (registro === undefined || registro.clave !== keyOf(solicitud)) {
      return response(SIAT_STATUS.ANULACION_RECHAZADA, [message(SIAT_MESSAGE.FACTURA_INEXISTENTE)]);
    }
    if (!existsInCatalog(SIMULATED_CATALOGS.motivosDeAnulacion, solicitud.codigoMotivo)) {
      return response(SIAT_STATUS.ANULACION_RECHAZADA, [message(SIAT_MESSAGE.MOTIVO_ANULACION_INVALIDO)]);
    }
    if (registro.anulada) {
      return response(SIAT_STATUS.ANULACION_RECHAZADA, [message(SIAT_MESSAGE.YA_ANULADA)]);
    }
    if (registro.revertida) {
      // «Un documento revertido no puede volver a anularse» (página oficial de
      // reversión). 941 es el código del catálogo para «no disponible para ser anulada».
      return response(SIAT_STATUS.ANULACION_RECHAZADA, [message(SIAT_MESSAGE.NO_DISPONIBLE_PARA_ANULAR)]);
    }
    if (this.outsideDeadline(registro.fechaEmision)) {
      return response(SIAT_STATUS.ANULACION_RECHAZADA, [message(SIAT_MESSAGE.ANULACION_FUERA_DE_PLAZO)]);
    }
    this.invoices.actualizar(registro.id, { anulada: true });
    return response(SIAT_STATUS.ANULACION_CONFIRMADA, [], registro.codigoRecepcion);
  }

  /**
   * Una sola reversión, dentro del mismo plazo. El catálogo oficial no trae un
   * código de mensaje inequívoco para «ya revertida» ni para «fuera de plazo» de
   * una reversión (la página de reversión cita 3011/3012, ausentes del
   * catálogo), así que esos rechazos van con 909 y **sin** mensaje: no se
   * inventa uno.
   */
  reversionAnulacionFactura(solicitud: SolicitudConCuf): RespuestaRecepcion {
    const registro = this.invoices.get(solicitud.cuf);
    if (registro === undefined || registro.clave !== keyOf(solicitud)) {
      return response(SIAT_STATUS.REVERSION_ANULACION_RECHAZADA, [message(SIAT_MESSAGE.FACTURA_INEXISTENTE)]);
    }
    if (!registro.anulada || registro.revertida || this.outsideDeadline(registro.fechaEmision)) {
      return response(SIAT_STATUS.REVERSION_ANULACION_RECHAZADA);
    }
    this.invoices.actualizar(registro.id, { anulada: false, revertida: true });
    return response(SIAT_STATUS.REVERSION_ANULACION_CONFIRMADA, [], registro.codigoRecepcion);
  }

  // ---- reglas ------------------------------------------------------------------

  private contribuyente(nit: string): SimulatedTaxpayer | undefined {
    return this.registry.find((c) => c.nit === nit);
  }

  private serviceMessage(codigo: SiatMessageCode): MensajeServicio {
    return { codigo, descripcion: SIAT_MESSAGE_DESCRIPTION[codigo] };
  }

  private contextErrors(contexto: ContextoFiscal): MensajeRecepcion[] {
    const contribuyente = this.contribuyente(contexto.nit);
    if (contribuyente === undefined) return [message(SIAT_MESSAGE.NIT_INVALIDO)];
    const errores: MensajeRecepcion[] = [];
    if (contribuyente.codigoSistema !== contexto.codigoSistema) errores.push(message(SIAT_MESSAGE.SISTEMA_NO_ASOCIADO));
    // CA-2: el simulador sólo atiende Computarizada en Línea.
    if (contexto.codigoModalidad !== 2) errores.push(message(SIAT_MESSAGE.MODALIDAD_INVALIDA));
    if (!contribuyente.sucursales.includes(contexto.codigoSucursal)) errores.push(message(SIAT_MESSAGE.SUCURSAL_INVALIDA));
    return errores;
  }

  private currentCuis(clave: string, ahora: Date): RecordCuis | null {
    return this.cuis.filtrar((c) => c.clave === clave && new Date(c.fechaVigencia) > ahora)[0] ?? null;
  }

  private cuisError(solicitud: ContextoFiscal & { readonly cuis: string }, ahora: Date): MensajeRecepcion | null {
    const registro = this.cuis.filtrar((c) => c.codigo === solicitud.cuis)[0];
    if (registro === undefined) return message(SIAT_MESSAGE.CUIS_INVALIDO);
    if (registro.clave !== keyOf(solicitud)) return message(SIAT_MESSAGE.CUIS_NO_CORRESPONDE_A_SUCURSAL);
    if (new Date(registro.fechaVigencia) <= ahora) return message(SIAT_MESSAGE.CUIS_NO_VIGENTE);
    return null;
  }

  private requestErrors(solicitud: SolicitudRecepcion, ahora: Date): MensajeRecepcion[] {
    const errores = this.contextErrors(solicitud);
    if (errores.length > 0) return errores;
    // CA-6: sin contingencia ni masiva en esta entrega.
    if (solicitud.codigoEmision !== 1) errores.push(message(SIAT_MESSAGE.TIPO_EMISION_INVALIDO));
    if (solicitud.tipoFacturaDocumento !== 1) errores.push(message(SIAT_MESSAGE.TIPO_FACTURA_DOCUMENTO_INVALIDO));
    const esquema = sectorSchema(solicitud.codigoDocumentoSector);
    if (esquema === null) {
      errores.push(message(SIAT_MESSAGE.DOCUMENTO_SECTOR_INVALIDO));
    } else if (!esquema.activo || !this.contribuyente(solicitud.nit)!.sectoresHabilitados.includes(esquema.codigoDocumentoSector)) {
      errores.push(message(SIAT_MESSAGE.DOCUMENTO_SECTOR_NO_HABILITADO));
    }
    const errorCuis = this.cuisError(solicitud, ahora);
    if (errorCuis !== null) errores.push(errorCuis);
    const cufd = this.cufds.filtrar((c) => c.codigo === solicitud.cufd)[0];
    if (cufd === undefined) {
      errores.push(message(SIAT_MESSAGE.CUFD_INVALIDO));
    } else if (new Date(cufd.fechaVigencia) <= ahora) {
      errores.push(message(SIAT_MESSAGE.CUFD_NO_VIGENTE));
    } else if (cufd.clave !== keyOf(solicitud)) {
      errores.push(message(SIAT_MESSAGE.SUCURSAL_NO_CORRESPONDE_AL_CUFD));
    }
    return errores;
  }

  private amountErrors(cabecera: RowXml, detalle: readonly RowXml[]): MensajeRecepcion[] {
    const errores: MensajeRecepcion[] = [];
    let suma = 0;
    for (const fila of detalle) {
      const esperado = Math.round((cents(fila['cantidad']) * cents(fila['precioUnitario'])) / 100) - cents(fila['montoDescuento']);
      if (cents(fila['subTotal']) !== esperado) errores.push(message(SIAT_MESSAGE.SUBTOTAL_ERRONEO));
      suma += cents(fila['subTotal']);
    }
    const total = cents(cabecera['montoTotal']);
    if (total !== suma - cents(cabecera['descuentoAdicional'])) errores.push(message(SIAT_MESSAGE.MONTO_TOTAL_ERRONEO));
    if (cents(cabecera['montoTotalSujetoIva']) !== total - cents(cabecera['montoGiftCard'])) {
      errores.push(message(SIAT_MESSAGE.MONTO_TOTAL_SUJETO_IVA_ERRONEO));
    }
    const tipoCambio = cents(cabecera['tipoCambio']);
    if (tipoCambio <= 0 || cents(cabecera['montoTotalMoneda']) !== Math.round((total * 100) / tipoCambio)) {
      errores.push(message(SIAT_MESSAGE.MONTO_TOTAL_MONEDA_ERRONEO));
    }
    // Un mismo código una sola vez, como una lista de mensajes legible.
    return errores.filter((m, i) => errores.findIndex((o) => o.codigo === m.codigo) === i);
  }

  private lastNumber(clave: string, sector: number): number | null {
    const numeros = this.invoices
      .filtrar((f) => f.clave === clave && f.codigoDocumentoSector === sector)
      .map((f) => f.numeroFactura);
    return numeros.length === 0 ? null : Math.max(...numeros);
  }

  /** Plazo: hasta el día 9 del mes siguiente a la emisión, hora de Bolivia. */
  private outsideDeadline(fechaEmision: string): boolean {
    const [anio, mes] = fechaEmision.slice(0, 7).split('-').map(Number) as [number, number];
    const siguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
    const limite = `${siguiente.anio}-${String(siguiente.mes).padStart(2, '0')}-09T23:59:59.999`;
    return boliviaTime(this.clock()) > limite;
  }
}
