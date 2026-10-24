import type { jsPDF } from 'jspdf';

import {
  buildBlocksPdf,
  formatMoney,
  noteBlock,
  panelsBlock,
  totalsBlock,
  type PdfBlock,
  type PdfExportOptions,
  type PdfTotalRow,
} from '../../../../shared/utils/pdf-export/pdf-export';
import { ROTULOS_DE_FACTURA, type DocumentoDeFactura } from './order-invoice.types';
import { displayCurrency } from '../../../../core/money/display-currency';

/**
 * La factura de ejemplo en PDF (T-E4). Usa el mismo maquetador que el
 * comprobante interno (`buildBlocksPdf`) pero **no** su módulo: el
 * comprobante dice por diseño que no es una factura, y esa semántica no se
 * toca. Este papel dice lo contrario —es una factura— y, mientras no haya
 * facturación real, que es de ejemplo y sin validez fiscal.
 *
 * ## Cómo se compone
 *
 * - **La portada** lleva el número (folio), la fecha de la factura como fecha
 *   de emisión y el estado en los metadatos. El cuerpo no los repite.
 * - **El emisor es el comercio**, con los datos que la factura trae: razón
 *   social, NIT y la sucursal. Va en el pie de todas las hojas y en su tarjeta,
 *   al lado de la del comprador.
 * - **Sin validez fiscal**, dicho tres veces y a propósito: aviso de alerta
 *   arriba, marca de agua en cada hoja y línea del pie. Una fotocopia de la
 *   segunda hoja tiene que seguir diciéndolo.
 * - **Lo facturado, en tabla**, y subtotal, descuento y total en la caja de
 *   totales, en formato boliviano (`1.234,56 Bs`, descuento con «−»). Sin
 *   total no hay caja sino un aviso, con el mismo texto que el comprobante.
 * - **El coaseguro** no suma ni resta —es lo que el seguro dejó a cargo de la
 *   persona—: va en su tarjeta, al lado del comprador, y una línea bajo los
 *   totales dice que no se descuenta del total facturado.
 * - Los textos de la factura dicen «farmacia», como el comprobante del mismo
 *   pedido.
 * - Sin bloque de firma: una factura no la firma un médico.
 */

/** La raya que ocupa la columna de importes de un renglón sin precio. */
const SIN_IMPORTE = '—';

/**
 * Lo que dice el papel cuando falta un precio. Son los mismos textos que el
 * comprobante del pedido (`receipt-pdf.ts`): un mismo vacío se dice igual en
 * los dos papeles.
 */
const MISSING_PRICE_CAPTION = `${SIN_IMPORTE} Precio no publicado por la farmacia: el producto no tiene importe propio en el detalle.`;
const MISSING_TOTAL_NOTE = 'Total no disponible: falta algún precio publicado.';

/** Arma el PDF. No lo guarda: devuelve el documento. */
export function buildInvoicePdf(factura: DocumentoDeFactura): jsPDF {
  return buildBlocksPdf(bloquesDeFactura(factura), invoicePdfOptions(factura));
}

/**
 * La portada, el membrete y el pie. Exportadas para que el spec las fije sin
 * pasar por el motor.
 */
export function invoicePdfOptions(factura: DocumentoDeFactura): PdfExportOptions {
  const { emisor } = factura;
  return {
    title: 'Factura',
    kind: 'Factura de ejemplo',
    reference: `N.º ${factura.numero}`,
    subtitle: emisor.nombre,
    meta: [{ label: ROTULOS_DE_FACTURA.estado, value: factura.estado }],
    // La fecha de la factura, no la de descarga.
    issuedAt: factura.emitidaEl,
    issuer: {
      name: emisor.razonSocial,
      details: [
        `NIT ${emisor.nit}`,
        ...(emisor.nombre !== emisor.razonSocial ? [emisor.nombre] : []),
        ...(emisor.detalle === null ? [] : [emisor.detalle]),
      ],
    },
    footerNote: 'Factura de ejemplo · Sin validez fiscal · AloVida',
    watermark: 'Sin validez fiscal',
    firma: null,
  };
}

/** Descarga la factura: `factura-2026-09-15-a1b2c3.pdf`. */
export function downloadInvoicePdf(factura: DocumentoDeFactura): void {
  buildInvoicePdf(factura).save(nombreDeArchivo(factura.emitidaEl, factura.id));
}

/** Las líneas del PDF en orden de lectura. Exportada para probarla sin jsPDF. */
export function bloquesDeFactura(factura: DocumentoDeFactura): readonly PdfBlock[] {
  const { emisor, comprador, coaseguro, moneda } = factura;
  const bloques: PdfBlock[] = [
    noteBlock(
      'Factura de ejemplo: el número, los datos fiscales y el descuento no salen de un sistema de facturación. No reemplaza la factura que emite la farmacia.',
      'alert',
      'Sin validez fiscal',
    ),
    panelsBlock([
      {
        title: 'Emisor',
        fields: [
          { label: 'Razón social', value: emisor.razonSocial },
          { label: 'NIT', value: emisor.nit },
          { label: 'Farmacia', value: comercioDe(factura) },
        ],
      },
      {
        title: 'Comprador',
        fields: [
          { label: 'Nombre', value: comprador.nombre },
          { label: 'Documento', value: comprador.documento },
        ],
      },
      // El coaseguro no suma ni resta: es lo que el seguro dejó a cargo de la
      // persona. Dentro de la caja de totales se leería como parte de la cuenta.
      ...(coaseguro === null
        ? []
        : [
            {
              title: 'Seguro',
              fields: [
                { label: 'Aseguradora', value: coaseguro.aseguradora },
                { label: ROTULOS_DE_FACTURA.coaseguro, value: dinero(coaseguro.importe, coaseguro.moneda) },
              ],
            },
          ]),
    ]),
    { kind: 'heading', text: 'Detalle', level: 2 },
    cabecera(['Producto', 'Cantidad', 'Importe']),
  ];
  for (const linea of factura.lineas) {
    const celdas = [
      linea.descripcion,
      String(linea.cantidad),
      linea.importe === null ? SIN_IMPORTE : dinero(linea.importe, moneda),
    ];
    bloques.push({ kind: 'row', text: celdas.join('\t'), cells: celdas });
  }
  // Sin total no hay caja: un «No disponible» resaltado como si fuera un
  // importe se lee como un total. Va el aviso, igual que en el comprobante.
  if (factura.total === null) {
    bloques.push(noteBlock(MISSING_TOTAL_NOTE, 'warning'));
  } else {
    const filas: PdfTotalRow[] =
      factura.subtotal === null
        ? []
        : [{ label: ROTULOS_DE_FACTURA.subtotal, value: dinero(factura.subtotal, moneda) }];
    if (factura.descuentoDeRed !== null) {
      // `formatMoney` pone el signo menos tipográfico (U+2212), no el guion.
      filas.push({
        label: ROTULOS_DE_FACTURA.descuentoDeRed,
        value: dinero(`-${factura.descuentoDeRed}`, moneda),
      });
    }
    filas.push({ label: ROTULOS_DE_FACTURA.total, value: dinero(factura.total, moneda), emphasis: true });
    bloques.push(totalsBlock(filas));
  }

  // Un renglón sin precio ocupa su columna con una raya —una palabra en medio
  // de los importes desalinea la columna entera— y se explica debajo de la
  // caja, no entre la tabla y la caja: los totales tienen que seguir pegados a
  // la última fila para que el motor los pase de hoja juntos.
  if (factura.lineas.some((linea) => linea.importe === null)) {
    bloques.push({ kind: 'caption', text: MISSING_PRICE_CAPTION });
  }
  if (coaseguro !== null) {
    bloques.push({
      kind: 'caption',
      text: `El coaseguro (${dinero(coaseguro.importe, coaseguro.moneda)}) es lo que queda a su cargo según la liquidación publicada por ${coaseguro.aseguradora}. No se descuenta del total facturado.`,
    });
  }
  return bloques;
}

/** La farmacia como la reconoce la persona: «Farmacia Andina — Sucursal Centro». */
function comercioDe(factura: DocumentoDeFactura): string {
  const { emisor } = factura;
  return emisor.detalle === null ? emisor.nombre : `${emisor.nombre} — ${emisor.detalle}`;
}

/** Un importe en formato boliviano con su moneda visible: «1.234,56 Bs». */
function dinero(importe: string, moneda: string): string {
  return formatMoney(importe, displayCurrency(moneda));
}

function cabecera(celdas: readonly string[]): PdfBlock {
  return { kind: 'row', text: celdas.join('\t'), cells: celdas, header: true };
}

function nombreDeArchivo(fecha: Date, id: string): string {
  const dia = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
  return `factura-${dia}-${id.replace(/-/g, '').slice(-6)}.pdf`;
}
