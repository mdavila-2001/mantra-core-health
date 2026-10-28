/* ============================================================================
    FiscalProviderPort — el contrato entre «MANTRA facturación» y la
    administración tributaria.

    Los nombres de operaciones y de campos son los del SIAT (WSDL de los
    servicios `FacturacionCodigos`, `FacturacionSincronizacion` y
    `ServicioFacturacionCompraVenta`, piloto, leídos el 2026-09-26), para que el
    adaptador real no tenga que traducir nada.

    ## Qué se reemplaza y dónde

    Hoy lo implementa `SiatSimuladoAdapter`, dentro del backend simulado del
    front (CA-3). El adaptador real **no puede vivir en el front**: necesita el
    token delegado del contribuyente, a veces un certificado de firma, SOAP y
    secretos. Vivirá en la API, que implementará este mismo contrato —en su
    versión asíncrona: las operaciones de acá son síncronas sólo porque los
    manejadores del simulador lo son—. El front real hablará con la API de
    facturación, nunca con el SIN.

    `simulacion` es un parámetro exclusivo del simulador; un adaptador real lo
    ignora.
    ========================================================================== */

import type { FiscalCatalogs } from './simulated-catalogs';
import type { SiatStatusCode } from './siat-codes';

/** Identifica al contribuyente, su sistema y el lugar de emisión. */
export interface ContextoFiscal {
  readonly nit: string;
  readonly codigoSistema: string;
  readonly codigoSucursal: number;
  readonly codigoPuntoVenta: number;
  /** 1 Electrónica en Línea · 2 Computarizada en Línea. El simulador sólo atiende 2 (CA-2). */
  readonly codigoModalidad: number;
}

export interface MensajeServicio {
  readonly codigo: number;
  readonly descripcion: string;
}

export interface MensajeRecepcion extends MensajeServicio {
  readonly advertencia: boolean;
  /** Sólo en el simulador: el mensaje lo pidió la directiva de simulación, no una regla. */
  readonly forzadoPorSimulacion?: true;
}

export interface RespuestaCuis {
  readonly transaccion: boolean;
  readonly codigo: string | null;
  readonly fechaVigencia: string | null;
  readonly mensajesList: readonly MensajeServicio[];
  readonly simulated: true;
}

export interface SolicitudCufd extends ContextoFiscal {
  readonly cuis: string;
}

export interface RespuestaCufd {
  readonly transaccion: boolean;
  readonly codigo: string | null;
  readonly codigoControl: string | null;
  readonly direccion: string | null;
  readonly fechaVigencia: string | null;
  readonly mensajesList: readonly MensajeServicio[];
  readonly simulated: true;
}

export interface RespuestaFechaHora {
  readonly transaccion: boolean;
  /** Hora de Bolivia, `yyyy-MM-ddTHH:mm:ss.SSS`, como la `fechaEmision` del XML. */
  readonly fechaHora: string;
  readonly simulated: true;
}

/** `solicitudRecepcion` del WSDL. */
export interface SolicitudRecepcion extends ContextoFiscal {
  readonly cuis: string;
  readonly cufd: string;
  readonly codigoDocumentoSector: number;
  /** 1 En línea · 2 Fuera de línea · 3 Masiva. */
  readonly codigoEmision: number;
  /** 1 Con derecho a crédito fiscal. */
  readonly tipoFacturaDocumento: number;
}

/** `solicitudRecepcionFactura` del WSDL. */
export interface SolicitudRecepcionFactura extends SolicitudRecepcion {
  /** XML en gzip, en base64. */
  readonly archivo: string;
  readonly fechaEnvio: string;
  /** SHA-256 del gzip. */
  readonly hashArchivo: string;
}

export interface SolicitudConCuf extends SolicitudRecepcion {
  readonly cuf: string;
}

export interface SolicitudAnulacion extends SolicitudConCuf {
  readonly codigoMotivo: number;
}

/** `respuestaRecepcion` del WSDL. */
export interface RespuestaRecepcion {
  readonly transaccion: boolean;
  readonly codigoEstado: SiatStatusCode;
  readonly codigoDescripcion: string;
  readonly codigoRecepcion: string | null;
  readonly mensajesList: readonly MensajeRecepcion[];
  readonly simulated: true;
}

/**
 * Directiva exclusiva del simulador: responder con un mensaje del catálogo
 * oficial aunque ninguna regla lo dispare, para poder mostrar cada rama.
 * Un adaptador real la ignora.
 */
export interface DirectivaDeSimulacion {
  readonly forzarMensaje?: number;
}

export interface FiscalProviderPort {
  /** `'SIMULADO'` en el simulador; el real declarará su `codigoAmbiente` (1 Producción · 2 Pruebas y Piloto). */
  readonly ambiente: 'SIMULADO';
  solicitudCuis(contexto: ContextoFiscal): RespuestaCuis;
  solicitudCufd(solicitud: SolicitudCufd): RespuestaCufd;
  sincronizarFechaHora(contexto: ContextoFiscal): RespuestaFechaHora;
  sincronizarParametricas(contexto: ContextoFiscal): FiscalCatalogs;
  recepcionFactura(solicitud: SolicitudRecepcionFactura, simulacion?: DirectivaDeSimulacion): RespuestaRecepcion;
  verificacionEstadoFactura(solicitud: SolicitudConCuf): RespuestaRecepcion;
  anulacionFactura(solicitud: SolicitudAnulacion): RespuestaRecepcion;
  reversionAnulacionFactura(solicitud: SolicitudConCuf): RespuestaRecepcion;
}
