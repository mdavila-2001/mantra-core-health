import { InjectionToken } from '@angular/core';
import type { jsPDF } from 'jspdf';

import type { Installment, PaymentFrequency } from '../../../core/data-access/quotations/quotations.types';
import { displayCurrency } from '../../../core/money/display-currency';
import {
  buildBlocksPdf,
  fieldsBlock,
  formatDate,
  formatMoney,
  noteBlock,
  totalsBlock,
  type PdfBlock,
  type PdfExportOptions,
} from '../pdf-export/pdf-export';

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
  readonly downPaymentAmount: number;
  readonly paymentFrequency: PaymentFrequency;
  /** ISO `YYYY-MM-DD`, o cadena vacía si todavía no se eligió. */
  readonly attentionDate: string;
  /** ISO `YYYY-MM-DD`, o cadena vacía si todavía no se eligió. */
  readonly validUntil: string;
  readonly installments: readonly Installment[];
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

const NOMBRE_DE_FRECUENCIA: Readonly<Record<PaymentFrequency, string>> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

/** La frecuencia dentro de una frase: «las cuotas son quincenales». */
const FRECUENCIA_EN_FRASE: Readonly<Record<PaymentFrequency, string>> = {
  WEEKLY: 'semanales',
  BIWEEKLY: 'quincenales',
  MONTHLY: 'mensuales',
};

/** Lo que el papel aclara siempre: qué es y qué no es. */
const NO_ES_FACTURA = 'Esta cotización es un presupuesto: no es una factura ni un comprobante de pago.';

/**
 * La moneda de los importes. El dato no la trae —el formulario tampoco la
 * muestra—, y la del sistema es el boliviano (`display-currency.ts`).
 */
const MONEDA = displayCurrency(null);

/** Un importe en formato boliviano con su moneda: «1.234,56 Bs». */
function dinero(monto: number): string {
  return formatMoney(monto, MONEDA);
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`; `vacio` si no hay fecha, o el texto tal cual si no se pudo interpretar. */
function formatoFecha(iso: string, vacio = 'No definida'): string {
  if (iso === '') {
    return vacio;
  }
  const fecha = new Date(`${iso}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? iso : formatDate(fecha);
}

/** Arma el PDF de la cotización actual. No lo guarda: devuelve el documento. */
export function buildQuotationPdf(data: QuotationPdfData): jsPDF {
  return buildBlocksPdf(quotationBlocks(data), quotationPdfOptions(data));
}

/**
 * La portada, el membrete y el pie de la cotización. Exportadas para que el
 * spec las fije sin pasar por el motor.
 *
 * - **Quién y qué** —el paciente y el servicio— van en la bajada, bajo el
 *   título: identifican el papel de un vistazo y el cuerpo no los repite.
 * - La **vigencia** va en los metadatos de la portada, al lado del título: es
 *   lo primero que se mira de una cotización, antes que el detalle.
 * - Sin `issuedAt`: la cotización sale del formulario **antes de guardarse**,
 *   y no hay fecha de emisión que decir. El motor rotula la de generación.
 * - Sin firma: es una cotización, no un papel que firma un médico.
 */
export function quotationPdfOptions(data: QuotationPdfData): PdfExportOptions {
  return {
    title: 'Cotización de servicios',
    kind: 'Cotización',
    subtitle: `${data.patientName} · ${data.serviceName}`,
    meta: [{ label: 'Válida hasta', value: formatoFecha(data.validUntil, 'Sin fecha de vencimiento') }],
    footerNote: 'Cotización · No es una factura ni un comprobante de pago · AloVida',
    firma: null,
  };
}

/**
 * Los bloques de la cotización, en orden de lectura. Exportada para que el spec
 * fije QUÉ dice el papel sin pasar por jsPDF.
 *
 * La caja de totales **cierra**: anticipo más saldo en cuotas es el total del
 * plan, y el saldo es la suma de las cuotas impresas en la tabla —no el precio
 * menos el anticipo—, para que la caja no pueda contradecir las filas. El precio
 * ofrecido va en la rejilla, como dato de la oferta: en la caja se leería como
 * un sumando más.
 */
export function quotationBlocks(data: QuotationPdfData): readonly PdfBlock[] {
  const cuotas = data.installments.length;
  const saldo = data.installments.reduce((suma, cuota) => suma + cuota.amount, 0);
  // Anticipo más cuotas: lo que la persona termina pagando.
  const total = data.downPaymentAmount + saldo;

  // Quién y qué se cotiza van en la bajada de la portada; el cuerpo no los
  // repite y arranca por cuándo y cómo se paga.
  const bloques: PdfBlock[] = [
    seccion('Plan de pagos'),
    fieldsBlock(
      [
        { label: 'Fecha de atención', value: formatoFecha(data.attentionDate) },
        { label: 'Precio ofrecido', value: dinero(data.offeredPrice) },
        // Sin cuotas, «Frecuencia: Mensual · Cuotas: 0» describiría un plan que
        // no existe: se dice la forma de pago.
        ...(cuotas === 0
          ? [{ label: 'Forma de pago', value: data.downPaymentAmount > 0 ? 'Pago único' : 'Sin definir' }]
          : [
              { label: 'Frecuencia', value: NOMBRE_DE_FRECUENCIA[data.paymentFrequency] },
              { label: 'Cuotas', value: `${cuotas}` },
            ]),
      ],
      cuotas === 0 ? 3 : 4,
    ),
  ];

  if (cuotas > 0) {
    bloques.push(fila(['Cuota', 'Vencimiento', 'Monto'], true));
    for (const cuota of data.installments) {
      bloques.push(fila([String(cuota.installmentNumber), formatoFecha(cuota.dueDate), dinero(cuota.amount)]));
    }
    bloques.push(
      totalsBlock([
        { label: 'Anticipo', value: dinero(data.downPaymentAmount) },
        { label: 'Saldo en cuotas', value: dinero(saldo) },
        { label: 'Total del plan', value: dinero(total), emphasis: true },
      ]),
    );
  } else {
    bloques.push(totalsBlock([{ label: 'Total a pagar', value: dinero(total), emphasis: true }]));
  }

  bloques.push(noteBlock(`${formaDePago(data)} ${NO_ES_FACTURA}`, 'brand', 'Condiciones'));
  return bloques;
}

/** Cómo se paga lo cotizado, dicho en una frase. */
function formaDePago(data: QuotationPdfData): string {
  const cuotas = data.installments.length;
  if (cuotas === 0) {
    return data.downPaymentAmount > 0
      ? 'Se paga completo el día de la atención.'
      : 'Sin plan de pagos armado todavía.';
  }
  const enCuotas = cuotas === 1 ? 'una cuota' : `${cuotas} cuotas ${FRECUENCIA_EN_FRASE[data.paymentFrequency]}`;
  return `El saldo se paga en ${enCuotas}, sin interés, en las fechas de vencimiento indicadas.`;
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
