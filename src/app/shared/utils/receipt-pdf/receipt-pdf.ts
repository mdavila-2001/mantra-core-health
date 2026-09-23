import type { jsPDF } from 'jspdf';

import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../pdf-export/pdf-export';
import type { DocumentoDeComprobante } from './receipt-pdf.types';
import { withDisplayCurrency } from '../../../core/money/display-currency';

/**
 * El comprobante interno de pago en PDF (carril FAR-I5), con el molde de los
 * documentos clínicos de `clinical-pdf`: el mismo motor (`buildBlocksPdf` —
 * un solo maquetador para todo el repo, membrete con el logo incluido), el
 * armador de bloques exportado para probarse **sin jsPDF de por medio**, y el
 * par build/download.
 *
 * Los renglones cobrados van como tabla con su encabezado y sus importes
 * alineados a la derecha: una columna de precios sin alinear obliga a leer
 * cifra por cifra para compararlas, y este papel se lee justamente para eso.
 *
 * Los helpers chicos (fecha, nombre de archivo) se repiten acá a propósito:
 * son privados de `clinical-pdf.ts` y ese módulo es de otro carril —
 * exportarlos sería tocarlo. TODO(equipo): unificarlos en un módulo común
 * cuando se coordine con el dueño de J3.
 */

/** Cómo se imprime una fecha. Local, no ISO: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** La fecha sola, para la bajada del membrete. */
const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** Lo que se imprime cuando el dato no está. Nunca un hueco en blanco. */
const SIN_DATO = 'No registrado';

/** Arma el PDF del comprobante. No lo guarda: devuelve el documento. */
export function buildReceiptPdf(comprobante: DocumentoDeComprobante): jsPDF {
  return buildBlocksPdf(bloquesDeComprobante(comprobante), {
    title: 'Comprobante de pago',
    kind: 'Comprobante interno',
    subtitle: `${textoDe(comprobante.farmacia)} · ${FORMATO_DIA.format(comprobante.pagadoEl)}`,
    // El pie lo dice en todas las páginas, no sólo en la primera: si alguien
    // fotocopia la segunda carilla, tiene que seguir leyéndose que esto no es
    // una factura.
    footerNote: 'Comprobante interno · No válido como factura · AloVida',
  });
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
    { kind: 'note', text: 'Comprobante interno de AloVida. No es una factura.' },
    { kind: 'heading', text: 'Datos del pago', level: 2 },
    campoDeBloque('Farmacia', `${textoDe(comprobante.farmacia)} — ${textoDe(comprobante.sede)}`),
  ];
  if (comprobante.paciente !== null && comprobante.paciente.trim() !== '') {
    bloques.push(campoDeBloque('Paciente', comprobante.paciente));
  }
  bloques.push(
    campoDeBloque('Pagado el', FORMATO_FECHA.format(comprobante.pagadoEl)),
    campoDeBloque('Medio de pago', comprobante.medioDePago),
    { kind: 'heading', text: 'Detalle', level: 2 },
    cabecera(['Concepto', 'Cantidad', 'Importe']),
  );
  for (const linea of comprobante.lineas) {
    bloques.push({
      kind: 'row',
      text: `${linea.descripcion}\tx${linea.cantidad}\t${importeDicho(linea.importe)}`,
      cells: [linea.descripcion, `x${linea.cantidad}`, importeDicho(linea.importe)],
    });
  }
  bloques.push({ kind: 'total', text: totalDicho(comprobante) });
  bloques.push({ kind: 'caption', text: pieDeDocumento() });
  return bloques;
}

/** El total en palabras, o el vacío honesto — jamás un número a medias. */
function totalDicho(comprobante: DocumentoDeComprobante): string {
  if (comprobante.total === null) {
    return 'Total no disponible: falta algún precio publicado.';
  }
  return `Total: ${withDisplayCurrency(comprobante.total, comprobante.moneda)}`;
}

function importeDicho(importe: string | null): string {
  return importe ?? 'Precio no publicado';
}

/** El pie que declara qué es este papel — y qué no es. */
function pieDeDocumento(): string {
  return `Documento generado el ${FORMATO_FECHA.format(new Date())} desde el sistema. Este comprobante es interno y no reemplaza una factura.`;
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
