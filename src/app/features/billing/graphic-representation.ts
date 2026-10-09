/* ============================================================================
    Representación gráfica (PDF) de la factura SIMULADA.

    Elementos según la RND 102100000011, Art. 69 (columna «en línea»), y los
    PDF de ejemplo oficiales del SIN: emisor, NIT, número, «Cód. Autorización»
    (el CUF), título y subtítulo, fecha y hora, comprador, detalle, subtotal,
    descuento, gift card, total, monto a pagar, importe base de crédito
    fiscal, total en literal, las tres leyendas y el QR.

    **Nada de este papel tiene validez fiscal**, y lo dice tres veces: título
    «FACTURA (SIMULADA)», marca de agua en cada hoja y pie. El QR usa la forma
    oficial (`…/consulta/QR?nit=&cuf=&numero=&t=`) sobre el host
    `simulado.invalid` (RFC 2606: nunca resuelve), no el del SIN (CA-5).

    Usa el maquetador único del repo (`buildBlocksPdf`); lo único propio es la
    marca de agua y el QR, que el maquetador no ofrece.
    ========================================================================== */

import type { jsPDF } from 'jspdf';

import type { SimulatedInvoice } from '../../core/data-access/billing-simulated/billing-simulated.types';
import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../../shared/utils/pdf-export/pdf-export';
import { amountLiteral } from './amount-in-words';

export const SIMULATED_QR_HOST = 'https://simulado.invalid/consulta/QR';
export const SIMULATED_MARK = 'DOCUMENTO SIMULADO — SIN VALIDEZ FISCAL';

/** RND 102100000011, Art. 69: leyenda del SIN. */
export const WITHOUT_LEGEND =
  'Esta factura contribuye al desarrollo del país, el uso ilícito será sancionado penalmente de acuerdo a Ley';

/** RND 102100000011, Art. 26 III: leyenda de la representación en línea. */
export const INLINE_LEGEND =
  'Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea';

/** `t` del QR oficial: 1 rollo · 2 media hoja. */
export type QrSize = 1 | 2;

/** Espacio duro (U+00A0), escrito por código: invisible en la fuente es lo que el lint impide. */
const HARD_SPACE = String.fromCharCode(0xa0);
const BOOKED_LINES_FOR_QR = 7;

const UNITS: Readonly<Record<number, string>> = { 58: 'Unidad (servicios)', 1: 'Unidad' };

export function qrContent(factura: SimulatedInvoice, t: QrSize = 2): string {
  const parametros = new URLSearchParams({
    nit: factura.issuer.nit,
    cuf: factura.cuf,
    numero: String(factura.invoiceNumber),
    t: String(t),
  });
  return `${SIMULATED_QR_HOST}?${parametros.toString()}`;
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

function bs(valor: unknown): string {
  const n = texto(valor) === '' ? '0' : texto(valor);
  return `${Number(n).toFixed(2)} Bs`;
}

function fila(celdas: readonly string[], header = false): PdfBlock {
  return { kind: 'row', text: celdas.join('\t'), cells: celdas, ...(header ? { header: true } : {}) };
}

/** `2026-09-15T10:00:00.000` → `15/09/2026 10:00:00`, sin reinterpretar zona. */
function dateAndTime(fechaEmision: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/.exec(fechaEmision);
  return m === null ? fechaEmision : `${m[3]}/${m[2]}/${m[1]} ${m[4]}`;
}

/** Los bloques del PDF en orden de lectura. Exportada para probarla sin jsPDF. */
export function graphicRepresentationBlocks(factura: SimulatedInvoice): PdfBlock[] {
  const c = factura.cabecera;
  const subtotal = factura.detalle.reduce((suma, d) => suma + Number(texto(d['subTotal']) || '0'), 0);
  const documento = texto(c['complemento']) === '' ? texto(c['numeroDocumento']) : `${texto(c['numeroDocumento'])}-${texto(c['complemento'])}`;
  const bloques: PdfBlock[] = [
    { kind: 'note', text: `${SIMULATED_MARK}. Emitida por el simulador de AloVida; no fue enviada al SIN.` },
    { kind: 'heading', level: 1, text: 'FACTURA (SIMULADA)' },
    { kind: 'paragraph', text: '(Con Derecho a Crédito Fiscal)' },
    { kind: 'heading', level: 2, text: 'Emisor' },
    campoDeBloque('Razón social', texto(c['razonSocialEmisor'])),
    campoDeBloque('Casa matriz / sucursal', `N.º ${texto(c['codigoSucursal'])}`),
    campoDeBloque('Punto de venta', `N.º ${texto(c['codigoPuntoVenta']) || '0'}`),
    campoDeBloque('Dirección', texto(c['direccion'])),
    campoDeBloque('Municipio', texto(c['municipio'])),
    ...(texto(c['telefono']) === '' ? [] : [campoDeBloque('Teléfono', texto(c['telefono']))]),
    campoDeBloque('NIT (SIMULADO)', texto(c['nitEmisor'])),
    campoDeBloque('Factura N.º', texto(c['numeroFactura'])),
    // El rótulo oficial; la marca va en el valor para no desbordar la columna de rótulos.
    campoDeBloque('Cód. Autorización', `${factura.cuf} (SIMULADO)`),
    campoDeBloque('Actividad', `${texto(factura.detalle[0]?.['actividadEconomica'])} (código simulado)`),
    { kind: 'heading', level: 2, text: 'Comprador' },
    campoDeBloque('Fecha', dateAndTime(factura.issuedAt)),
    campoDeBloque('Nombre / Razón social', texto(c['nombreRazonSocial'])),
    campoDeBloque('NIT / CI / CEX', documento),
    campoDeBloque('Cód. cliente', texto(c['codigoCliente'])),
    { kind: 'heading', level: 2, text: 'Detalle' },
    fila(['Código', 'Descripción', 'Cantidad', 'Unidad', 'P. unitario', 'Descuento', 'Subtotal'], true),
    ...factura.detalle.map((d) =>
      fila([
        texto(d['codigoProducto']),
        texto(d['descripcion']),
        texto(d['cantidad']),
        UNITS[Number(d['unidadMedida'])] ?? `Código ${texto(d['unidadMedida'])}`,
        bs(d['precioUnitario']),
        bs(d['montoDescuento']),
        bs(d['subTotal']),
      ]),
    ),
    campoDeBloque('Subtotal', bs(subtotal)),
    campoDeBloque('Descuento', bs(c['descuentoAdicional'])),
    campoDeBloque('Total', bs(c['montoTotal'])),
    campoDeBloque('Monto gift card', bs(c['montoGiftCard'])),
    { kind: 'total', text: `Monto a pagar: ${bs(c['montoTotal'])}` },
    // Línea completa: el rótulo oficial no entra en la columna de rótulos.
    { kind: 'paragraph', text: `Importe base crédito fiscal: ${bs(c['montoTotalSujetoIva'])}` },
    { kind: 'paragraph', text: amountLiteral(texto(c['montoTotal'])) },
    { kind: 'note', text: WITHOUT_LEGEND },
    { kind: 'note', text: texto(c['leyenda']) },
    { kind: 'note', text: `“${INLINE_LEGEND}”` },
    {
      kind: 'caption',
      text: `Documento sector ${factura.documentSector} · Factura Compra y Venta · Computarizada en Línea · SIAT SIMULADO: ${factura.siatResponse.codigoEstado} ${factura.siatResponse.codigoDescripcion}`,
    },
    { kind: 'caption', text: `QR de verificación SIMULADO: ${qrContent(factura)} (no apunta al SIN)` },
    // Reserva el pie de la última hoja para el QR: si el contenido llega al
    // final, el maquetador pasa de hoja en vez de dejarlo debajo del código.
    // Párrafos con un espacio duro y no `blank`, que dibuja renglones para
    // escribir a mano.
    ...Array.from({ length: BOOKED_LINES_FOR_QR }, (): PdfBlock => ({ kind: 'paragraph', text: HARD_SPACE })),
  ];
  return bloques;
}

/**
 * Marca de agua en diagonal, en cada hoja.
 *
 * jsPDF alinea el texto **antes** de rotarlo, así que `align: 'center'` con
 * ángulo lo corre hacia un costado y lo corta. El punto de partida se calcula
 * a mano para que el centro del texto rotado caiga en el centro de la hoja, y
 * el tamaño se ajusta para que el largo quepa en el 80 % del ancho.
 */
export function markSimulatedAs(documento: jsPDF): void {
  const angulo = 35;
  const radianes = (angulo * Math.PI) / 180;
  const paginas = documento.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    documento.setPage(pagina);
    const ancho = documento.internal.pageSize.getWidth();
    const alto = documento.internal.pageSize.getHeight();
    let tamano = 28;
    documento.setFontSize(tamano);
    const largoBase = documento.getTextWidth(SIMULATED_MARK);
    tamano = Math.min(tamano, (tamano * ancho * 0.8) / (largoBase * Math.cos(radianes)));
    documento.setFontSize(tamano);
    const largo = documento.getTextWidth(SIMULATED_MARK);
    const x = ancho / 2 - (largo / 2) * Math.cos(radianes);
    const y = alto / 2 + (largo / 2) * Math.sin(radianes);
    documento.setTextColor(210, 210, 210);
    documento.text(SIMULATED_MARK, x, y, { angle: angulo });
  }
  documento.setTextColor(0, 0, 0);
}

/** El QR, ≥ 3 × 3 cm como recomienda la norma, abajo a la derecha de la última hoja. */
export function addQr(documento: jsPDF, qrPng: string): void {
  const LADO_PT = 90; // ≈ 3,2 cm
  const MARGEN_PT = 40;
  documento.setPage(documento.getNumberOfPages());
  const ancho = documento.internal.pageSize.getWidth();
  const alto = documento.internal.pageSize.getHeight();
  documento.addImage(qrPng, 'PNG', ancho - LADO_PT - MARGEN_PT, alto - LADO_PT - MARGEN_PT - 20, LADO_PT, LADO_PT);
}

/** El PDF armado, sin guardar. `qrPng` es una data URL PNG, o `null` si no se pudo generar. */
export function buildGraphicRepresentation(factura: SimulatedInvoice, qrPng: string | null): jsPDF {
  const documento = buildBlocksPdf(graphicRepresentationBlocks(factura), {
    title: 'Factura (SIMULADA)',
    kind: 'Factura simulada',
    reference: `N.º ${factura.invoiceNumber}`,
    subtitle: `${factura.issuer.legalName} · ${dateAndTime(factura.issuedAt)}`,
    footerNote: 'Factura SIMULADA · Sin validez fiscal · No emitida ante el SIN · AloVida',
  });
  markSimulatedAs(documento);
  if (qrPng !== null) addQr(documento, qrPng);
  return documento;
}

/** `factura-12-SIMULADA.pdf` / `.xml`: el nombre también lo dice. */
export function fileName(factura: SimulatedInvoice, extension: 'pdf' | 'xml'): string {
  return `factura-${factura.invoiceNumber}-SIMULADA.${extension}`;
}

/** Genera el QR (lib cargada perezosamente) y descarga el PDF. */
export async function downloadGraphicRepresentation(factura: SimulatedInvoice): Promise<void> {
  buildGraphicRepresentation(factura, await qrAsPng(factura)).save(fileName(factura, 'pdf'));
}

/** El QR como PNG, o `null` si la lib no carga: sin QR el papel sigue siendo legible y simulado. */
async function qrAsPng(factura: SimulatedInvoice): Promise<string | null> {
  try {
    const modulo = (await import('qrcode')) as typeof import('qrcode') & { readonly default?: typeof import('qrcode') };
    const qr = modulo.default ?? modulo;
    return await qr.toDataURL(qrContent(factura), { margin: 2, width: 360, color: { dark: '#000000', light: '#ffffff' } });
  } catch {
    return null;
  }
}

/** Descarga el XML tal cual se «envió» al SIAT simulado. */
export function downloadXml(factura: SimulatedInvoice): void {
  const blob = new Blob([factura.xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = fileName(factura, 'xml');
  enlace.click();
  URL.revokeObjectURL(url);
}
