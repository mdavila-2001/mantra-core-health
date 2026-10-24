/* ============================================================================
    Representación gráfica (PDF) de la factura SIMULADA.

    Elementos según la RND 102100000011, Art. 69 (columna «en línea»), y los
    PDF de ejemplo oficiales del SIN: emisor, NIT, número, «Cód. Autorización»
    (el CUF), título y subtítulo, fecha y hora, comprador, detalle, subtotal,
    descuento, gift card, total, monto a pagar, importe base de crédito
    fiscal, total en literal, las tres leyendas y el QR.

    **Nada de este papel tiene validez fiscal**, y lo dice en cada lugar donde
    se lo puede leer: la clase y el título de la portada («FACTURA SIMULADA ·
    SIN VALIDEZ FISCAL», «FACTURA (SIMULADA)»), el aviso con que abre el
    cuerpo, la marca de agua en cada hoja y el pie de cada hoja. El QR usa la
    forma oficial (`…/consulta/QR?nit=&cuf=&numero=&t=`) sobre el host
    `simulado.invalid` (RFC 2606: nunca resuelve), no el del SIN (CA-5), y mide
    más de 3 × 3 cm con su zona de silencio, como recomienda la norma.

    Todo lo dibuja el maquetador único del repo (`buildBlocksPdf`): la marca de
    agua es la suya (`watermark`, encima del contenido) y el QR es un bloque más
    del flujo (`qrBlock`), al final, que pasa entero de hoja si no entra. Antes
    se estampaban a mano después de maquetar, y había que reservar el pie de la
    última hoja con renglones invisibles para que el código no pisara el texto.
    ========================================================================== */

import type { jsPDF } from 'jspdf';

import type {
  SimulatedInvoice,
  SimulatedIssuer,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import {
  buildBlocksPdf,
  fieldsBlock,
  noteBlock,
  panelsBlock,
  totalsBlock,
  type PdfBlock,
  type PdfExportOptions,
  type PdfIssuer,
} from '../../shared/utils/pdf-export/pdf-export';
import { qrBlock } from '../../shared/utils/pdf-export/pdf-qr';
import { montoLiteral } from './monto-literal';

export const HOST_DEL_QR_SIMULADO = 'https://simulado.invalid/consulta/QR';
export const MARCA_SIMULADO = 'DOCUMENTO SIMULADO — SIN VALIDEZ FISCAL';

/** RND 102100000011, Art. 69: leyenda del SIN. */
export const LEYENDA_DEL_SIN =
  'Esta factura contribuye al desarrollo del país, el uso ilícito será sancionado penalmente de acuerdo a Ley';

/** RND 102100000011, Art. 26 III: leyenda de la representación en línea. */
export const LEYENDA_EN_LINEA =
  'Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea';

/** `t` del QR oficial: 1 rollo · 2 media hoja. */
export type TamanoDelQr = 1 | 2;

/** La marca de agua de cada hoja (el motor la pasa a versalitas). */
export const SIMULATED_INVOICE_WATERMARK = 'Simulada · Sin validez fiscal';

/** La línea legal del pie de cada hoja. */
export const SIMULATED_INVOICE_FOOTER = 'Factura SIMULADA · Sin validez fiscal · No emitida ante el SIN';

/** El signo menos tipográfico (U+2212), escrito por código: se confunde con el guion a la vista. */
const MENOS = String.fromCharCode(0x2212);

/** Espacio duro (U+00A0), escrito por código: invisible en la fuente es lo que el lint impide. */
const ESPACIO_DURO = String.fromCharCode(0xa0);

/** Un dato del pie que no se parte entre renglones: «Tel. 2 000 0000» partido en «Tel. 2» y «000 0000» es otro número. */
function sinCortes(dato: string): string {
  return dato.replace(/ /g, ESPACIO_DURO);
}

const UNIDADES: Readonly<Record<number, string>> = { 58: 'Unidad (servicios)', 1: 'Unidad' };

export function contenidoDelQr(factura: SimulatedInvoice, t: TamanoDelQr = 2): string {
  const parametros = new URLSearchParams({
    nit: factura.issuer.nit,
    cuf: factura.cuf,
    numero: String(factura.invoiceNumber),
    t: String(t),
  });
  return `${HOST_DEL_QR_SIMULADO}?${parametros.toString()}`;
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

/** `12.5` → `12.50`: el importe sin la moneda, para las columnas que la dicen en la cabecera. */
function importe(valor: unknown): string {
  const n = texto(valor) === '' ? '0' : texto(valor);
  return Number(n).toFixed(2);
}

function bs(valor: unknown): string {
  return `${importe(valor)} Bs`;
}

/** Lo que se resta del total, con el signo menos; un cero va sin signo. */
function bsRestado(valor: unknown): string {
  return Number(texto(valor) || '0') > 0 ? `${MENOS}${bs(valor)}` : bs(valor);
}

function fila(celdas: readonly string[], header = false): PdfBlock {
  return { kind: 'row', text: celdas.join('\t'), cells: celdas, ...(header ? { header: true } : {}) };
}

/** La fecha y hora de emisión del XML, sin zona: `2026-09-15T10:00:00.000`. */
const FECHA_DEL_SIAT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

/**
 * La `fechaEmision` del XML como fecha, **sin reinterpretar zona**: llega sin
 * zona y es hora de Bolivia, así que se toma la hora tal como está escrita.
 * `undefined` si no tiene la forma esperada: el motor rotula entonces «Fecha de
 * generación» en vez de inventar una emisión.
 */
export function invoiceIssuedAt(fechaEmision: string): Date | undefined {
  const m = FECHA_DEL_SIAT.exec(fechaEmision);
  if (m === null) return undefined;
  const [, anio, mes, dia, hora, minuto, segundo] = m.map(Number);
  return new Date(anio!, mes! - 1, dia!, hora!, minuto!, segundo!);
}

/**
 * El emisor del pie: la razón social, su NIT, su dirección y su teléfono, tal
 * como el emisor simulado los tiene. El NIT dice que es simulado (CA-4).
 */
export function pdfIssuerOf(emisor: SimulatedIssuer): PdfIssuer {
  const direccion = [emisor.address, emisor.municipality].filter((parte) => parte.trim() !== '').join(', ');
  return {
    name: emisor.legalName,
    details: [
      sinCortes(`NIT ${emisor.nit} (SIMULADO)`),
      ...(direccion === '' ? [] : [direccion]),
      ...(emisor.phone === null || emisor.phone.trim() === '' ? [] : [sinCortes(`Tel. ${emisor.phone}`)]),
    ],
  };
}

/**
 * El QR de verificación como bloque del flujo, o `null` si la librería no
 * carga (sin QR el papel sigue siendo legible y simulado). Nunca rechaza.
 */
export function invoiceQrBlock(factura: SimulatedInvoice): Promise<PdfBlock | null> {
  return qrBlock(
    contenidoDelQr(factura),
    'Este código no consulta al SIN: apunta a simulado.invalid, un dominio reservado que nunca resuelve. La factura no fue registrada ante la Administración Tributaria.',
    'Verificación SIMULADA',
  );
}

/**
 * Los bloques del PDF en orden de lectura. Exportada para probarla sin jsPDF.
 *
 * El título, el subtítulo, el número de factura y la fecha y hora de emisión
 * van en la portada (ver {@link invoicePdfOptions}) y no se repiten acá.
 *
 * @param qr - El bloque del QR ya armado ({@link invoiceQrBlock}), o `null`:
 *   entonces la dirección de verificación va como texto.
 */
export function bloquesDeRepresentacionGrafica(factura: SimulatedInvoice, qr: PdfBlock | null = null): PdfBlock[] {
  const c = factura.cabecera;
  const subtotal = factura.detalle.reduce((suma, d) => suma + Number(texto(d['subTotal']) || '0'), 0);
  const documento = texto(c['complemento']) === '' ? texto(c['numeroDocumento']) : `${texto(c['numeroDocumento'])}-${texto(c['complemento'])}`;
  const literal = montoLiteral(texto(c['montoTotal']));
  const leyendas = [LEYENDA_DEL_SIN, texto(c['leyenda']), `“${LEYENDA_EN_LINEA}”`].filter((leyenda) => leyenda.trim() !== '');
  const bloques: PdfBlock[] = [
    noteBlock(
      `${MARCA_SIMULADO}. Emitida por el simulador de AloVida; no fue enviada al SIN y no sirve para crédito fiscal.`,
      'alert',
      'Factura simulada',
    ),
    panelsBlock([
      {
        title: 'Emisor',
        fields: [
          { label: 'Razón social', value: texto(c['razonSocialEmisor']) },
          { label: 'NIT (SIMULADO)', value: texto(c['nitEmisor']) },
          { label: 'Dirección', value: texto(c['direccion']) },
          { label: 'Municipio', value: texto(c['municipio']) },
          { label: 'Teléfono', value: texto(c['telefono']) },
        ],
      },
      {
        title: 'Comprador',
        fields: [
          { label: 'Nombre / Razón social', value: texto(c['nombreRazonSocial']) },
          { label: 'NIT / CI / CEX', value: documento },
          { label: 'Cód. cliente', value: texto(c['codigoCliente']) },
        ],
      },
      // Los datos de la factura misma, como en los ejemplos del SIN: arriba y
      // juntos, al lado de las partes.
      {
        title: 'Factura',
        fields: [
          // El rótulo oficial; la marca va en el valor.
          { label: 'Cód. Autorización', value: `${factura.cuf} (SIMULADO)` },
          { label: 'Actividad', value: `${texto(factura.detalle[0]?.['actividadEconomica'])} (código simulado)` },
          { label: 'Casa matriz / sucursal', value: `N.º ${texto(c['codigoSucursal'])}` },
          { label: 'Punto de venta', value: `N.º ${texto(c['codigoPuntoVenta']) || '0'}` },
        ],
      },
    ]),
    // Sin título de sección: la cabecera de la tabla ya dice qué es, y el título
    // podía quedar solo al pie de una hoja con la tabla en la siguiente.
    // La moneda va en una línea bajo la tabla y no en cada celda, como en los
    // ejemplos del SIN: con «Bs» en siete columnas, los importes se partían en
    // dos renglones.
    fila(['Código', 'Descripción', 'Cantidad', 'Unidad', 'P. unitario', 'Descuento', 'Subtotal'], true),
    ...factura.detalle.map((d) =>
      fila([
        texto(d['codigoProducto']),
        texto(d['descripcion']),
        texto(d['cantidad']),
        UNIDADES[Number(d['unidadMedida'])] ?? `Código ${texto(d['unidadMedida'])}`,
        importe(d['precioUnitario']),
        importe(d['montoDescuento']),
        importe(d['subTotal']),
      ]),
    ),
    { kind: 'caption', text: 'Importes del detalle en bolivianos (Bs).' },
    totalsBlock([
      { label: 'Subtotal', value: bs(subtotal) },
      { label: 'Descuento', value: bsRestado(c['descuentoAdicional']) },
      { label: 'Total', value: bs(c['montoTotal']) },
      { label: 'Monto gift card', value: bsRestado(c['montoGiftCard']) },
      { label: 'Monto a pagar', value: bs(c['montoTotal']), emphasis: true },
    ]),
    fieldsBlock(
      [
        { label: 'Importe base crédito fiscal', value: bs(c['montoTotalSujetoIva']) },
        { label: 'Son', value: literal.replace(/^Son:\s*/, '') },
      ],
      2,
    ),
    // Las tres leyendas juntas, en un solo aviso neutro: son texto obligatorio
    // que se lee, no tres alertas.
    noteBlock(leyendas.join('\n'), 'neutral'),
    // Antes del QR y no después: al final quedaba sola en una hoja propia.
    {
      kind: 'caption',
      text: `Documento sector ${factura.documentSector} · Factura Compra y Venta · Computarizada en Línea · SIAT SIMULADO: ${factura.siatResponse.codigoEstado} ${factura.siatResponse.codigoDescripcion}`,
    },
    ...(qr === null
      ? [{ kind: 'caption' as const, text: `QR de verificación SIMULADO: ${contenidoDelQr(factura)} (no apunta al SIN)` }]
      : [qr]),
  ];
  return bloques;
}

/**
 * La portada, la marca de agua y el pie.
 *
 * - **Emisor**: la razón social de la factura, con su NIT simulado, su
 *   dirección y su teléfono —no AloVida—.
 * - **`issuedAt`**: la `fechaEmision` del XML, la de verdad.
 * - **Sin firma** (`firma: null`): una factura la emite la razón social, no el
 *   médico de la sesión.
 *
 * Exportada para que el spec fije la portada sin abrir el PDF.
 */
export function invoicePdfOptions(factura: SimulatedInvoice): PdfExportOptions {
  const issuedAt = invoiceIssuedAt(factura.issuedAt);
  return {
    title: 'FACTURA (SIMULADA)',
    subtitle: '(Con Derecho a Crédito Fiscal)',
    kind: 'Factura simulada · Sin validez fiscal',
    reference: `Factura N.º ${factura.invoiceNumber}`,
    meta: [{ label: 'Estado SIAT (SIMULADO)', value: factura.siatResponse.codigoDescripcion }],
    ...(issuedAt === undefined ? {} : { issuedAt }),
    issuer: pdfIssuerOf(factura.issuer),
    footerNote: SIMULATED_INVOICE_FOOTER,
    watermark: SIMULATED_INVOICE_WATERMARK,
    firma: null,
  };
}

/**
 * El PDF armado, sin guardar.
 *
 * @param qr - El bloque del QR ({@link invoiceQrBlock}), o `null` si no se pudo
 *   generar.
 */
export function construirRepresentacionGrafica(factura: SimulatedInvoice, qr: PdfBlock | null): jsPDF {
  return buildBlocksPdf(bloquesDeRepresentacionGrafica(factura, qr), invoicePdfOptions(factura));
}

/** `factura-12-SIMULADA.pdf` / `.xml`: el nombre también lo dice. */
export function nombreDeArchivo(factura: SimulatedInvoice, extension: 'pdf' | 'xml'): string {
  return `factura-${factura.invoiceNumber}-SIMULADA.${extension}`;
}

/** Genera el QR (lib cargada perezosamente por el motor) y descarga el PDF. */
export async function descargarRepresentacionGrafica(factura: SimulatedInvoice): Promise<void> {
  construirRepresentacionGrafica(factura, await invoiceQrBlock(factura)).save(nombreDeArchivo(factura, 'pdf'));
}

/** Descarga el XML tal cual se «envió» al SIAT simulado. */
export function descargarXml(factura: SimulatedInvoice): void {
  const blob = new Blob([factura.xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreDeArchivo(factura, 'xml');
  enlace.click();
  URL.revokeObjectURL(url);
}
