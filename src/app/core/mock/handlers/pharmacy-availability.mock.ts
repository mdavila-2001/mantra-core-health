/**
 * Lo que la disponibilidad del simulador calcula por sede, además de la
 * cobertura: la distancia al punto consultado y la antigüedad de sus
 * existencias. Los usan `/pharmacy-inventory/availability` y `/pharmacy/sites`
 * de `pharmacy.handlers.ts`.
 */
import { ahora, masMinutos } from '../mock-store';

const EARTH_RADIUS_KM = 6371;

/** Distancia Haversine en km, con un decimal: la misma cuenta que la API. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Hace cuánto informa sus existencias una sede al día. */
const FRESH_STOCK_AGE_MINUTES = 2 * 60;

/** Hace cuánto las informó una sede desactualizada: tres días. */
const STALE_STOCK_AGE_MINUTES = 3 * 24 * 60;

/** Una de cada tantas sedes queda desactualizada. */
const STALE_STOCK_EVERY = 5;

/**
 * La sede con su `stockUpdatedAt` (REQ-19-011): la mayoría al día y una de
 * cada cinco, vieja de tres días, para que la maqueta muestre los dos casos.
 * Se mide desde el reloj del simulador, así el caso no caduca con el
 * calendario. `pharmacyIndex` es la posición de la farmacia en el directorio:
 * la misma sede queda siempre igual, consulte lo que se consulte.
 */
export function withStockUpdatedAt<T extends object>(
  site: T,
  pharmacyIndex: number,
): T & { readonly stockUpdatedAt: string } {
  const ageMinutes =
    pharmacyIndex % STALE_STOCK_EVERY === 1 ? STALE_STOCK_AGE_MINUTES : FRESH_STOCK_AGE_MINUTES;
  return { ...site, stockUpdatedAt: masMinutos(ahora(), -ageMinutes) };
}
