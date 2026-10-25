import { validation, type MockReply } from '../mock-router';

/* ============================================================================
    Búsqueda de centros por cobertura de estudios del backend simulado.

    `GET /diagnostic-units/search` con `studyConceptIds`: «qué centros tienen
    todos mis estudios y a los demás qué les falta». Imita al servicio real
    (`DiagnosticUnitsSearchService.searchCoverage`):

    - sólo entran los centros que ofrecen al menos uno de los conceptos pedidos;
    - cada uno trae `complete`, `missingStudyConceptIds` (en el orden pedido) y
      la dirección y coordenadas de su sede principal;
    - `distanceKm` es la distancia en línea recta, con un decimal, y `null` sin
      origen o sin coordenadas de la sede;
    - el orden es: completos primero, después el más cercano (sin distancia al
      final) y, a igual distancia, por nombre.

    Sin `studyConceptIds` la ruta sigue siendo el directorio de siempre: este
    módulo no se llama.
    ========================================================================== */

/** Tope de estudios por petición (`COVERAGE_MAX_STUDIES` de la API). */
const COVERAGE_MAX_STUDIES = 50;
/** Filas por omisión y máximas de la página (`DEFAULT_LIMIT`, `CATALOG_MAX_LIMIT`). */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const EARTH_RADIUS_KM = 6371;

/** El centro tal como lo necesita la búsqueda por cobertura. */
export interface CoverageUnit {
  readonly code: string;
  readonly kind: string;
}

/** Una sede, sólo con lo que la cobertura le lee. */
export interface CoverageSite {
  readonly addressText?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
}

/** De dónde sale cada dato del centro; lo pone el dueño de las unidades. */
export interface CoverageSource<U extends CoverageUnit, Card extends { readonly name: string }> {
  /** La tarjeta del buscador, la misma que devuelve la búsqueda de directorio. */
  readonly card: (unit: U) => Card;
  /** La oferta del centro: de cada estudio, su concepto. */
  readonly studies: (unit: U) => readonly { readonly conceptId: string }[];
  /** Las sedes del centro; la primera es la principal. */
  readonly sites: (unit: U) => readonly CoverageSite[];
}

interface Origin {
  readonly lat: number;
  readonly lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Kilómetros en línea recta (haversine), con un decimal, como la API. */
function straightLineKm(from: Origin, to: Origin): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const chord =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(chord)) * 10) / 10;
}

/** `lat` y `lng` van juntos o no van; devuelve el origen, `null` sin él o la respuesta 400. */
function originOf(query: URLSearchParams): Origin | null | MockReply {
  const rawLat = query.get('lat');
  const rawLng = query.get('lng');
  if (rawLat === null && rawLng === null) return null;
  if (rawLat === null || rawLng === null) {
    return validation('lat y lng van juntos: mande ambos para ordenar por distancia, o ninguno');
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const valid =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return valid ? { lat, lng } : validation('lat y lng deben ser coordenadas WGS84 válidas');
}

function isReply(value: Origin | null | MockReply): value is MockReply {
  return value !== null && 'status' in value;
}

function byCoverage(
  a: { complete: boolean; distanceKm: number | null; name: string },
  b: { complete: boolean; distanceKm: number | null; name: string },
): number {
  if (a.complete !== b.complete) return a.complete ? -1 : 1;
  if (a.distanceKm !== b.distanceKm) {
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  }
  return a.name.localeCompare(b.name, 'es');
}

function offeredConceptIds<U extends CoverageUnit, Card extends { readonly name: string }>(
  unit: U,
  source: CoverageSource<U, Card>,
): ReadonlySet<string> {
  return new Set(source.studies(unit).map((study) => study.conceptId));
}

/**
 * La página de la búsqueda por cobertura sobre los centros publicados.
 *
 * @param query - Los parámetros de la petición; trae `studyConceptIds`.
 * @param units - Los centros publicados, ya filtrados por visibilidad.
 * @param source - De dónde salen tarjeta, oferta y sedes de cada centro.
 */
export function searchByCoverage<U extends CoverageUnit, Card extends { readonly name: string }>(
  query: URLSearchParams,
  units: readonly U[],
  source: CoverageSource<U, Card>,
): unknown {
  const requested = (query.get('studyConceptIds') ?? '').split(',').filter((id) => id !== '');
  if (requested.length === 0 || requested.length > COVERAGE_MAX_STUDIES) {
    return validation(`studyConceptIds lleva entre 1 y ${COVERAGE_MAX_STUDIES} estudios`);
  }
  const origin = originOf(query);
  if (isReply(origin)) return origin;
  const kind = query.get('kind');
  const offset = Math.max(Number(query.get('offset') ?? 0) || 0, 0);
  const limit = Math.min(Number(query.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);

  const items = units
    .filter((unit) => kind === null || unit.kind === kind)
    .flatMap((unit) => {
      const offered = offeredConceptIds(unit, source);
      if (!requested.some((id) => offered.has(id))) return [];
      const missing = requested.filter((id) => !offered.has(id));
      const site = source.sites(unit)[0];
      const latitude = site?.latitude ?? null;
      const longitude = site?.longitude ?? null;
      return [
        {
          ...source.card(unit),
          complete: missing.length === 0,
          missingStudyConceptIds: missing,
          distanceKm:
            origin === null || latitude === null || longitude === null
              ? null
              : straightLineKm(origin, { lat: latitude, lng: longitude }),
          addressText: site?.addressText ?? null,
          latitude,
          longitude,
        },
      ];
    })
    .sort(byCoverage);

  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}
