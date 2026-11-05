import type {
  LabService,
  LabServiceChanges,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';

/** Same cap as the pharmacy catalog: catches an extra zero. */
export const PRICE_MAX = 1_000_000;

/** What the person typed in a row, still as text. */
export interface PriceEdit {
  readonly price: string;
  readonly discount: string;
}

/** A service that could not be saved, with its reason. */
export interface PriceRejection {
  readonly name: string;
  readonly reason: string;
}

/** The typed price of a row before any edit; empty while it has no price. */
export function priceText(service: LabService): string {
  return service.hasPrice ? service.price : '';
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

/** A percentage from 0 to 100; empty means «no discount» (`null`). */
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

/** Whether an edit brings the row back to what the API has. */
export function isUnchanged(service: LabService, edit: PriceEdit): boolean {
  const samePrice = service.hasPrice
    ? parseAmount(edit.price) === Number(service.price)
    : edit.price.trim() === '';
  return samePrice && parseDiscount(edit.discount) === (service.alovidaDiscountPercent ?? null);
}

/**
 * Panels first, each followed by its components, so a hemogram reads with its
 * counts under it. A row stays when it, its panel or one of its parts matches.
 */
export function withComponents(list: readonly LabService[], term: string): readonly LabService[] {
  const needle = term.trim().toLocaleLowerCase('es');
  const hit = (s: LabService) =>
    needle === '' ||
    [s.name, s.code, s.categoryName].some((text) =>
      (text ?? '').toLocaleLowerCase('es').includes(needle),
    );
  const ids = new Set(list.map((s) => s.id));
  const byName = (a: LabService, b: LabService) => a.name.localeCompare(b.name, 'es');
  const partsOf = (id: string) => list.filter((s) => s.parentId === id).sort(byName);
  const rows: LabService[] = [];
  for (const top of list.filter((s) => s.parentId === null || !ids.has(s.parentId)).sort(byName)) {
    const parts = partsOf(top.id);
    if (hit(top)) {
      rows.push(top, ...parts);
    } else if (parts.some(hit)) {
      rows.push(top, ...parts.filter(hit));
    }
  }
  return rows;
}

/** The PATCH body of each edited row, or the problems that block saving. */
export function buildChanges(
  services: readonly LabService[],
  edits: Readonly<Record<string, PriceEdit>>,
): { changes: { service: LabService; body: LabServiceChanges }[]; problems: string[] } {
  const changes: { service: LabService; body: LabServiceChanges }[] = [];
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
      changes.push({
        service,
        body: { price: price.toFixed(2), alovidaDiscountPercent: discount },
      });
    }
  }
  return { changes, problems };
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
