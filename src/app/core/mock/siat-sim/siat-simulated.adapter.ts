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
import { CATALOGOS_SIMULADOS, existeEnCatalogo, type CatalogosFiscales } from './simulated-catalogs';
import {
  DESCRIPCION_ESTADO_SIAT,
  DESCRIPCION_MENSAJE_SIAT,
  ESTADO_SIAT,
  MENSAJE_SIAT,
  esAdvertencia,
  esCodigoDeMensajeConocido,
  type CodigoEstadoSiat,
  type CodigoMensajeSiat,
} from './siat-codes';
import { fechaHoraParaCuf, generarCuf } from './cuf';
import { desempaquetarArchivo, ErrorDeEmpaquetado } from './packaging';
import { esquemaDeSector, esquemaPorRaiz } from './siat-schema';
import { ErrorDeLecturaXml, facturaDesdeXml, leerXmlFactura, type FilaXml } from './invoice-xml';
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
export interface ContribuyenteSimulado {
  readonly nit: string;
  readonly razonSocial: string;
  readonly codigoSistema: string;
  readonly direccion: string;
  readonly sucursales: readonly number[];
  readonly puntosDeVenta: readonly number[];
  readonly sectoresHabilitados: readonly number[];
}

interface RegistroCuis {
  readonly id: string;
  readonly clave: string;
  readonly codigo: string;
  readonly fechaVigencia: string;
}

interface RegistroCufd {
  readonly id: string;
  readonly clave: string;
  readonly codigo: string;
  readonly codigoControl: string;
  readonly direccion: string;
  readonly fechaVigencia: string;
}

interface RegistroFactura {
  /** El CUF. */
  readonly id: string;
  readonly clave: string;
  readonly codigoDocumentoSector: number;
  readonly numeroFactura: number;
  readonly fechaEmision: string;
  readonly codigoRecepcion: string;
  /** 908 u 904: cómo quedó recibida. */
  readonly estadoDeRecepcion: CodigoEstadoSiat;
  readonly anulada: boolean;
  readonly revertida: boolean;
}

export interface OpcionesSiatSimulado {
  readonly padron: readonly ContribuyenteSimulado[];
  readonly reloj?: () => Date;
  /** Prefijo de `sessionStorage`; sin él, el estado vive sólo en memoria. */
  readonly clavePersistencia?: string;
}

const MS_DIA = 24 * 60 * 60 * 1000;
const VIGENCIA_CUIS_MS = 365 * MS_DIA;
const VIGENCIA_CUFD_MS = MS_DIA;
/** Bolivia: UTC−4, sin horario de verano. */
const DESFASE_BOLIVIA_MS = -4 * 60 * 60 * 1000;

/** `yyyy-MM-ddTHH:mm:ss.SSS` en hora de Bolivia. */
export function horaDeBolivia(instante: Date): string {
  return new Date(instante.getTime() + DESFASE_BOLIVIA_MS).toISOString().slice(0, 23);
}

function claveDe(contexto: Pick<ContextoFiscal, 'nit' | 'codigoSucursal' | 'codigoPuntoVenta'>): string {
  return `${contexto.nit}|${contexto.codigoSucursal}|${contexto.codigoPuntoVenta}`;
}

function hexSintetico(semilla: string, largo: number): string {
  let hex = '';
  for (let i = 0; hex.length < largo; i++) hex += sha256Hex(`${semilla}|${i}`);
  return hex.slice(0, largo).toUpperCase();
}

function mensaje(codigo: CodigoMensajeSiat): MensajeRecepcion {
  return { codigo, descripcion: DESCRIPCION_MENSAJE_SIAT[codigo], advertencia: esAdvertencia(codigo) };
}

function respuesta(
  codigoEstado: CodigoEstadoSiat,
  mensajesList: readonly MensajeRecepcion[] = [],
  codigoRecepcion: string | null = null,
): RespuestaRecepcion {
  const aceptada =
    codigoEstado === ESTADO_SIAT.RECEPCION_VALIDADA ||
    codigoEstado === ESTADO_SIAT.RECEPCION_OBSERVADA ||
    codigoEstado === ESTADO_SIAT.ANULACION_CONFIRMADA ||
    codigoEstado === ESTADO_SIAT.REVERSION_ANULACION_CONFIRMADA;
  return {
    transaccion: aceptada,
    codigoEstado,
    codigoDescripcion: DESCRIPCION_ESTADO_SIAT[codigoEstado],
    codigoRecepcion,
    mensajesList,
    simulated: true,
  };
}

/** Importe en centavos. Admite los decimales del XSD (hasta 2). */
function centavos(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const [entero, decimales = ''] = String(valor).split('.');
  const signo = entero!.startsWith('-') ? -1 : 1;
  return signo * (Math.abs(Number(entero)) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2)));
}

export class SiatSimuladoAdapter implements FiscalProviderPort {
  readonly ambiente = 'SIMULADO' as const;

  private readonly padron: readonly ContribuyenteSimulado[];
  private readonly reloj: () => Date;
  private readonly cuis = new Coleccion<RegistroCuis>();
  private readonly cufds = new Coleccion<RegistroCufd>();
  private readonly facturas = new Coleccion<RegistroFactura>();

  constructor(opciones: OpcionesSiatSimulado) {
    this.padron = opciones.padron;
    this.reloj = opciones.reloj ?? (() => new Date());
    if (opciones.clavePersistencia !== undefined) {
      this.cuis.persistirEn(`${opciones.clavePersistencia}.cuis`);
      this.cufds.persistirEn(`${opciones.clavePersistencia}.cufd`);
      this.facturas.persistirEn(`${opciones.clavePersistencia}.facturas`);
    }
  }

  // ---- códigos ---------------------------------------------------------------

  solicitudCuis(contexto: ContextoFiscal): RespuestaCuis {
    const errores = this.erroresDeContexto(contexto);
    if (errores.length > 0) return { transaccion: false, codigo: null, fechaVigencia: null, mensajesList: errores, simulated: true };
    const clave = claveDe(contexto);
    const ahora = this.reloj();
    if (this.cuisVigente(clave, ahora) !== null) {
      return {
        transaccion: false,
        codigo: null,
        fechaVigencia: null,
        mensajesList: [this.mensajeServicio(MENSAJE_SIAT.EXISTE_CUIS_VIGENTE)],
        simulated: true,
      };
    }
    const registro = this.cuis.agregar({
      id: `${clave}|${ahora.getTime()}`,
      clave,
      codigo: hexSintetico(`cuis|${clave}|${ahora.getTime()}`, 8),
      fechaVigencia: new Date(ahora.getTime() + VIGENCIA_CUIS_MS).toISOString(),
    });
    return { transaccion: true, codigo: registro.codigo, fechaVigencia: registro.fechaVigencia, mensajesList: [], simulated: true };
  }

  solicitudCufd(solicitud: SolicitudCufd): RespuestaCufd {
    const vacia = { transaccion: false, codigo: null, codigoControl: null, direccion: null, fechaVigencia: null, simulated: true } as const;
    const errores = this.erroresDeContexto(solicitud);
    const ahora = this.reloj();
    const errorCuis = errores.length > 0 ? null : this.errorDeCuis(solicitud, ahora);
    if (errores.length > 0 || errorCuis !== null) {
      return { ...vacia, mensajesList: errorCuis === null ? errores : [errorCuis] };
    }
    const clave = claveDe(solicitud);
    const contribuyente = this.contribuyente(solicitud.nit)!;
    const semilla = `cufd|${clave}|${ahora.getTime()}|${this.cufds.tamano}`;
    const registro = this.cufds.agregar({
      id: semilla,
      clave,
      codigo: `SIMCUFD${hexSintetico(semilla, 36)}`,
      codigoControl: hexSintetico(`${semilla}|control`, 15),
      direccion: contribuyente.direccion,
      fechaVigencia: new Date(ahora.getTime() + VIGENCIA_CUFD_MS).toISOString(),
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
    return { transaccion: true, fechaHora: horaDeBolivia(this.reloj()), simulated: true };
  }

  sincronizarParametricas(): CatalogosFiscales {
    return CATALOGOS_SIMULADOS;
  }

  // ---- recepción ---------------------------------------------------------------

  recepcionFactura(solicitud: SolicitudRecepcionFactura, simulacion?: DirectivaDeSimulacion): RespuestaRecepcion {
    const ahora = this.reloj();
    const previos = this.erroresDeSolicitud(solicitud, ahora);
    if (previos.length > 0) return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, previos);

    let xml: string;
    try {
      xml = desempaquetarArchivo(solicitud.archivo, solicitud.hashArchivo);
    } catch (error: unknown) {
      if (error instanceof ErrorDeEmpaquetado || error instanceof TypeError) {
        return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, [mensaje(MENSAJE_SIAT.ARCHIVO_INVALIDO)]);
      }
      throw error;
    }

    let cabecera: FilaXml;
    let detalle: readonly FilaXml[];
    try {
      const leido = leerXmlFactura(xml);
      const esquema = esquemaPorRaiz(leido.raiz);
      if (esquema === null || esquema.codigoDocumentoSector !== solicitud.codigoDocumentoSector) {
        return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, [mensaje(MENSAJE_SIAT.NO_CUMPLE_XSD)]);
      }
      const { factura, problemas } = facturaDesdeXml(esquema, leido);
      if (problemas.length > 0) {
        return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, [mensaje(MENSAJE_SIAT.NO_CUMPLE_XSD)]);
      }
      cabecera = factura.cabecera;
      detalle = factura.detalle;
    } catch (error: unknown) {
      if (error instanceof ErrorDeLecturaXml) {
        return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, [mensaje(MENSAJE_SIAT.NO_CUMPLE_XSD)]);
      }
      throw error;
    }

    const errores: MensajeRecepcion[] = [];
    const advertencias: MensajeRecepcion[] = [];
    const cufd = this.cufds.filtrar((c) => c.codigo === solicitud.cufd)[0]!;

    if (String(cabecera['nitEmisor']) !== solicitud.nit) errores.push(mensaje(MENSAJE_SIAT.NIT_NO_CORRESPONDE_AL_CUFD));
    if (cabecera['cufd'] !== solicitud.cufd) errores.push(mensaje(MENSAJE_SIAT.CUFD_DEL_XML_INVALIDO));
    if (Number(cabecera['codigoSucursal']) !== solicitud.codigoSucursal) {
      errores.push(mensaje(MENSAJE_SIAT.SUCURSAL_NO_CORRESPONDE_AL_CUFD));
    }

    const cuf = String(cabecera['cuf']);
    let fechaHora: string | null = null;
    try {
      fechaHora = fechaHoraParaCuf(String(cabecera['fechaEmision']));
    } catch {
      errores.push(mensaje(MENSAJE_SIAT.FORMATO_DE_FECHA_INCORRECTO));
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
      if (esperado !== cuf) errores.push(mensaje(MENSAJE_SIAT.CUF_INVALIDO));
    }
    if (this.facturas.has(cuf)) errores.push(mensaje(MENSAJE_SIAT.CUF_YA_EXISTE));

    errores.push(...this.erroresDeMontos(cabecera, detalle));

    const clave = claveDe(solicitud);
    const numeroFactura = Number(cabecera['numeroFactura']);
    const anterior = this.ultimoNumero(clave, solicitud.codigoDocumentoSector);
    if (anterior !== null && numeroFactura !== anterior + 1) {
      advertencias.push(mensaje(MENSAJE_SIAT.ADVERTENCIA_CORRELATIVIDAD));
    }

    const forzado = simulacion?.forzarMensaje;
    if (forzado !== undefined && esCodigoDeMensajeConocido(forzado)) {
      const m: MensajeRecepcion = { ...mensaje(forzado), forzadoPorSimulacion: true };
      (m.advertencia ? advertencias : errores).push(m);
    }

    if (errores.length > 0) {
      return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, [...errores, ...advertencias]);
    }
    const estado = advertencias.length > 0 ? ESTADO_SIAT.RECEPCION_OBSERVADA : ESTADO_SIAT.RECEPCION_VALIDADA;
    const codigoRecepcion = `SIMREC-${hexSintetico(`recepcion|${cuf}`, 24)}`;
    this.facturas.agregar({
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
    return respuesta(estado, advertencias, codigoRecepcion);
  }

  verificacionEstadoFactura(solicitud: SolicitudConCuf): RespuestaRecepcion {
    const registro = this.facturas.get(solicitud.cuf);
    if (registro === undefined || registro.clave !== claveDe(solicitud)) {
      return respuesta(ESTADO_SIAT.RECEPCION_RECHAZADA, [mensaje(MENSAJE_SIAT.FACTURA_INEXISTENTE)]);
    }
    const estado = registro.anulada ? ESTADO_SIAT.ANULACION_CONFIRMADA : registro.estadoDeRecepcion;
    return respuesta(estado, [], registro.codigoRecepcion);
  }

  // ---- anulación ---------------------------------------------------------------

  anulacionFactura(solicitud: SolicitudAnulacion): RespuestaRecepcion {
    const registro = this.facturas.get(solicitud.cuf);
    if (registro === undefined || registro.clave !== claveDe(solicitud)) {
      return respuesta(ESTADO_SIAT.ANULACION_RECHAZADA, [mensaje(MENSAJE_SIAT.FACTURA_INEXISTENTE)]);
    }
    if (!existeEnCatalogo(CATALOGOS_SIMULADOS.motivosDeAnulacion, solicitud.codigoMotivo)) {
      return respuesta(ESTADO_SIAT.ANULACION_RECHAZADA, [mensaje(MENSAJE_SIAT.MOTIVO_ANULACION_INVALIDO)]);
    }
    if (registro.anulada) {
      return respuesta(ESTADO_SIAT.ANULACION_RECHAZADA, [mensaje(MENSAJE_SIAT.YA_ANULADA)]);
    }
    if (registro.revertida) {
      // «Un documento revertido no puede volver a anularse» (página oficial de
      // reversión). 941 es el código del catálogo para «no disponible para ser anulada».
      return respuesta(ESTADO_SIAT.ANULACION_RECHAZADA, [mensaje(MENSAJE_SIAT.NO_DISPONIBLE_PARA_ANULAR)]);
    }
    if (this.fueraDePlazo(registro.fechaEmision)) {
      return respuesta(ESTADO_SIAT.ANULACION_RECHAZADA, [mensaje(MENSAJE_SIAT.ANULACION_FUERA_DE_PLAZO)]);
    }
    this.facturas.actualizar(registro.id, { anulada: true });
    return respuesta(ESTADO_SIAT.ANULACION_CONFIRMADA, [], registro.codigoRecepcion);
  }

  /**
   * Una sola reversión, dentro del mismo plazo. El catálogo oficial no trae un
   * código de mensaje inequívoco para «ya revertida» ni para «fuera de plazo» de
   * una reversión (la página de reversión cita 3011/3012, ausentes del
   * catálogo), así que esos rechazos van con 909 y **sin** mensaje: no se
   * inventa uno.
   */
  reversionAnulacionFactura(solicitud: SolicitudConCuf): RespuestaRecepcion {
    const registro = this.facturas.get(solicitud.cuf);
    if (registro === undefined || registro.clave !== claveDe(solicitud)) {
      return respuesta(ESTADO_SIAT.REVERSION_ANULACION_RECHAZADA, [mensaje(MENSAJE_SIAT.FACTURA_INEXISTENTE)]);
    }
    if (!registro.anulada || registro.revertida || this.fueraDePlazo(registro.fechaEmision)) {
      return respuesta(ESTADO_SIAT.REVERSION_ANULACION_RECHAZADA);
    }
    this.facturas.actualizar(registro.id, { anulada: false, revertida: true });
    return respuesta(ESTADO_SIAT.REVERSION_ANULACION_CONFIRMADA, [], registro.codigoRecepcion);
  }

  // ---- reglas ------------------------------------------------------------------

  private contribuyente(nit: string): ContribuyenteSimulado | undefined {
    return this.padron.find((c) => c.nit === nit);
  }

  private mensajeServicio(codigo: CodigoMensajeSiat): MensajeServicio {
    return { codigo, descripcion: DESCRIPCION_MENSAJE_SIAT[codigo] };
  }

  private erroresDeContexto(contexto: ContextoFiscal): MensajeRecepcion[] {
    const contribuyente = this.contribuyente(contexto.nit);
    if (contribuyente === undefined) return [mensaje(MENSAJE_SIAT.NIT_INVALIDO)];
    const errores: MensajeRecepcion[] = [];
    if (contribuyente.codigoSistema !== contexto.codigoSistema) errores.push(mensaje(MENSAJE_SIAT.SISTEMA_NO_ASOCIADO));
    // CA-2: el simulador sólo atiende Computarizada en Línea.
    if (contexto.codigoModalidad !== 2) errores.push(mensaje(MENSAJE_SIAT.MODALIDAD_INVALIDA));
    if (!contribuyente.sucursales.includes(contexto.codigoSucursal)) errores.push(mensaje(MENSAJE_SIAT.SUCURSAL_INVALIDA));
    return errores;
  }

  private cuisVigente(clave: string, ahora: Date): RegistroCuis | null {
    return this.cuis.filtrar((c) => c.clave === clave && new Date(c.fechaVigencia) > ahora)[0] ?? null;
  }

  private errorDeCuis(solicitud: ContextoFiscal & { readonly cuis: string }, ahora: Date): MensajeRecepcion | null {
    const registro = this.cuis.filtrar((c) => c.codigo === solicitud.cuis)[0];
    if (registro === undefined) return mensaje(MENSAJE_SIAT.CUIS_INVALIDO);
    if (registro.clave !== claveDe(solicitud)) return mensaje(MENSAJE_SIAT.CUIS_NO_CORRESPONDE_A_SUCURSAL);
    if (new Date(registro.fechaVigencia) <= ahora) return mensaje(MENSAJE_SIAT.CUIS_NO_VIGENTE);
    return null;
  }

  private erroresDeSolicitud(solicitud: SolicitudRecepcion, ahora: Date): MensajeRecepcion[] {
    const errores = this.erroresDeContexto(solicitud);
    if (errores.length > 0) return errores;
    // CA-6: sin contingencia ni masiva en esta entrega.
    if (solicitud.codigoEmision !== 1) errores.push(mensaje(MENSAJE_SIAT.TIPO_EMISION_INVALIDO));
    if (solicitud.tipoFacturaDocumento !== 1) errores.push(mensaje(MENSAJE_SIAT.TIPO_FACTURA_DOCUMENTO_INVALIDO));
    const esquema = esquemaDeSector(solicitud.codigoDocumentoSector);
    if (esquema === null) {
      errores.push(mensaje(MENSAJE_SIAT.DOCUMENTO_SECTOR_INVALIDO));
    } else if (!esquema.activo || !this.contribuyente(solicitud.nit)!.sectoresHabilitados.includes(esquema.codigoDocumentoSector)) {
      errores.push(mensaje(MENSAJE_SIAT.DOCUMENTO_SECTOR_NO_HABILITADO));
    }
    const errorCuis = this.errorDeCuis(solicitud, ahora);
    if (errorCuis !== null) errores.push(errorCuis);
    const cufd = this.cufds.filtrar((c) => c.codigo === solicitud.cufd)[0];
    if (cufd === undefined) {
      errores.push(mensaje(MENSAJE_SIAT.CUFD_INVALIDO));
    } else if (new Date(cufd.fechaVigencia) <= ahora) {
      errores.push(mensaje(MENSAJE_SIAT.CUFD_NO_VIGENTE));
    } else if (cufd.clave !== claveDe(solicitud)) {
      errores.push(mensaje(MENSAJE_SIAT.SUCURSAL_NO_CORRESPONDE_AL_CUFD));
    }
    return errores;
  }

  private erroresDeMontos(cabecera: FilaXml, detalle: readonly FilaXml[]): MensajeRecepcion[] {
    const errores: MensajeRecepcion[] = [];
    let suma = 0;
    for (const fila of detalle) {
      const esperado = Math.round((centavos(fila['cantidad']) * centavos(fila['precioUnitario'])) / 100) - centavos(fila['montoDescuento']);
      if (centavos(fila['subTotal']) !== esperado) errores.push(mensaje(MENSAJE_SIAT.SUBTOTAL_ERRONEO));
      suma += centavos(fila['subTotal']);
    }
    const total = centavos(cabecera['montoTotal']);
    if (total !== suma - centavos(cabecera['descuentoAdicional'])) errores.push(mensaje(MENSAJE_SIAT.MONTO_TOTAL_ERRONEO));
    if (centavos(cabecera['montoTotalSujetoIva']) !== total - centavos(cabecera['montoGiftCard'])) {
      errores.push(mensaje(MENSAJE_SIAT.MONTO_TOTAL_SUJETO_IVA_ERRONEO));
    }
    const tipoCambio = centavos(cabecera['tipoCambio']);
    if (tipoCambio <= 0 || centavos(cabecera['montoTotalMoneda']) !== Math.round((total * 100) / tipoCambio)) {
      errores.push(mensaje(MENSAJE_SIAT.MONTO_TOTAL_MONEDA_ERRONEO));
    }
    // Un mismo código una sola vez, como una lista de mensajes legible.
    return errores.filter((m, i) => errores.findIndex((o) => o.codigo === m.codigo) === i);
  }

  private ultimoNumero(clave: string, sector: number): number | null {
    const numeros = this.facturas
      .filtrar((f) => f.clave === clave && f.codigoDocumentoSector === sector)
      .map((f) => f.numeroFactura);
    return numeros.length === 0 ? null : Math.max(...numeros);
  }

  /** Plazo: hasta el día 9 del mes siguiente a la emisión, hora de Bolivia. */
  private fueraDePlazo(fechaEmision: string): boolean {
    const [anio, mes] = fechaEmision.slice(0, 7).split('-').map(Number) as [number, number];
    const siguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
    const limite = `${siguiente.anio}-${String(siguiente.mes).padStart(2, '0')}-09T23:59:59.999`;
    return horaDeBolivia(this.reloj()) > limite;
  }
}
