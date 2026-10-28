import type { HealthcareServiceOffer } from '../../../../core/data-access/healthcare-services/healthcare-services.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

/**
 * Lo que dice la fila de un procedimiento publicado: funciones puras, sin
 * estado, para que la regla se pruebe sin montar la pantalla (CM-06).
 */

/** El texto que ve quien administra cuando el procedimiento no sale en la búsqueda del paciente. */
export const NOT_IN_SEARCH_LABEL = 'No aparece en búsquedas';

/** El texto del aviso de sobreprecio. Se pinta sólo si la API lo calcula (A-1/A-2). */
export const OVER_MARGIN_NOTICE =
  'El precio de esta sede supera el margen sobre la referencia del nomenclador.';

/** Sin referencia en el nomenclador. */
export const NO_REFERENCE_LABEL = 'Sin referencia';

/** Sin precio propio: el procedimiento está publicado pero no sale en búsquedas. */
export const NO_PRICE_LABEL = 'Sin precio propio';

/** Número sin ceros de más: `20`, `12.50`. */
function amountText(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/**
 * Si la fila aparece en las búsquedas del paciente.
 *
 * @returns El rótulo cuando **no** aparece; `null` cuando sí, para no repetir
 *   en cada fila un «Aparece» que es lo esperado.
 */
export function visibilityLabel(offer: Pick<HealthcareServiceOffer, 'visibleInSearch'>): string | null {
  return offer.visibleInSearch ? null : NOT_IN_SEARCH_LABEL;
}

/**
 * La referencia del nomenclador **con su unidad al lado**: `UMA` no es dinero
 * y su factor a bolivianos no está declarado, así que «20» a secas sería un
 * precio falso (A-1/A-2). Se escribe la unidad tal como viaja, sin convertir.
 */
export function referenceText(
  offer: Pick<HealthcareServiceOffer, 'referencePrice' | 'referenceUnit'>,
): string {
  if (offer.referencePrice === null || offer.referenceUnit === null) return NO_REFERENCE_LABEL;
  return `Referencia: ${amountText(offer.referencePrice)} ${offer.referenceUnit}`;
}

/** El precio propio de la sede, con la moneda visible del producto. */
export function ownPriceText(offer: Pick<HealthcareServiceOffer, 'price'>): string {
  return offer.price === null ? NO_PRICE_LABEL : withDisplayCurrency(amountText(offer.price));
}

/**
 * El aviso de sobreprecio, sólo si la API lo calcula.
 *
 * `null` y `false` no avisan nada: el front no calcula el margen ni lo infiere
 * del precio y la referencia.
 */
export function overMarginNotice(offer: Pick<HealthcareServiceOffer, 'overMargin'>): string | null {
  return offer.overMargin === true ? OVER_MARGIN_NOTICE : null;
}
