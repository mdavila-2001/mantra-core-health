/**
 * **La factura como documento** (T-E4 · F2.1.12, F3.3): lo que la persona
 * abre, lee y descarga. Ender es dueño de este documento; la bandeja del
 * mostrador (Itzan, `resumen-de-factura`) muestra sólo su resumen con los
 * mismos rótulos.
 *
 * Todo texto llega ya resuelto —nombres, fechas, importes como texto exacto—
 * y **nada** de este archivo sabe de farmacias: el emisor es un dato más, así
 * que el mismo documento sirve para el supermercado (T-E5) con otro emisor.
 *
 * Hoy no hay contrato de facturación: quien arma un `DocumentoDeFactura` lo
 * hace con datos de ejemplo (`order-invoice.fixtures.ts`) y la pantalla lo
 * rotula como tal.
 */

/** Quien emite la factura: el comercio y sus datos fiscales. */
export interface EmisorDeFactura {
  /** El nombre con que la persona reconoce al comercio. */
  readonly nombre: string;
  /** La sucursal o el canal que vendió; `null` si no aplica. */
  readonly detalle: string | null;
  readonly razonSocial: string;
  /** Texto y no número: un NIT es un identificador, no una cifra. */
  readonly nit: string;
}

/** A nombre de quién se emite. */
export interface CompradorDeFactura {
  readonly nombre: string;
  readonly documento: string;
}

/** Un renglón facturado, ya en palabras. */
export interface LineaDeFactura {
  readonly descripcion: string;
  readonly cantidad: number;
  /** Precio × cantidad como texto exacto, o `null` sin precio publicado. */
  readonly importe: string | null;
}

/** Lo que el seguro dejó a cargo de la persona, según su liquidación publicada. */
export interface CoaseguroDeFactura {
  readonly aseguradora: string;
  readonly importe: string;
  readonly moneda: string;
}

/** La factura completa, tal como la pantalla y el PDF la dicen. */
export interface DocumentoDeFactura {
  /** Identificador de la compra: sólo para el nombre del archivo, jamás se imprime. */
  readonly id: string;
  readonly numero: string;
  readonly emitidaEl: Date;
  readonly estado: string;
  readonly emisor: EmisorDeFactura;
  readonly comprador: CompradorDeFactura;
  readonly lineas: readonly LineaDeFactura[];
  /** Suma de los renglones, o `null` si falta algún precio publicado. */
  readonly subtotal: string | null;
  /** El descuento de la red, o `null` si no aplica. */
  readonly descuentoDeRed: string | null;
  /** Sólo con una liquidación de seguro publicada. */
  readonly coaseguro: CoaseguroDeFactura | null;
  /** Subtotal menos descuento, o `null` si falta algún precio publicado. */
  readonly total: string | null;
  readonly moneda: string;
}

/**
 * Los rótulos del documento. Los cuatro primeros son los del resumen del
 * mostrador (`resumen-de-factura.html`): una misma factura se nombra igual en
 * las dos caras (AC-T-E4-07).
 */
export const ROTULOS_DE_FACTURA = Object.freeze({
  numero: 'Número',
  emitidaEl: 'Emitida el',
  total: 'Total facturado',
  estado: 'Estado',
  subtotal: 'Subtotal',
  descuentoDeRed: 'Descuento red AloVida',
  coaseguro: 'Coaseguro',
});
