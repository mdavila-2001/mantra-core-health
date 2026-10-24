import type { jsPDF } from 'jspdf';

import {
  buildBlocksPdf,
  noteBlock,
  panelsBlock,
  totalsBlock,
  type PdfBlock,
  type PdfExportOptions,
  type PdfTotalRow,
} from '../../../../shared/utils/pdf-export/pdf-export';
import { ROTULOS_DE_FACTURA, type DocumentoDeFactura } from './order-invoice.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

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
 *   totales. El coaseguro no suma ni resta —es lo que el seguro dejó a cargo
 *   de la persona— y por eso va en su tarjeta, al lado del comprador, y no
 *   dentro de la caja.
 * - Sin bloque de firma: una factura no la firma un médico.
 */

/** El signo menos tipográfico (U+2212), no el guion: la fuente de marca lo tiene. */
const MENOS = '\u2212';

/** La raya que ocupa la columna de importes de un renglón sin precio. */
const SIN_IMPORTE = '—';

/** Lo que dice un importe que no se puede calcular. Corto: va en la caja de totales. */
const NO_DISPONIBLE = 'No disponible';

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
      'Factura de ejemplo: el número, los datos fiscales y el descuento no salen de un sistema de facturación. No reemplaza la factura que emite el comercio.',
      'alert',
      'Sin validez fiscal',
    ),
    panelsBlock([
      {
        title: 'Emisor',
        fields: [
          { label: 'Razón social', value: emisor.razonSocial },
          { label: 'NIT', value: emisor.nit },
          { label: 'Comercio', value: comercioDe(factura) },
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
                {
                  label: ROTULOS_DE_FACTURA.coaseguro,
                  value: withDisplayCurrency(coaseguro.importe, coaseguro.moneda),
                },
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
      linea.importe === null ? SIN_IMPORTE : withDisplayCurrency(linea.importe, moneda),
    ];
    bloques.push({ kind: 'row', text: celdas.join('\t'), cells: celdas });
  }
  // Un renglón sin precio ocupa su columna con una raya —una palabra en medio
  // de los importes desalinea la columna entera— y se explica debajo. Si por
  // eso no hay total, la explicación sube a aviso: es lo que hay que leer.
  const sinPrecio = factura.lineas.some((linea) => linea.importe === null);
  const sinTotal = factura.subtotal === null || factura.total === null;
  if (sinTotal) {
    bloques.push(
      noteBlock(
        sinPrecio
          ? `${SIN_IMPORTE} Precio no publicado por el comercio. Sin ese precio, el total no se puede calcular.`
          : 'Falta algún precio publicado: el total no se puede calcular.',
        'warning',
      ),
    );
  } else if (sinPrecio) {
    bloques.push({
      kind: 'caption',
      text: `${SIN_IMPORTE} Precio no publicado por el comercio: el producto no tiene importe propio en el detalle.`,
    });
  }

  // Sin subtotal no se imprime su fila: dos «No disponible» seguidos no dicen
  // más que uno.
  const filas: PdfTotalRow[] =
    factura.subtotal === null
      ? []
      : [{ label: ROTULOS_DE_FACTURA.subtotal, value: withDisplayCurrency(factura.subtotal, moneda) }];
  if (factura.descuentoDeRed !== null) {
    filas.push({
      label: ROTULOS_DE_FACTURA.descuentoDeRed,
      value: `${MENOS}${withDisplayCurrency(factura.descuentoDeRed, moneda)}`,
    });
  }
  filas.push({
    label: ROTULOS_DE_FACTURA.total,
    value: importeDicho(factura.total, moneda),
    emphasis: true,
  });
  bloques.push(totalsBlock(filas));

  return bloques;
}

/** El comercio como lo reconoce la persona: «Farmacia Andina — Sucursal Centro». */
function comercioDe(factura: DocumentoDeFactura): string {
  const { emisor } = factura;
  return emisor.detalle === null ? emisor.nombre : `${emisor.nombre} — ${emisor.detalle}`;
}

function importeDicho(importe: string | null, moneda: string): string {
  return importe === null ? NO_DISPONIBLE : withDisplayCurrency(importe, moneda);
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
