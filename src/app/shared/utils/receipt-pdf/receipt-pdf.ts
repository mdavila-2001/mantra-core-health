import type { jsPDF } from 'jspdf';

import { buildBlocksPdf, type PdfBlock } from '../pdf-export/pdf-export';
import type { DocumentoDeComprobante } from './receipt-pdf.types';

/**
 * El comprobante interno de pago en PDF (carril FAR-I5), con el molde de los
 * documentos clínicos de `clinical-pdf`: el mismo motor (`buildBlocksPdf` —
 * un solo maquetador para todo el repo), el armador de bloques exportado
 * para probarse **sin jsPDF de por medio**, y el par build/download.
 *
 * Los helpers chicos (párrafo, fecha, nombre de archivo) se repiten acá a
 * propósito: son privados de `clinical-pdf.ts` y ese módulo es de otro
 * carril — exportarlos sería tocarlo. TODO(equipo): unificarlos en un módulo
 * común cuando se coordine con el dueño de J3.
 */

/** Cómo se imprime una fecha. Local, no ISO: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** Lo que se imprime cuando el dato no está. Nunca un hueco en blanco. */
const SIN_DATO = 'No registrado';

/** Arma el PDF del comprobante. No lo guarda: devuelve el documento. */
export function buildReceiptPdf(comprobante: DocumentoDeComprobante): jsPDF {
  return buildBlocksPdf(bloquesDeComprobante(comprobante), { title: 'Comprobante de pago' });
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
export function bloquesDeComprobante(
  comprobante: DocumentoDeComprobante,
): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    parrafo('Comprobante interno de AloVida. No es una factura.'),
    parrafo(`Farmacia: ${textoDe(comprobante.farmacia)} — ${textoDe(comprobante.sede)}`),
  ];
  if (comprobante.paciente !== null && comprobante.paciente.trim() !== '') {
    bloques.push(parrafo(`Paciente: ${comprobante.paciente}`));
  }
  bloques.push(
    parrafo(`Pagado el: ${FORMATO_FECHA.format(comprobante.pagadoEl)}`),
    parrafo(`Medio: ${comprobante.medioDePago}`),
    encabezado('Detalle', 2),
  );
  for (const linea of comprobante.lineas) {
    bloques.push(fila(`${linea.descripcion}\tx${linea.cantidad}\t${importeDicho(linea.importe)}`));
  }
  bloques.push(parrafo(totalDicho(comprobante)));
  bloques.push(parrafo(pieDeDocumento()));
  return bloques;
}

/** El total en palabras, o el vacío honesto — jamás un número a medias. */
function totalDicho(comprobante: DocumentoDeComprobante): string {
  if (comprobante.total === null) {
    return 'Total no disponible: falta algún precio publicado.';
  }
  return `Total: ${comprobante.total} ${comprobante.moneda ?? ''}`.trim();
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

function parrafo(text: string): PdfBlock {
  return { kind: 'paragraph', text };
}

function encabezado(text: string, level: number): PdfBlock {
  return { kind: 'heading', text, level };
}

function fila(text: string): PdfBlock {
  return { kind: 'row', text };
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
