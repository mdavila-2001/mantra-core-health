/* ============================================================================
    La nota de venta (PDF) de un pago a cuenta del plan.

    Es un comprobante **interno**: no pasa por el SIAT, no tiene CUF ni QR y
    no sirve para crédito fiscal. Lo dice en la portada (clase y título), en
    el aviso con que abre el cuerpo, en la marca de agua de cada hoja y en el
    pie. La factura del servicio se emite una sola vez, por el total, cuando el
    plan queda saldado.

    Mismo maquetador (`buildBlocksPdf`) que la representación gráfica de la
    factura simulada, con la marca de agua del motor (`watermark`) y el mismo
    emisor en el pie.
    ========================================================================== */

import type { jsPDF } from 'jspdf';

import type {
  SimulatedCharge,
  SimulatedIssuer,
  SimulatedPlanInstance,
  SimulatedSalesNote,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import {
  buildBlocksPdf,
  fieldsBlock,
  formatMoney,
  noteBlock,
  panelsBlock,
  totalsBlock,
  type PdfBlock,
  type PdfExportOptions,
} from '../../shared/utils/pdf-export/pdf-export';
import { cents, fromCents } from './on-screen-charges';
import { amountLiteral } from './amount-in-words';
import { pdfIssuerOf } from './graphic-representation';

export const SALE_NOTE_LEGEND = 'NOTA DE VENTA — NO VÁLIDA COMO FACTURA';

/** `NV-000042` → 42: el correlativo ordena las notas, la hora no (dos pagos pueden caer en el mismo instante). */
function sequential(nota: SimulatedSalesNote): number {
  return Number(nota.number.replace(/^NV-/, '')) || 0;
}

/** Lo pagado en el plan hasta esta nota, inclusive: el saldo que figura en el papel. */
export function paidUntil(cobro: SimulatedCharge, nota: SimulatedSalesNote): string {
  const notas = cobro.plan?.instances.flatMap((i) => i.salesNotes) ?? [];
  const hasta = sequential(nota);
  return fromCents(notas.filter((n) => sequential(n) <= hasta).reduce((suma, n) => suma + cents(n.amount), 0));
}

/** La marca de agua de cada hoja (el motor la pasa a versalitas). */
export const SALES_NOTE_WATERMARK = 'Simulada · No válida como factura';

/** La línea legal del pie de cada hoja. */
export const SALES_NOTE_FOOTER = 'Nota de venta SIMULADA · No válida como factura · Sin validez fiscal';

/** La cabecera del detalle del pago. */
const CABECERA = ['Servicio', 'Ítem', 'Medio de pago', 'A cobrar', 'Recibido'];

/** Cómo se nombra el emisor cuando la nota no lo trae: no se inventa uno. */
const EMISOR_DESCONOCIDO = 'Consultorio (SIMULADO)';

/**
 * Los bloques del PDF en orden de lectura. Exportada para probarla sin jsPDF.
 *
 * El número de la nota y su fecha van en la portada (ver
 * {@link salesNotePdfOptions}) y no se repiten acá.
 */
export function saleNoteBlocks(
  cobro: SimulatedCharge,
  instancia: SimulatedPlanInstance,
  nota: SimulatedSalesNote,
  emisor: SimulatedIssuer | null,
): PdfBlock[] {
  const plan = cobro.plan!;
  const pagado = paidUntil(cobro, nota);
  const saldo = fromCents(Math.max(cents(plan.expectedTotal) - cents(pagado), 0));
  const fila = [
    plan.serviceName,
    instancia.label,
    nota.methodLabel,
    formatMoney(instancia.expectedAmount, null),
    formatMoney(nota.amount, null),
  ];
  return [
    noteBlock(
      `${SALE_NOTE_LEGEND}. Es SIMULADA: no pasa por el SIN ni sirve para crédito fiscal.`,
      'alert',
      'Comprobante interno',
    ),
    panelsBlock([
      {
        title: 'Emisor',
        fields: [
          { label: 'Razón social', value: emisor?.legalName ?? EMISOR_DESCONOCIDO },
          ...(emisor === null
            ? []
            : [
                { label: 'NIT (SIMULADO)', value: emisor.nit },
                { label: 'Dirección', value: emisor.address },
              ]),
        ],
      },
      {
        title: 'Cliente',
        fields: [
          { label: 'Nombre', value: cobro.suggestedBuyer.name || cobro.patientName },
          { label: 'CI', value: cobro.suggestedBuyer.documentNumber },
        ],
      },
    ]),
    // Sin título de sección: la cabecera de la tabla ya dice qué es. La moneda
    // no va en cada celda, como en la factura: la dicen el monto recibido y la
    // letra chica del final («A cobrar Bs» partía la cabecera y el ítem).
    { kind: 'row', header: true, text: CABECERA.join('\t'), cells: CABECERA },
    {
      kind: 'row',
      text: fila.join('\t'),
      cells: fila,
    },
    totalsBlock([{ label: 'Monto recibido', value: formatMoney(nota.amount), emphasis: true }]),
    // El literal con su rótulo, como en la factura.
    fieldsBlock([{ label: 'Son', value: amountLiteral(nota.amount).replace(/^Son:\s*/, '') }], 2),
    // El estado del plan sin título de sección: los rótulos ya lo dicen, y el
    // título solo empujaba la nota a una segunda hoja.
    fieldsBlock(
      [
        { label: 'Monto del servicio', value: formatMoney(plan.expectedTotal) },
        { label: 'Pagado a la fecha', value: formatMoney(pagado) },
        { label: 'Saldo del plan', value: formatMoney(saldo) },
      ],
      3,
    ),
    // Una aclaración de cómo funciona el plan, no una advertencia: letra chica.
    {
      kind: 'caption',
      text: 'Importes en bolivianos (Bs). Mientras el plan tenga saldo, cada pago lleva nota de venta; la factura se emite por el total del servicio cuando el plan queda saldado.',
    },
  ];
}

/**
 * La portada, la marca de agua y el pie.
 *
 * - **Emisor**: la razón social del consultorio que cobra, con su NIT simulado;
 *   si la nota no trae emisor, el mismo rótulo genérico que el cuerpo.
 * - **`issuedAt`**: la fecha en que se registró el pago, la de verdad.
 * - **Sin firma** (`firma: null`): es un comprobante, no lo firma un médico.
 *
 * Exportada para que el spec fije la portada sin abrir el PDF.
 */
export function salesNotePdfOptions(nota: SimulatedSalesNote, emisor: SimulatedIssuer | null): PdfExportOptions {
  const issuedAt = new Date(nota.issuedAt);
  return {
    title: 'Nota de venta (simulada)',
    // «No válida como factura» lo dicen el aviso, la marca de agua y el pie:
    // repetido también acá y en el título del aviso, eran cinco veces.
    subtitle: 'Pago a cuenta del plan',
    kind: 'Nota de venta simulada',
    reference: `N.º ${nota.number}`,
    ...(Number.isNaN(issuedAt.getTime()) ? {} : { issuedAt }),
    issuer: emisor === null ? { name: EMISOR_DESCONOCIDO } : pdfIssuerOf(emisor),
    footerNote: SALES_NOTE_FOOTER,
    watermark: SALES_NOTE_WATERMARK,
    firma: null,
  };
}

/** El PDF armado, sin guardar. */
export function buildSalesNotePdf(
  cobro: SimulatedCharge,
  instancia: SimulatedPlanInstance,
  nota: SimulatedSalesNote,
  emisor: SimulatedIssuer | null,
): jsPDF {
  return buildBlocksPdf(saleNoteBlocks(cobro, instancia, nota, emisor), salesNotePdfOptions(nota, emisor));
}

export function saleNoteName(nota: SimulatedSalesNote): string {
  return `nota-de-venta-${nota.number}-SIMULADA.pdf`;
}

export function saleDownloadNote(
  cobro: SimulatedCharge,
  instancia: SimulatedPlanInstance,
  nota: SimulatedSalesNote,
  emisor: SimulatedIssuer | null,
): void {
  buildSalesNotePdf(cobro, instancia, nota, emisor).save(saleNoteName(nota));
}
