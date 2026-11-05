import type { LabService, LabServiceChanges } from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';

/** The same ceiling as the pharmacy catalog: it catches an extra zero. */
export const PRICE_MAX = 1_000_000;

/** What the person typed in a row, still as text. */
export interface PriceEdit {
  readonly price: string;
  readonly discount: string;
}

/** Unsaved edits by service id. */
export type PriceEdits = Readonly<Record<string, PriceEdit>>;

/** A row the API refused to save, with its reason. */
export interface PriceRejection {
  readonly id: string;
  readonly name: string;
  readonly reason: string;
}

export function discountText(service: LabService): string {
  return service.alovidaDiscountPercent === null ? '' : String(service.alovidaDiscountPercent);
}

/** An amount in bolivianos from 0 to {@link PRICE_MAX}, dot or comma, up to two decimals. */
export function parseAmount(text: string): number | 'invalid' {
  const clean = text.trim().replace(/^bs\.?\s*/i, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= PRICE_MAX ? value : 'invalid';
}

/** A percentage from 0 to 100; blank means "no discount" (`null`). */
export function parseDiscount(text: string): number | null | 'invalid' {
  const clean = text.trim().replace(/%$/, '').trim();
  if (clean === '') {
    return null;
  }
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= 100 ? value : 'invalid';
}

/** The API's reason for a rejected service, or a generic one. */
export function reasonOf(error: unknown): string {
  const state = errorToViewState<never>(error);
  if (state.status === 'validation') {
    const messages = state.issues.map((issue) => issue.message).filter((m) => m !== '');
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  return 'message' in state && typeof state.message === 'string' && state.message !== ''
    ? state.message
    : 'No se pudo guardar el precio.';
}

/**
 * True when the typed row says the same as the API. An unpriced service
 * (`price: null`) is unchanged while its price box stays blank: a blank is
 * "no price", not "0.00".
 */
export function isUnchanged(service: LabService, edit: PriceEdit): boolean {
  const price = parseAmount(edit.price);
  const samePrice =
    service.price === null ? edit.price.trim() === '' : price !== 'invalid' && price === Number(service.price);
  return samePrice && parseDiscount(edit.discount) === service.alovidaDiscountPercent;
}

/** The edits with this row's text; typing the original value back drops the row. */
export function withEdit(edits: PriceEdits, service: LabService, edit: PriceEdit): PriceEdits {
  const { [service.id]: _previous, ...rest } = edits;
  return isUnchanged(service, edit) ? rest : { ...rest, [service.id]: edit };
}

/** The edits without the given services (the ones the API already took). */
export function withoutIds(edits: PriceEdits, ids: readonly string[]): PriceEdits {
  return Object.fromEntries(Object.entries(edits).filter(([id]) => !ids.includes(id)));
}

/**
 * What an AloVida user would pay for the row: the API's figure, the preview of
 * what was typed, `null` while the service has no price, or `'invalid'` when
 * the typed text cannot be computed.
 */
export function alovidaPreview(service: LabService, edit: PriceEdit | undefined): string | null | 'invalid' {
  if (edit === undefined) {
    return service.alovidaPrice === null ? null : withDisplayCurrency(service.alovidaPrice);
  }
  const price = parseAmount(edit.price);
  const discount = parseDiscount(edit.discount);
  if (price === 'invalid' || discount === 'invalid') {
    return 'invalid';
  }
  return withDisplayCurrency(((price * (100 - (discount ?? 0))) / 100).toFixed(2));
}

/** What each edited row sends, and what in the typed text is not valid (one sentence per row). */
export function changesOf(
  services: readonly LabService[],
  edits: PriceEdits,
): { changes: { service: LabService; changes: LabServiceChanges }[]; problems: string[] } {
  const changes: { service: LabService; changes: LabServiceChanges }[] = [];
  const problems: string[] = [];
  for (const service of services) {
    const edit = edits[service.id];
    if (edit === undefined) {
      continue;
    }
    const price = parseAmount(edit.price);
    const discount = parseDiscount(edit.discount);
    if (price === 'invalid') {
      problems.push(
        `«${service.name}»: el precio va en bolivianos, de 0 a ${PRICE_MAX.toLocaleString('es-BO')}, con hasta dos decimales.`,
      );
    } else if (discount === 'invalid') {
      problems.push(`«${service.name}»: el descuento es un número de 0 a 100, o vacío si no hay.`);
    } else {
      changes.push({ service, changes: { price: price.toFixed(2), alovidaDiscountPercent: discount } });
    }
  }
  return { changes, problems };
}
