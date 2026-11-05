import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { LabService, LabServiceChanges } from '../../../core/data-access/lab-portal/lab-portal.types';

/** The same ceiling as the pharmacy catalog: it catches an extra zero. */
export const PRICE_MAX = 1_000_000;

export function discountText(service: LabService): string {
  return service.alovidaDiscountPercent === null ? '' : String(service.alovidaDiscountPercent);
}

/** Un monto en bolivianos de 0 a {@link PRICE_MAX}, con punto o coma y hasta dos decimales. */
export function parseAmount(text: string): number | 'invalid' {
  const clean = text.trim().replace(/^bs\.?\s*/i, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= PRICE_MAX ? value : 'invalid';
}

/** Un porcentaje de 0 a 100; vacío es «sin descuento» (`null`). */
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

/** El motivo de la API para un servicio rechazado, o uno genérico. */
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

/** Lo que la persona escribió en una fila, todavía como texto. */
export interface PriceEdit {
  readonly price: string;
  readonly discount: string;
}

/** What each edited row sends, and what in the typed text is not valid (one sentence per row). */
export function changesOf(
  services: readonly LabService[],
  edits: Readonly<Record<string, PriceEdit>>,
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
