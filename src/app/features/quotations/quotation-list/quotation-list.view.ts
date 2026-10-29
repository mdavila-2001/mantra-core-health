import { formatMoney } from '../../../shared/utils/pdf-export/pdf-format';

/** Lo que se muestra en una celda sin dato. */
export const NO_DATA = 'Sin dato';

/**
 * El precio ofrecido con su moneda (H15).
 *
 * `offeredPrice` llega como cadena decimal aunque el tipo diga `number`
 * (`quotation-response.dto.ts`), así que se aceptan las dos. Bolivianos como
 * «300,00 Bs»; otra moneda, el número y su código; sin moneda resuelta, el
 * número solo: la moneda no se inventa.
 */
export function quotationPrice(amount: number | string, currencyCode: string | undefined): string {
  if (currencyCode === undefined || currencyCode === '') return formatMoney(amount, null);
  return formatMoney(amount, currencyCode === 'BOB' ? 'Bs' : currencyCode);
}

/**
 * Una fecha `YYYY-MM-DD` como `dd/MM/yyyy`, sin pasar por `Date`: una fecha
 * sin hora leída como UTC se corre un día al oeste de Greenwich.
 */
export function quotationDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match === null ? NO_DATA : `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Cómo se nombra el estado de una cotización, por **código** de catálogo.
 *
 * La cotización nace con el concepto genérico `ACTIVE`, que no tiene
 * designación en castellano: terminología devuelve «Active». Como en
 * `booking-status.ts`, la frase es decisión de la interfaz y el código la ancla.
 */
const STATUS_BY_CODE: Readonly<Record<string, string>> = Object.freeze({
  ACTIVE: 'Vigente',
  INACTIVE: 'Inactiva',
  REVOKED: 'Anulada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
});

/**
 * El estado legible (H15): por código; un código que esta versión no conoce,
 * con la etiqueta de terminología; sin ninguno de los dos, «Sin dato». Nunca el
 * uuid ni una celda vacía.
 */
export function quotationStatusLabel(
  code: string | undefined,
  display: string | undefined,
): string {
  const suffix = code?.includes(':') ? code.slice(code.lastIndexOf(':') + 1) : code;
  const known = suffix === undefined ? undefined : STATUS_BY_CODE[suffix.toUpperCase()];
  if (known !== undefined) return known;
  return display !== undefined && display.trim() !== '' ? display : NO_DATA;
}
