import { addDecimalStrings } from '../../core/money/decimal-strings';

/**
 * Período de los informes contables (TAREA-20, criterio 15): las pestañas y
 * sus exportaciones muestran exactamente esta ventana. Las dos puntas son
 * opcionales y van como `AAAA-MM-DD`, que es lo que aceptan `from`/`to` de la
 * API (`ListJournalQueryDto`, `GeneralLedgerQueryDto`,
 * `FinancialStatementQueryDto`).
 */
export interface ReportPeriod {
  readonly from?: string;
  readonly to?: string;
}

/** Índice de cada pestaña de informes, en el orden en que las pide el cliente. */
export const LEDGER_TABS = {
  scorecard: 0,
  journal: 1,
  generalLedger: 2,
  cashFlow: 3,
  incomeStatement: 4,
  balanceSheet: 5,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `true` si el texto es una fecha `AAAA-MM-DD` que existe en el calendario. */
export function isIsoDate(text: string): boolean {
  if (!ISO_DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/** `AAAA-MM-DD` → `dd/mm/aaaa`, sin pasar por el huso horario. */
function toDisplayDate(text: string): string {
  const [year, month, day] = text.split('-');
  return `${day}/${month}/${year}`;
}

/** El período dicho con palabras, para el encabezado de la pantalla y del PDF. */
export function describePeriod(period: ReportPeriod): string {
  const { from, to } = period;
  if (from && to) return `Del ${toDisplayDate(from)} al ${toDisplayDate(to)}`;
  if (from) return `Desde el ${toDisplayDate(from)}`;
  if (to) return `Hasta el ${toDisplayDate(to)}`;
  return 'Todo el historial';
}

/** El balance general es una foto a una fecha: sólo importa el fin del período. */
export function describeCutOff(period: ReportPeriod): string {
  return period.to ? `Al ${toDisplayDate(period.to)}` : 'A la fecha';
}

/** Sufijo del nombre de archivo exportado: el período queda en el nombre. */
export function periodFileSuffix(period: ReportPeriod): string {
  const parts = [period.from ?? 'inicio', period.to ?? 'hoy'];
  return period.from || period.to ? `_${parts.join('_')}` : '';
}

/**
 * Lleva un decimal a dos posiciones como mínimo, sin redondear: `'5'` →
 * `'5.00'`, `'12.5'` → `'12.50'`, `'1.2345'` queda igual (la API puede
 * publicar más posiciones en moneda base y no se las recorta en silencio).
 */
export function atLeastTwoDecimals(text: string): string {
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  const result = `${integer}.${fraction.padEnd(2, '0')}`;
  return negative && /[1-9]/.test(result) ? `-${result}` : result;
}

/** Suma exacta de importes como texto (sin `Number`), con dos posiciones. */
export function sumAmounts(amounts: readonly string[]): string {
  return atLeastTwoDecimals(addDecimalStrings(amounts) ?? '0');
}

/** `a − b` exacto, con dos posiciones. */
export function subtractAmounts(a: string, b: string): string {
  const negatedB = b.startsWith('-') ? b.slice(1) : `-${b}`;
  return sumAmounts([a, negatedB]);
}
