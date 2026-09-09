import { InjectionToken } from '@angular/core';
import type { jsPDF } from 'jspdf';

import type { Installment, InterestCalculationMethod } from '../../../core/data-access/quotations/quotations.types';
import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../pdf-export/pdf-export';

/* ============================================================================
    El PDF de una cotización (FT-24).

    Mismo patrón que `clinical-pdf.ts`: se arma la lista de bloques a mano, en
    vez de renderizar la pantalla y leerla del DOM (`exportElementToPdf`),
    porque el maquetador ya existe y es **uno solo** para todo el repo
    (`buildBlocksPdf`) — dos caminos para el mismo PDF serían dos documentos
    con márgenes distintos para el mismo sistema.

    Vive en `shared/utils/` y no en `features/quotations/` a propósito: es la
    misma regla que separa `pdf-export.ts` de cualquier pantalla — un
    generador de documentos no es una vista, y ponerlo bajo `features/`
    obligaría a exportarlo del feature para que su propia prueba lo importe.
    ========================================================================== */

/**
 * Los datos de una cotización, listos para imprimir.
 *
 * Vive acá y no en `quotations.types.ts` porque es forma de **presentación**
 * —nombres ya resueltos, no identificadores— y no del contrato con el
 * backend: `patientName` y `serviceName` son lo que el formulario ya tiene en
 * pantalla, no lo que viaja en el `POST /quotations`.
 */
export interface QuotationPdfData {
  readonly patientName: string;
  readonly serviceName: string;
  readonly offeredPrice: number;
  readonly interestRatePercent: number;
  readonly interestCalculationMethod: InterestCalculationMethod;
  readonly installmentCount: number;
  /** ISO `YYYY-MM-DD`, o cadena vacía si todavía no se eligió. */
  readonly attentionDate: string;
  /** ISO `YYYY-MM-DD`, o cadena vacía si todavía no se eligió. */
  readonly validUntil: string;
  readonly installments: readonly Installment[];
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** Cuándo salió el papel. El mismo pie que llevan los documentos clínicos. */
const FORMATO_EMISION = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

function parrafo(text: string): PdfBlock {
  return { kind: 'paragraph', text };
}

/** Una sección: versalitas espaciadas sobre un filete, como el resto del repo. */
function seccion(text: string): PdfBlock {
  return { kind: 'heading', text, level: 2 };
}

/**
 * Una fila de la tabla de cuotas.
 *
 * `text` mantiene la línea corrida —es lo que se lee si el documento se
 * recorre como texto— y `cells` son las columnas que el maquetador alinea. Los
 * importes caen en la última columna y se alinean a la derecha solos: una
 * columna de plata sin alinear obliga a comparar cifra por cifra.
 */
function fila(celdas: readonly string[], header = false): PdfBlock {
  return { kind: 'row', text: celdas.join('   '), cells: celdas, header };
}

/** «Cuota fija (FLAT)» o «Francés», para que el papel no repita el código. */
function nombreDelMetodo(metodo: InterestCalculationMethod): string {
  return metodo === 'FLAT' ? 'cuota fija (FLAT)' : 'francés (amortización)';
}

/** `YYYY-MM-DD` en prosa, o el texto tal cual si no se pudo interpretar. */
function formatoFecha(iso: string): string {
  if (iso === '') {
    return 'No definida';
  }
  const fecha = new Date(`${iso}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? iso : FORMATO_FECHA.format(fecha);
}

/** Arma el PDF de la cotización actual. No lo guarda: devuelve el documento. */
export function buildQuotationPdf(data: QuotationPdfData): jsPDF {
  const bloques: PdfBlock[] = [seccion('Datos de la cotización')];

  bloques.push(campoDeBloque('Paciente', data.patientName));
  bloques.push(campoDeBloque('Servicio', data.serviceName));
  bloques.push(campoDeBloque('Precio ofrecido', data.offeredPrice.toFixed(2)));
  bloques.push(campoDeBloque('Fecha de atención', formatoFecha(data.attentionDate)));
  bloques.push(campoDeBloque('Válida hasta', formatoFecha(data.validUntil)));

  bloques.push(seccion('Plan de pagos'));
  bloques.push(campoDeBloque('Cuotas', `${data.installmentCount}`));
  bloques.push(campoDeBloque('Tasa de interés', `${data.interestRatePercent}%`));
  bloques.push(campoDeBloque('Método de cálculo', nombreDelMetodo(data.interestCalculationMethod)));

  bloques.push(seccion('Cuotas'));
  if (data.installments.length === 0) {
    bloques.push(parrafo('Sin plan de pagos simulado todavía.'));
  } else {
    bloques.push(fila(['Cuota', 'Vencimiento', 'Capital', 'Interés', 'Total'], true));
    for (const cuota of data.installments) {
      bloques.push(
        fila([
          String(cuota.installmentNumber),
          formatoFecha(cuota.dueDate),
          cuota.principalAmount.toFixed(2),
          cuota.interestAmount.toFixed(2),
          cuota.totalAmount.toFixed(2),
        ]),
      );
    }
    // La suma de las cuotas, que es lo que la persona termina pagando. Se
    // calcula de las mismas filas que están impresas arriba: un total que
    // saliera de otra cuenta podría no coincidir con lo que se ve.
    const total = data.installments.reduce((suma, cuota) => suma + cuota.totalAmount, 0);
    bloques.push({ kind: 'total', text: `Total del plan: ${total.toFixed(2)}` });
  }

  bloques.push({
    kind: 'caption',
    text: `Documento generado el ${FORMATO_EMISION.format(new Date())} desde el sistema.`,
  });

  return buildBlocksPdf(bloques, {
    title: 'Cotización de servicios',
    kind: 'Cotización',
    subtitle: `${data.patientName} · ${data.serviceName}`,
  });
}

/**
 * Descarga la cotización.
 *
 * El nombre lleva el apellido del paciente y la fecha de emisión — mismo
 * criterio que `nombreLegible` de `clinical-pdf.ts`: este archivo lo abre una
 * persona en su carpeta de descargas, no un sistema.
 */
export function downloadQuotationPdf(data: QuotationPdfData): void {
  buildQuotationPdf(data).save(nombreDeArchivo(data.patientName));
}

function nombreDeArchivo(nombrePaciente: string): string {
  const hoy = new Date();
  const dia = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-');
  const palabras = nombrePaciente.trim().split(/\s+/).filter(Boolean);
  const apellido = (palabras.at(-1) ?? 'paciente')
    .normalize('NFD')
    // Quita los diacríticos que `NFD` separó del carácter base (á → a + ´).
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `cotizacion-${apellido === '' ? 'paciente' : apellido}-${dia}.pdf`;
}

/**
 * La descarga como dependencia inyectable.
 *
 * El formulario no llama a `downloadQuotationPdf` directo sino a lo que provea
 * este token, que por defecto es esa función. Es una costura para las pruebas:
 * el sistema de pruebas de Angular no admite `vi.mock` de un import relativo,
 * y probar que el formulario exporta los datos correctos no debería abrir un
 * PDF real ni depender del orden de carga de `jspdf`.
 */
export const QUOTATION_PDF_DOWNLOADER = new InjectionToken<(data: QuotationPdfData) => void>(
  'QUOTATION_PDF_DOWNLOADER',
  { providedIn: 'root', factory: () => downloadQuotationPdf },
);
