import type { jsPDF } from 'jspdf';

import {
  buildBlocksPdf,
  formatDateTime,
  formatMoney,
  noteBlock,
  panelsBlock,
  totalsBlock,
  type PdfBlock,
  type PdfExportOptions,
  type PdfPanel,
} from '../pdf-export/pdf-export';
import type { DocumentoDeComprobante } from './receipt-pdf.types';
import { displayCurrency } from '../../../core/money/display-currency';

/**
 * El comprobante interno de pago en PDF (carril FAR-I5), con el molde de los
 * documentos clínicos de `clinical-pdf`: el mismo motor (`buildBlocksPdf` —
 * un solo maquetador para todo el repo, membrete con el logo incluido), el
 * armador de bloques exportado para probarse **sin jsPDF de por medio**, y el
 * par build/download.
 *
 * ## Cómo se compone
 *
 * - **Primero, qué no es**: un aviso con título dice que no es una factura y
 *   quién la emite. El pie lo repite en todas las hojas; nada más lo repite.
 * - **Sin folio en la portada**: el pedido no trae un número corto, y el
 *   código de retiro no lo es —es la contraseña del mostrador, que el
 *   adaptador ni siquiera le muestra al personal—. El uuid no se imprime.
 * - **Las partes, lado a lado**: la farmacia, el paciente y el pago en
 *   tarjetas. La fecha del pago va en la tarjeta del pago y no en la portada:
 *   el comprobante no tiene fecha de emisión propia —se arma cuando se pide— y
 *   la portada rotula honestamente la de generación.
 * - **Lo cobrado, en tabla**, con la cantidad y el importe alineados a la
 *   derecha: una columna de precios sin alinear obliga a leer cifra por cifra
 *   para compararlas, y este papel se lee justamente para eso. Un renglón sin
 *   precio ocupa su columna con una raya y una nota lo explica: una palabra en
 *   medio de los importes desalinea la columna entera.
 * - **El total congelado al pagar**, en la caja de totales. Sin él, un aviso
 *   —el mismo, con el mismo texto, que la factura del pedido— y ninguna caja.
 * - Montos en formato boliviano (`1.234,56 Bs`) y fechas `dd/mm/aaaa, hh:mm`,
 *   con los formateadores del motor: los mismos en todos los papeles.
 *
 * Es un papel de AloVida y no de un médico: sale **sin bloque de firma**.
 *
 * Los helpers chicos (fecha, nombre de archivo) se repiten acá: los de
 * `clinical-pdf.ts` son privados de ese módulo.
 */

/** Lo que se imprime cuando el dato no está. Nunca un hueco en blanco. */
const SIN_DATO = 'No registrado';

/** La raya que ocupa la columna de importes de un renglón sin precio. */
const SIN_IMPORTE = '—';

/** El aviso de qué es este papel —y qué no es—. */
const NOT_INVOICE_TITLE = 'No es una factura';
const NOT_INVOICE_TEXT =
  'Comprobante interno de AloVida que acredita el pago del pedido. La factura la emite la farmacia.';

/**
 * Lo que dice el papel cuando falta un precio. Son los mismos textos que la
 * factura del pedido (`order-invoice.pdf.ts`): un mismo vacío se dice igual en
 * los dos papeles.
 */
const MISSING_PRICE_CAPTION = `${SIN_IMPORTE} Precio no publicado por la farmacia: el producto no tiene importe propio en el detalle.`;
const MISSING_TOTAL_NOTE = 'Total no disponible: falta algún precio publicado.';

/** Arma el PDF del comprobante. No lo guarda: devuelve el documento. */
export function buildReceiptPdf(comprobante: DocumentoDeComprobante): jsPDF {
  return buildBlocksPdf(bloquesDeComprobante(comprobante), receiptPdfOptions(comprobante));
}

/**
 * Las opciones del documento: membrete, portada y pie. Exportadas para que el
 * spec fije la portada sin pasar por el motor.
 */
export function receiptPdfOptions(comprobante: DocumentoDeComprobante): PdfExportOptions {
  return {
    title: 'Comprobante de pago',
    kind: 'Comprobante interno',
    subtitle: `Pedido de farmacia · ${textoDe(comprobante.farmacia)}`,
    // El pie lo dice en todas las páginas, no sólo en la primera: si alguien
    // fotocopia la segunda carilla, tiene que seguir leyéndose que esto no es
    // una factura.
    footerNote: 'Comprobante interno · No válido como factura · AloVida',
    // Sin `issuedAt`: el comprobante no tiene fecha de emisión propia, y la
    // del pago no lo es. La portada dice la de generación y lo rotula así.
    firma: null,
  };
}

/**
 * Descarga el comprobante. El nombre lleva la fecha del pago y el final del
 * identificador del pedido: dos comprobantes del mismo día no se pisan en la
 * carpeta de descargas.
 */
export function downloadReceiptPdf(comprobante: DocumentoDeComprobante): void {
  buildReceiptPdf(comprobante).save(
    nombreDeArchivo('comprobante', comprobante.pagadoEl, comprobante.id),
  );
}

/**
 * Las líneas del comprobante, en orden de lectura. Exportada para que el
 * spec fije QUÉ dice el papel sin pasar por el motor de render, que ya tiene
 * sus propias pruebas.
 */
export function bloquesDeComprobante(comprobante: DocumentoDeComprobante): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    noteBlock(NOT_INVOICE_TEXT, 'brand', NOT_INVOICE_TITLE),
    panelsBlock(partesDe(comprobante)),
    { kind: 'heading', text: 'Detalle del pago', level: 2 },
    cabecera(['Producto', 'Cantidad', 'Importe']),
  ];
  for (const linea of comprobante.lineas) {
    const celdas = [
      linea.descripcion,
      String(linea.cantidad),
      linea.importe === null ? SIN_IMPORTE : formatMoney(linea.importe, displayCurrency(comprobante.moneda)),
    ];
    bloques.push({ kind: 'row', text: celdas.join('\t'), cells: celdas });
  }
  if (comprobante.total === null) {
    bloques.push(noteBlock(MISSING_TOTAL_NOTE, 'warning'));
  } else {
    bloques.push(
      totalsBlock([
        {
          label: 'Total pagado',
          value: formatMoney(comprobante.total, displayCurrency(comprobante.moneda)),
          emphasis: true,
        },
      ]),
    );
  }
  // La nota de la raya va **después** de la caja: los totales tienen que seguir
  // pegados a la última fila para que el motor los pase de hoja juntos.
  if (comprobante.lineas.some((linea) => linea.importe === null)) {
    bloques.push({ kind: 'caption', text: MISSING_PRICE_CAPTION });
  }
  return bloques;
}

/** Las tarjetas de las partes: la farmacia, el paciente —si se sabe— y el pago. */
function partesDe(comprobante: DocumentoDeComprobante): readonly PdfPanel[] {
  const partes: PdfPanel[] = [
    {
      title: 'Farmacia',
      fields: [
        { label: 'Nombre', value: textoDe(comprobante.farmacia) },
        { label: 'Sede', value: textoDe(comprobante.sede) },
      ],
    },
  ];
  if (comprobante.paciente !== null && comprobante.paciente.trim() !== '') {
    partes.push({ title: 'Paciente', fields: [{ label: 'Nombre', value: comprobante.paciente }] });
  }
  partes.push({
    title: 'Pago',
    fields: [
      { label: 'Pagado el', value: formatDateTime(comprobante.pagadoEl) },
      // «Pagado en mostrador», «Pago demo — sin valor real»: dice por dónde
      // entró el pago, no con qué se pagó.
      { label: 'Canal de pago', value: textoDe(comprobante.medioDePago) },
    ],
  });
  return partes;
}

/** El texto, o la marca de ausencia: nunca una línea que termina en dos puntos. */
function textoDe(valor: string): string {
  return valor.trim() === '' ? SIN_DATO : valor;
}

/** La fila de encabezado de la tabla de renglones cobrados. */
function cabecera(celdas: readonly string[]): PdfBlock {
  return { kind: 'row', text: celdas.join('\t'), cells: celdas, header: true };
}

/** `comprobante-2026-08-21-a1b2c3.pdf` — fecha para ordenar, sufijo para no pisarse. */
function nombreDeArchivo(prefijo: string, fecha: Date, id: string): string {
  const dia = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
  return `${prefijo}-${dia}-${id.replace(/-/g, '').slice(-6)}.pdf`;
}
