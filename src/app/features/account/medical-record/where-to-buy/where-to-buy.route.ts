/**
 * El recorrido que cubre la receta cuando ninguna sede la tiene entera.
 *
 * ## El criterio, el mismo que se dice en pantalla
 *
 * 1. **La menor cantidad de paradas.** Si una sede tiene todo, el recorrido es
 *    esa sede sola; si no, el menor grupo de sedes que juntas lo tienen todo.
 * 2. **Entre grupos del mismo tamaño, el más cercano:** la menor suma de
 *    distancias en línea recta desde el origen. Sin origen, o con alguna sede
 *    sin distancia, gana el que está primero en el orden del backend.
 * 3. **Las paradas se visitan de la más cercana a la más lejana.** No es ruteo
 *    por calles: no hay un servicio de mapas que lo calcule, y la distancia es
 *    en línea recta.
 *
 * La búsqueda es exacta y no voraz: elegir primero la sede que más cubre puede
 * dar tres paradas donde alcanzaban dos. Con el tope de sedes de la consulta
 * (veinte) y las paradas acotadas a la cantidad de renglones, recorrer las
 * combinaciones es barato.
 *
 * También viven acá las piezas geográficas que comparten las tres pestañas: el
 * punto de referencia desde el que se mide y cómo se escribe una distancia.
 */

import type { GeoPoint } from '../../../../core/data-access/pharmacy/pharmacy.types';

/** Una sede, reducida a lo que el recorrido necesita saber de ella. */
export interface RouteCandidate {
  /** Los renglones que esta sede puede confirmar. */
  readonly covers: ReadonlySet<string>;
  /** Distancia en línea recta desde el origen; `null` sin origen o sin coordenadas. */
  readonly distanceKm: number | null;
}

/**
 * - `single`: una sede tiene todo.
 * - `multi`: hacen falta varias; `stops` viene en orden de visita.
 * - `partial`: ni juntando todas las sedes se cubre la receta; `stops` cubre
 *   lo que se puede y `uncovered` dice qué no tiene ninguna.
 * - `none`: ninguna sede confirma nada de lo pedido.
 */
export type CoverageRoute<T extends RouteCandidate> =
  | { readonly kind: 'single'; readonly stops: readonly [T] }
  | { readonly kind: 'multi'; readonly stops: readonly T[] }
  | { readonly kind: 'partial'; readonly stops: readonly T[]; readonly uncovered: readonly string[] }
  | { readonly kind: 'none'; readonly uncovered: readonly string[] };

/**
 * El recorrido de menos paradas que cubre `needed`. **Pura**: no reordena ni
 * modifica `candidates`, cuyo orden es el desempate final.
 */
export function coverageRoute<T extends RouteCandidate>(
  candidates: readonly T[],
  needed: readonly string[],
): CoverageRoute<T> {
  const reachable = new Set(candidates.flatMap((candidate) => [...candidate.covers]));
  const coverable = needed.filter((item) => reachable.has(item));
  const uncovered = needed.filter((item) => !reachable.has(item));
  if (coverable.length === 0) {
    return { kind: 'none', uncovered };
  }

  // Una sede que no aporta nada de lo pedido nunca entra en el recorrido.
  const useful = candidates.filter((candidate) =>
    coverable.some((item) => candidate.covers.has(item)),
  );
  const stops = orderOfVisit(smallestCover(useful, coverable));

  if (uncovered.length > 0) {
    return { kind: 'partial', stops, uncovered };
  }
  return stops.length === 1
    ? { kind: 'single', stops: [stops[0]!] }
    : { kind: 'multi', stops };
}

/**
 * El enlace «Cómo llegar»: la ruta por calles en OpenStreetMap, con el destino
 * cargado y el origen vacío. El origen lo pone la persona allá, si quiere: la
 * aplicación no le pasa su ubicación a ningún tercero. `null` sin coordenadas
 * utilizables — el `0,0` es el valor por defecto de una carga incompleta, no
 * una dirección.
 */
export function directionsUrl(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat === 0 && lng === 0) {
    return null;
  }
  return `https://www.openstreetmap.org/directions?route=%3B${lat}%2C${lng}`;
}

/** El primer grupo de menor tamaño que lo cubre todo, con la menor distancia total. */
function smallestCover<T extends RouteCandidate>(useful: readonly T[], needed: readonly string[]): T[] {
  for (let size = 1; size <= Math.min(needed.length, useful.length); size++) {
    let best: { readonly group: T[]; readonly total: number | null } | null = null;
    for (const group of combinations(useful, size)) {
      if (!needed.every((item) => group.some((candidate) => candidate.covers.has(item)))) {
        continue;
      }
      const total = totalDistance(group);
      // Las combinaciones salen en el orden del backend: ante empate, o sin
      // distancias que comparar, se queda la primera.
      if (best === null || (total !== null && (best.total === null || total < best.total))) {
        best = { group, total };
      }
    }
    if (best !== null) {
      return best.group;
    }
  }
  // Inalcanzable: `needed` sólo trae renglones que alguna sede cubre, así que
  // el grupo de todas las útiles siempre lo cubre.
  return [...useful];
}

/** La suma de distancias, o `null` si alguna sede no la tiene. */
function totalDistance(group: readonly RouteCandidate[]): number | null {
  let total = 0;
  for (const candidate of group) {
    if (candidate.distanceKm === null || !Number.isFinite(candidate.distanceKm)) {
      return null;
    }
    total += candidate.distanceKm;
  }
  return total;
}

/** De la más cercana a la más lejana; sin distancia, al final y en el orden recibido. */
function orderOfVisit<T extends RouteCandidate>(stops: readonly T[]): T[] {
  return stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => {
      const da = a.stop.distanceKm;
      const db = b.stop.distanceKm;
      if (da === null || db === null) {
        return da === db ? a.index - b.index : da === null ? 1 : -1;
      }
      return da - db || a.index - b.index;
    })
    .map(({ stop }) => stop);
}

/** Las combinaciones de `size` elementos, en orden lexicográfico de índices. */
function* combinations<T>(items: readonly T[], size: number, start = 0): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let index = start; index <= items.length - size; index++) {
    for (const rest of combinations(items, size - 1, index + 1)) {
      yield [items[index]!, ...rest];
    }
  }
}

/** Un lugar con nombre desde donde medir distancias. */
export interface ReferencePoint {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

export function geoPointOf(point: ReferencePoint): GeoPoint {
  return { lat: point.lat, lng: point.lng };
}

/** «1,2 km»: un decimal y coma, como el resto de la pantalla. */
export function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}
