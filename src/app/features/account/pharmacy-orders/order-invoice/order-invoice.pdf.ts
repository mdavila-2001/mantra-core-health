import type { jsPDF } from 'jspdf';

import {
  buildBlocksPdf,
  campoDeBloque,
  type PdfBlock,
} from '../../../../shared/utils/pdf-export/pdf-export';
import { ROTULOS_DE_FACTURA, type DocumentoDeFactura } from './order-invoice.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

/**
 * La factura de ejemplo en PDF (T-E4). Usa el mismo maquetador que el
 * comprobante interno (`buildBlocksPdf`) pero **no** su módulo: el
 * comprobante dice por diseño que no es una factura, y esa semántica no se
 * toca. Este papel dice lo contrario —es una factura— y, mientras no haya
 * facturación real, que es de ejemplo y sin validez fiscal.
 */

const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** Arma el PDF. No lo guarda: devuelve el documento. */
export function buildInvoicePdf(factura: DocumentoDeFactura): jsPDF {
  return buildBlocksPdf(bloquesDeFactura(factura), {
    title: 'Factura',
    kind: 'Factura de ejemplo',
    reference: `N.º ${factura.numero}`,
    subtitle: `${factura.emisor.nombre} · ${FORMATO_DIA.format(factura.emitidaEl)}`,
    footerNote: 'Factura de ejemplo · Sin validez fiscal · AloVida',
  });
}

/** Descarga la factura: `factura-2026-09-15-a1b2c3.pdf`. */
export function downloadInvoicePdf(factura: DocumentoDeFactura): void {
  buildInvoicePdf(factura).save(nombreDeArchivo(factura.emitidaEl, factura.id));
}

/** Las líneas del PDF en orden de lectura. Exportada para probarla sin jsPDF. */
export function bloquesDeFactura(factura: DocumentoDeFactura): readonly PdfBlock[] {
  const { emisor, comprador, moneda } = factura;
  const bloques: PdfBlock[] = [
    {
      kind: 'note',
      text: 'Factura de ejemplo: el número, los datos fiscales y el descuento no salen de un sistema de facturación. Sin validez fiscal.',
    },
    { kind: 'heading', text: 'Emisor', level: 2 },
    campoDeBloque('Razón social', emisor.razonSocial),
    campoDeBloque('NIT', emisor.nit),
    campoDeBloque(
      'Comercio',
      emisor.detalle === null ? emisor.nombre : `${emisor.nombre} — ${emisor.detalle}`,
    ),
    { kind: 'heading', text: 'Comprador', level: 2 },
    campoDeBloque('Nombre', comprador.nombre),
    campoDeBloque('Documento', comprador.documento),
    { kind: 'heading', text: 'Factura', level: 2 },
    campoDeBloque(ROTULOS_DE_FACTURA.numero, factura.numero),
    campoDeBloque(ROTULOS_DE_FACTURA.emitidaEl, FORMATO_DIA.format(factura.emitidaEl)),
    campoDeBloque(ROTULOS_DE_FACTURA.estado, factura.estado),
    { kind: 'heading', text: 'Detalle', level: 2 },
    cabecera(['Concepto', 'Cantidad', 'Importe']),
  ];
  for (const linea of factura.lineas) {
    const importe = linea.importe === null ? 'Precio no publicado' : withDisplayCurrency(linea.importe, moneda);
    bloques.push({
      kind: 'row',
      text: `${linea.descripcion}\tx${linea.cantidad}\t${importe}`,
      cells: [linea.descripcion, `x${linea.cantidad}`, importe],
    });
  }
  bloques.push(campoDeBloque(ROTULOS_DE_FACTURA.subtotal, importeDicho(factura.subtotal, moneda)));
  if (factura.descuentoDeRed !== null) {
    // Guion ASCII: la fuente del PDF no garantiza el signo menos tipográfico.
    bloques.push(
      campoDeBloque(ROTULOS_DE_FACTURA.descuentoDeRed, `-${withDisplayCurrency(factura.descuentoDeRed, moneda)}`),
    );
  }
  if (factura.coaseguro !== null) {
    bloques.push(
      campoDeBloque(
        `${ROTULOS_DE_FACTURA.coaseguro} (${factura.coaseguro.aseguradora})`,
        withDisplayCurrency(factura.coaseguro.importe, factura.coaseguro.moneda),
      ),
    );
  }
  bloques.push({
    kind: 'total',
    text: `${ROTULOS_DE_FACTURA.total}: ${importeDicho(factura.total, moneda)}`,
  });
  bloques.push({
    kind: 'caption',
    text: 'Documento de ejemplo generado desde AloVida. No reemplaza la factura que emite el comercio.',
  });
  return bloques;
}

function importeDicho(importe: string | null, moneda: string): string {
  return importe === null
    ? 'No disponible: falta algún precio publicado.'
    : withDisplayCurrency(importe, moneda);
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
