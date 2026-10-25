import type {
  MedicalCenterItem,
  MedicalCenterOffer,
} from '../../../../../core/data-access/medical-centers/medical-centers.types';
import { displayCurrency } from '../../../../../core/money/display-currency';
import { directionsUrl } from '../where-to-buy.route';

/* ============================================================================
    De un centro de la API a la tarjeta que se pinta.

    Todo acá es puro y no ordena nada: la API ya devolvió los centros en su
    orden —igual para todos— y la tarjeta es solo una traducción a palabras.
    ========================================================================== */

/** Lo que dice la tarjeta cuando no hay nombre para un procedimiento. Nunca un uuid. */
const OTRO_PROCEDIMIENTO = 'otro procedimiento';

/** Los textos de los distintivos de transparencia (A-12), hasta que los valide legal. */
export const WORKS_HERE_BADGE = 'Su médico trabaja en este centro';
export const SUGGESTED_BADGE = 'Sugerido por su médico';

/** Los nombres y monedas que la tarjeta necesita traducir. */
export interface CardLabels {
  /** Procedimiento (por concepto) → su nombre. */
  readonly procedures: ReadonlyMap<string, string>;
  /** Moneda (por concepto) → su código (`BOB`). */
  readonly currencies: ReadonlyMap<string, string>;
}

/** Un renglón de la tarjeta: un procedimiento con lo que el centro cobra por él. */
export interface OfferRow {
  readonly procedure: string;
  /** «650,00 Bs», o el número solo si la moneda no tiene etiqueta. */
  readonly price: string;
  /** «Referencia: 380,00 UMA» o «Sin referencia». */
  readonly reference: string;
  /** El aviso de sobreprecio solo existe si la API lo calcula. */
  readonly overMargin: boolean;
}

/** Un centro ya traducido a palabras. */
export interface MedicalCenterCard {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  /** «2,4 km en línea recta», o `null` sin origen o sin coordenadas. */
  readonly distance: string | null;
  readonly complete: boolean;
  /** «Total: 1.550,00 Bs», o `null` cuando la API no lo calcula. */
  readonly total: string | null;
  readonly offers: readonly OfferRow[];
  /** Los procedimientos que el centro no ofrece, por su nombre. */
  readonly missing: readonly string[];
  /** «Cómo llegar» en OpenStreetMap, solo con el destino; `null` sin coordenadas. */
  readonly directions: string | null;
  readonly worksHere: boolean;
  readonly suggested: boolean;
}

/** El mismo centro, en palabras. No agrega ni quita nada según los distintivos. */
export function medicalCenterCard(item: MedicalCenterItem, labels: CardLabels): MedicalCenterCard {
  const currency = currencyOf(item.offers, labels);
  return {
    id: item.practiceSiteId,
    name: item.name,
    address: item.addressText,
    distance: item.distanceKm === null ? null : `${formatKm(item.distanceKm)} en línea recta`,
    complete: item.complete,
    total: item.totalPrice === null ? null : `Total: ${withCurrency(item.totalPrice, currency)}`,
    offers: item.offers.map((offer) => offerRow(offer, labels)),
    missing: item.missingProcedureConceptIds.map(
      (id) => labels.procedures.get(id) ?? OTRO_PROCEDIMIENTO,
    ),
    directions: directionsUrl(item.latitude, item.longitude),
    worksHere: item.practitionerWorksHere === true,
    suggested: item.suggestedByPractitioner === true,
  };
}

/**
 * Los centros que se ven: por defecto solo los completos (P-19-4). Conserva el
 * orden recibido —filtra, nunca ordena— y con `showPartial` devuelve la misma
 * lista.
 */
export function visibleMedicalCenters<T extends { readonly complete: boolean }>(
  items: readonly T[],
  showPartial: boolean,
): readonly T[] {
  return showPartial ? items : items.filter((item) => item.complete);
}

function offerRow(offer: MedicalCenterOffer, labels: CardLabels): OfferRow {
  const reference =
    offer.referencePrice === null || offer.referenceUnit === null
      ? 'Sin referencia'
      : `Referencia: ${formatAmount(offer.referencePrice)} ${offer.referenceUnit}`;
  return {
    procedure: offer.procedureDisplay,
    price: withCurrency(offer.price, labels.currencies.get(offer.currencyConceptId) ?? null),
    reference,
    overMargin: offer.overMargin === true,
  };
}

/** La moneda del total: la de los renglones, si es una sola. Si no, ninguna: no se suma lo que no se puede sumar. */
function currencyOf(offers: readonly MedicalCenterOffer[], labels: CardLabels): string | null {
  const ids = new Set(offers.map((offer) => offer.currencyConceptId));
  if (ids.size !== 1) {
    return null;
  }
  return labels.currencies.get([...ids][0]!) ?? null;
}

/** Sin etiqueta de moneda se muestra el número solo, sin inventar una. */
function withCurrency(amount: number, code: string | null): string {
  return code === null ? formatAmount(amount) : `${formatAmount(amount)} ${displayCurrency(code)}`;
}

/** «1.550,00»: punto de miles y coma decimal, como el resto de la pantalla. */
function formatAmount(value: number): string {
  const [entero = '0', decimales = '00'] = value.toFixed(2).split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimales}`;
}

/** «2,4 km»: un decimal y coma. */
function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}
