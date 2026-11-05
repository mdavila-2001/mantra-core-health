import type { jsPDF } from 'jspdf';

import type {
  JournalTransactionDetail,
  LedgerAccount,
} from '../../../core/data-access/accounting/accounting.types';
import {
  buildBlocksPdf,
  campoDeBloque,
  type PdfBlock,
} from '../../../shared/utils/pdf-export/pdf-export';
import { amountBs } from '../summary/windows';

/**
 * El comprobante contable de un movimiento, en PDF: lo que el médico guarda o
 * le pasa a su contador cuando le preguntan «¿y este ingreso de dónde salió?».
 *
 * Usa el maquetador único del repo (`buildBlocksPdf`), igual que el recibo de
 * farmacia y la factura simulada. Los bloques se arman aparte
 * (`bloquesDelComprobante`) para que el spec fije qué dice el papel sin pasar
 * por jsPDF.
 */

const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });
const FORMATO_FECHA_Y_HORA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** Cómo se lee el estado del comprobante. */
export const ESTADO_DEL_COMPROBANTE: Readonly<
  Record<NonNullable<JournalTransactionDetail['status']>, string>
> = {
  DRAFT: 'Borrador',
  AUTO_CLASSIFIED: 'En revisión',
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  POSTED: 'Registrado',
  REVERSED: 'Anulado',
};

export function buildComprobantePdf(
  comprobante: JournalTransactionDetail,
  cuentas: readonly LedgerAccount[],
): jsPDF {
  return buildBlocksPdf(bloquesDelComprobante(comprobante, cuentas), {
    title: `Comprobante ${comprobante.transactionNumber ?? ''}`.trim(),
    kind: 'Comprobante contable',
    subtitle: FORMATO_DIA.format(comprobante.transactionDate),
    footerNote: 'Comprobante contable · AloVida',
  });
}

export function downloadComprobantePdf(
  comprobante: JournalTransactionDetail,
  cuentas: readonly LedgerAccount[],
): void {
  const numero = (comprobante.transactionNumber ?? comprobante.id.slice(-6)).replace(
    /[^\w-]/gu,
    '',
  );
  buildComprobantePdf(comprobante, cuentas).save(`comprobante-${numero}.pdf`);
}

/**
 * Lo que dice el comprobante, en orden de lectura.
 *
 * Debe y haber: el contrato marca el lado de cada línea con un concepto de
 * terminología (`directionConceptId`) que el front no traduce. Se toma la
 * convención contable de que el asiento abre por el debe: el lado de la línea
 * 1 es «Debe» y el otro, «Haber». Un asiento de una sola línea no existe —no
 * cuadraría—, así que la convención siempre tiene con qué comparar.
 */
export function bloquesDelComprobante(
  comprobante: JournalTransactionDetail,
  cuentas: readonly LedgerAccount[],
): readonly PdfBlock[] {
  const porId = new Map(cuentas.map((c) => [c.id, c] as const));
  const lineas = [...comprobante.lines].sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
  const ladoDelDebe = lineas[0]?.directionConceptId;

  const bloques: PdfBlock[] = [
    { kind: 'heading', text: 'Datos del comprobante', level: 2 },
    campoDeBloque('Número', comprobante.transactionNumber ?? 'Sin número'),
    campoDeBloque('Fecha', FORMATO_DIA.format(comprobante.transactionDate)),
    campoDeBloque('Concepto', comprobante.description?.trim() || 'Sin concepto'),
    campoDeBloque(
      'Estado',
      comprobante.status === undefined ? 'Registrado' : ESTADO_DEL_COMPROBANTE[comprobante.status],
    ),
    { kind: 'heading', text: 'Detalle', level: 2 },
    fila(['Cuenta', 'Debe', 'Haber'], true),
  ];

  for (const linea of lineas) {
    const cuenta = porId.get(linea.accountId);
    const nombre = cuenta === undefined ? 'Cuenta sin nombre' : `${cuenta.code} · ${cuenta.name}`;
    const importe = amountBs(linea.amountBase);
    const esDebe = linea.directionConceptId === ladoDelDebe;
    bloques.push(fila([nombre, esDebe ? importe : '', esDebe ? '' : importe]));
  }

  bloques.push({ kind: 'total', text: `Total: ${amountBs(comprobante.totalAmount ?? '0')}` });
  bloques.push({
    kind: 'caption',
    text: `Descargado el ${FORMATO_FECHA_Y_HORA.format(new Date())} desde AloVida.`,
  });
  return bloques;
}

function fila(celdas: readonly string[], cabecera = false): PdfBlock {
  return { kind: 'row', text: celdas.join('\t'), cells: celdas, header: cabecera };
}
