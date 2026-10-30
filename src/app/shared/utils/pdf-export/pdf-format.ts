/* ============================================================================
    Cómo escriben los papeles montos, fechas y horas.

    Un solo formato para todos los documentos: un comprobante con «133.50 Bs»
    al lado de una factura con «8.842,00 Bs» y una nota de venta con «Bs 1 200,00»
    se lee como tres sistemas distintos. Se escribe a mano —sin `Intl`— para que
    el papel salga igual en cualquier navegador y en una prueba, sin depender
    del ICU del entorno ni de sus espacios finos (U+202F), que las fuentes del
    papel no siempre traen.
    ========================================================================== */

/** El signo menos tipográfico (U+2212): el guion corto se lee como un guion. */
export const MINUS = '−';

/**
 * Un monto a la boliviana: miles con punto, decimales con coma, dos decimales
 * y la moneda detrás —`1.234,56 Bs`—; los negativos con el signo menos.
 *
 * @param amount - El monto, en número o en el texto decimal que trae la API
 *   (`'1234.5'`). Un texto que no es un número se devuelve tal cual: el papel
 *   no inventa un cero.
 * @param currency - La moneda detrás del número; `null` para la celda de una
 *   tabla cuya cabecera ya la dice.
 */
export function formatMoney(amount: number | string, currency: string | null = 'Bs'): string {
  const value = typeof amount === 'number' ? amount : Number(amount.trim());
  if (typeof amount === 'string' && (amount.trim() === '' || !Number.isFinite(value))) return amount;
  if (!Number.isFinite(value)) return String(amount);
  const cents = Math.round(Math.abs(value) * 100);
  const integer = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = String(cents % 100).padStart(2, '0');
  const sign = value < 0 && cents !== 0 ? MINUS : '';
  return `${sign}${integer},${decimals}${currency === null ? '' : ` ${currency}`}`;
}

const two = (value: number): string => String(value).padStart(2, '0');

/** `24/10/2026`. */
export function formatDate(date: Date): string {
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `18:30`, en 24 horas: sin «a. m.» ni «p. m.», que se parten entre renglones. */
export function formatTime(date: Date): string {
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** `24/10/2026, 18:30`: el formato de la fecha de emisión de la portada. */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${formatTime(date)}`;
}
