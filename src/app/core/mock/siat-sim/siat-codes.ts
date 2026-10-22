/* ============================================================================
    Los códigos de estado y de mensaje del SIAT que usa el simulador.

    **Forma real, uso simulado.** Los números y las descripciones están
    transcritos del catálogo oficial del SIN —«Códigos de error SIAT»,
    https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/implementacion-servicios-facturacion/codigos-error-siat
    (leído el 2026-09-26)— para que una pantalla construida contra el simulador
    lea lo mismo que leerá contra el SIAT. Lo que **no** es real es el hecho:
    ninguna respuesta de este simulador viene del SIN, y cada una lo declara
    (`simulated: true`).

    Sólo está el subconjunto que el simulador puede producir. Agregar un código
    exige copiarlo de la fuente oficial, no deducirlo.
    ========================================================================== */

/** Estados de una recepción, anulación o reversión (catálogo oficial). */
export const SIAT_STATUS = {
  RECEPCION_PENDIENTE: 901,
  RECEPCION_RECHAZADA: 902,
  RECEPCION_PROCESADA: 903,
  RECEPCION_OBSERVADA: 904,
  ANULACION_CONFIRMADA: 905,
  ANULACION_RECHAZADA: 906,
  REVERSION_ANULACION_CONFIRMADA: 907,
  RECEPCION_VALIDADA: 908,
  REVERSION_ANULACION_RECHAZADA: 909,
} as const;

export type SiatStatusCode = (typeof SIAT_STATUS)[keyof typeof SIAT_STATUS];

export const SIAT_STATUS_DESCRIPTION: Readonly<Record<SiatStatusCode, string>> = {
  901: 'Recepción Pendiente',
  902: 'Recepción Rechazada',
  903: 'Recepción Procesada',
  904: 'Recepción Observada',
  905: 'Anulación Confirmada',
  906: 'Anulación Rechazada',
  907: 'Reversión De Anulación Confirmada',
  908: 'Recepción Validada',
  909: 'Reversión De Anulación Rechazada',
};

/** Mensajes (errores y advertencias) que el simulador sabe producir. */
export const SIAT_MESSAGE = {
  CUIS_INVALIDO: 913,
  CUFD_INVALIDO: 914,
  TIPO_FACTURA_DOCUMENTO_INVALIDO: 915,
  TIPO_EMISION_INVALIDO: 916,
  MODALIDAD_INVALIDA: 917,
  SUCURSAL_INVALIDA: 918,
  SISTEMA_NO_ASOCIADO: 912,
  NIT_INVALIDO: 919,
  ARCHIVO_INVALIDO: 920,
  FACTURA_INEXISTENTE: 924,
  MOTIVO_ANULACION_INVALIDO: 925,
  CUIS_NO_VIGENTE: 929,
  CUIS_NO_CORRESPONDE_A_SUCURSAL: 930,
  DOCUMENTO_SECTOR_INVALIDO: 931,
  ANULACION_FUERA_DE_PLAZO: 934,
  YA_ANULADA: 936,
  NO_CUMPLE_XSD: 939,
  DOCUMENTO_SECTOR_NO_HABILITADO: 940,
  NO_DISPONIBLE_PARA_ANULAR: 941,
  CUFD_NO_VIGENTE: 953,
  EXISTE_CUIS_VIGENTE: 980,
  CUF_YA_EXISTE: 1000,
  NIT_NO_CORRESPONDE_AL_CUFD: 1001,
  CUF_INVALIDO: 1002,
  CUFD_DEL_XML_INVALIDO: 1003,
  SUCURSAL_NO_CORRESPONDE_AL_CUFD: 1004,
  MONTO_TOTAL_ERRONEO: 1013,
  MONTO_TOTAL_MONEDA_ERRONEO: 1014,
  SUBTOTAL_ERRONEO: 1018,
  SUMATORIA_DE_DETALLES_ERRONEA: 1024,
  FORMATO_DE_FECHA_INCORRECTO: 1035,
  MONTO_TOTAL_SUJETO_IVA_ERRONEO: 1058,
  ADVERTENCIA_CORRELATIVIDAD: 2000,
  ADVERTENCIA_NIT_DEL_CLIENTE_NO_VALIDO: 2005,
} as const;

export type SiatMessageCode = (typeof SIAT_MESSAGE)[keyof typeof SIAT_MESSAGE];

export const SIAT_MESSAGE_DESCRIPTION: Readonly<Record<SiatMessageCode, string>> = {
  913: 'Código Único De Inicio De Sistema (Cuis) Invalido',
  914: 'Código Único De Facturación Diaria (Cufd) Invalido',
  915: 'El Parámetro Tipo Factura Documento Es Invalido',
  916: 'El Parámetro Tipo De Emisión Es Invalido',
  917: 'El Parámetro Modalidad Es Invalido',
  918: 'El Parámetro Sucursal Es Invalido',
  912: 'El Sistema No Esta Asociado Al Contribuyente',
  919: 'El Parámetro NIT Es Invalido',
  920: 'El Parámetro Archivo Es Invalido',
  924: 'La Factura o Nota, No Existe En La Base De Datos Del Sin',
  925: 'El Parámetro Motivo De Anulación Es Invalido',
  929: 'El Código Único De Inicio De Sistema (Cuis) No Esta Vigente',
  930: 'El Código Único De Inicio De Sistema (Cuis) No Corresponde A La Sucursal/Punto Venta',
  931: 'El Parámetro Código Documento Sector Es Invalido',
  934: 'La Solicitud De Anulación De La Factura o Nota De Crédito-Débito Se Encuentra Fuera De Plazo',
  936: 'La Factura o Nota De Crédito-Débito Ya Se Encuentra Anulada',
  939: 'La Factura o Nota De Crédito - Débito No Cumple Con El Formato Del Xsd Especificado',
  940: 'El NIT No Tiene Habilitado El Documento Sector',
  941: 'La Factura o Nota De Crédito - Débito No Se Encuentra Disponible Para Ser Anulada',
  953: 'El Código Único De Facturación Diaria (Cufd) No Se Encuentra Vigente',
  980: 'Existe Un Cuis Vigente Para La Sucursal O Punto De Venta',
  1000: 'El Cuf Enviado Ya Existe En La Base De Datos Del Sin',
  1001: 'El NIT Enviado En El XML Es Inexistente O No Corresponde Al Cufd',
  1002: 'El Código Único De Factura (Cuf) Enviado En El XML Es Invalido',
  1003: 'El Código Único De Facturación Diaria (Cufd) Enviado En El XML Es Invalido',
  1004: 'La Sucursal Enviada En El XML No Corresponde A Los Datos Del Cufd',
  1013: 'El Calculo Del Monto Total Es Erróneo',
  1014: 'El Calculo Del Monto Total Moneda Es Erróneo',
  1018: 'El Calculo Del Subtotal Es Erróneo',
  1024: 'La Sumatoria De Lo Detalles Es Errónea',
  1035: 'Formato De Fecha Incorrecta',
  1058: 'El Monto Total Sujeto Iva Es Erróneo',
  2000: 'Advertencia: El Numero Factura Enviado Tiene Error De Correlatividad',
  2005: 'Advertencia: El NIT Del Cliente Enviado En El Campo Numero De Documento No Es Valido',
};

/**
 * Las advertencias no rechazan: dejan la recepción **observada** (904). En el
 * catálogo oficial son las que empiezan con «Advertencia:»; se listan una por
 * una en vez de deducirlas por rango.
 */
const WARNINGS: ReadonlySet<number> = new Set<number>([
  SIAT_MESSAGE.ADVERTENCIA_CORRELATIVIDAD,
  SIAT_MESSAGE.ADVERTENCIA_NIT_DEL_CLIENTE_NO_VALIDO,
]);

export function isWarning(codigo: number): boolean {
  return WARNINGS.has(codigo);
}

export function isKnownMessageCode(codigo: number): codigo is SiatMessageCode {
  return Object.prototype.hasOwnProperty.call(SIAT_MESSAGE_DESCRIPTION, codigo);
}
