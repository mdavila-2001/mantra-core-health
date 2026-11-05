import type { DiagnosticStudy } from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { withDisplayCurrency } from '../../../core/money/display-currency';

/**
 * Price schedule codes that are NOT a price the centre published.
 *
 * The corpus of centres is real but carries no tariffs, so those figures are
 * either a demo amount or a public reference. Calling them "public price"
 * would pass them off as verified data.
 */
const MOCK_SCHEDULE = 'MAQUETA';
/** Reference tariff of the Bolivian national health laboratory (INLASA). */
const INLASA_SCHEDULE = 'REFERENCIA_INLASA_2026';
/** Chilean FONASA 2026 tariff converted to Bs, used where Bolivia publishes none. */
const FONASA_SCHEDULE = 'REFERENCIA_FONASA_2026_BOB';

/** Whether the study price is one the centre itself published. */
export function isPublishedPrice(study: DiagnosticStudy): boolean {
  const schedule = study.prices[0]?.scheduleCode;
  return schedule !== undefined && ![MOCK_SCHEDULE, INLASA_SCHEDULE, FONASA_SCHEDULE].includes(schedule);
}

/** The honest label of a study price: only the one the centre published is "public". */
export function priceLabel(study: DiagnosticStudy): string {
  const schedule = study.prices[0]?.scheduleCode;
  if (schedule === undefined) return 'Precio';
  if (schedule === MOCK_SCHEDULE) return 'Precio de demostración';
  if (schedule === INLASA_SCHEDULE) return 'Referencia INLASA 2026';
  if (schedule === FONASA_SCHEDULE) return 'Referencia FONASA 2026 (Chile), en Bs';
  return 'Precio público';
}

/**
 * The amount with the es-BO decimal comma, or `null` when there is no tariff.
 *
 * The API sends `amount` as an exact decimal string (`40.00`); only the
 * separator changes, so no float rounding sneaks back in.
 */
export function priceText(study: DiagnosticStudy): string | null {
  const price = study.prices[0];
  if (price === undefined) return null;
  return withDisplayCurrency(price.amount.replace('.', ','), price.currency.display);
}

/** Where a non-published price comes from, without repeating «Referencia». */
export function priceSource(study: DiagnosticStudy): string {
  return priceLabel(study).replace(/^Referencia /u, '');
}

/** Minutes in the unit people think in: hours past 90, days past 48 h. */
export function durationText(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} días`;
}

/** Lowercase without accents, so «Análisis» matches «analisis». */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase().trim();
}

/**
 * Whether the description adds something to the name.
 *
 * Some catalogues fill it with the name alone or the name plus "realizado en
 * <centre>": that repeats the card title in grey. Anything else is shown.
 */
export function addsToName(study: DiagnosticStudy): boolean {
  const description = normalize(study.description ?? '').replace(/\.$/u, '');
  const name = normalize(study.name);
  if (description === '' || description === name) return false;
  // Only "<name> realizado en <centre>" with nothing after it is filler.
  const rest = description.startsWith(`${name} realizad`) ? description.slice(name.length) : null;
  return rest === null || !/^ realizad[oa] en [^.]*$/u.test(rest);
}

/** Whether an equipment status counts as working. One rule for every view. */
export function isOperational(code: string): boolean {
  return code === 'OPERATIONAL' || code === 'ACTIVE';
}

/**
 * `dd/MM/yyyy` from the local date parts, never `toISOString`: in Bolivia
 * (UTC−4) that would draw the 1st as the day before.
 */
export function formatDate(value: Date | null): string | null {
  if (value === null) return null;
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${value.getFullYear()}`;
}
