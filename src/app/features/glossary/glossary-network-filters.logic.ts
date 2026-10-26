import type {
  GlossaryEvidenceTier,
  GlossaryNeighbor,
  GlossaryRelationFrequency,
} from '../../core/data-access/terminology/terminology.types';
import {
  EVIDENCE_TIER_NUMBER,
  EVIDENCE_TIERS,
  hasNoEvidence,
  RELATION_FREQUENCIES,
} from '@shared/components/molecules/relation-evidence/relation-evidence.logic';
import type { ClinicalRoute, RouteColumn, RouteColumnKey } from './glossary-clinical-route';

/* ============================================================================
    Filtros del mapa de relaciones (TAREA-41 F5.2).

    El estado vive en la URL para que sobreviva a una recarga y se pueda
    compartir. Sólo se escribe lo que se aparta del valor por defecto: un mapa
    sin filtros tocados conserva su enlace corto de siempre (`?focus=<id>`).

      evidence=1,2,3      niveles de evidencia visibles (por defecto T1–T3)
      evidence=none       ningún nivel visible
      minFrequency=FREQUENT
      hide=symptoms,related   columnas ocultas
      unrated=exclude     oculta los vecinos que no traen ningún dato de evidencia

    Un vecino sin datos de evidencia queda visible salvo que `unrated=exclude`
    lo excluya de forma explícita. La frecuencia mínima sólo se aplica a los
    vecinos que informan una frecuencia; el nivel, sólo a los que informan uno.
   ============================================================================ */

export const FILTER_PARAM = {
  evidence: 'evidence',
  minFrequency: 'minFrequency',
  hide: 'hide',
  unrated: 'unrated',
} as const;

const NO_TIERS = 'none';
const EXCLUDE_UNRATED = 'exclude';

export interface NetworkFilters {
  readonly tiers: ReadonlySet<GlossaryEvidenceTier>;
  readonly minFrequency: GlossaryRelationFrequency | null;
  readonly hiddenColumns: ReadonlySet<RouteColumnKey>;
  readonly includeUnrated: boolean;
}

export const DEFAULT_TIERS: ReadonlySet<GlossaryEvidenceTier> = new Set<GlossaryEvidenceTier>([
  'NATIONAL_STANDARD',
  'CURATED_REFERENCE',
  'COLLABORATIVE_KNOWLEDGE',
]);

export const DEFAULT_FILTERS: NetworkFilters = {
  tiers: DEFAULT_TIERS,
  minFrequency: null,
  hiddenColumns: new Set(),
  includeUnrated: true,
};

/** Las claves de columna que la URL puede ocultar. */
const COLUMN_KEYS: ReadonlySet<string> = new Set<RouteColumnKey>([
  'criteria',
  'riskFactors',
  'symptoms',
  'anatomy',
  'diseases',
  'tests',
  'requiredTests',
  'referral',
  'complications',
  'treatments',
  'procedures',
  'specialties',
  'equipment',
  'related',
]);

/** Lo mínimo que se lee de los parámetros: el `ParamMap` del router lo cumple. */
export interface ParamReader {
  get(name: string): string | null;
}

function splitList(value: string | null): readonly string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function tiersFrom(value: string | null): ReadonlySet<GlossaryEvidenceTier> {
  if (value === null) return DEFAULT_TIERS;
  if (value === NO_TIERS) return new Set();
  const numbers = new Set(splitList(value));
  const tiers = EVIDENCE_TIERS.filter((tier) => numbers.has(String(EVIDENCE_TIER_NUMBER[tier])));
  // Un valor ilegible no puede dejar el mapa vacío sin que nadie lo pidiera.
  return tiers.length === 0 ? DEFAULT_TIERS : new Set(tiers);
}

function minFrequencyFrom(value: string | null): GlossaryRelationFrequency | null {
  return RELATION_FREQUENCIES.find((frequency) => frequency === value && frequency !== 'EXCLUDED') ?? null;
}

/** El estado de los filtros que dice la URL; lo ilegible vuelve a su valor por defecto. */
export function filtersFromParams(params: ParamReader): NetworkFilters {
  return {
    tiers: tiersFrom(params.get(FILTER_PARAM.evidence)),
    minFrequency: minFrequencyFrom(params.get(FILTER_PARAM.minFrequency)),
    hiddenColumns: new Set(
      splitList(params.get(FILTER_PARAM.hide)).filter((key): key is RouteColumnKey => COLUMN_KEYS.has(key)),
    ),
    includeUnrated: params.get(FILTER_PARAM.unrated) !== EXCLUDE_UNRATED,
  };
}

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

/**
 * Los parámetros que hay que escribir para este estado. Un `null` borra el
 * parámetro (con `queryParamsHandling: 'merge'`): el valor por defecto no se
 * escribe.
 */
export function filtersToParams(filters: NetworkFilters): Record<string, string | null> {
  const tiers = EVIDENCE_TIERS.filter((tier) => filters.tiers.has(tier));
  return {
    [FILTER_PARAM.evidence]: sameSet(filters.tiers, DEFAULT_TIERS)
      ? null
      : tiers.length === 0
        ? NO_TIERS
        : tiers.map((tier) => EVIDENCE_TIER_NUMBER[tier]).join(','),
    [FILTER_PARAM.minFrequency]: filters.minFrequency,
    [FILTER_PARAM.hide]:
      filters.hiddenColumns.size === 0 ? null : [...filters.hiddenColumns].sort().join(','),
    [FILTER_PARAM.unrated]: filters.includeUnrated ? null : EXCLUDE_UNRATED,
  };
}

export function isDefaultFilters(filters: NetworkFilters): boolean {
  return Object.values(filtersToParams(filters)).every((value) => value === null);
}

/** Si un vecino pasa los filtros de evidencia (las columnas se miran aparte). */
export function neighborPasses(neighbor: GlossaryNeighbor, filters: NetworkFilters): boolean {
  if (hasNoEvidence(neighbor)) return filters.includeUnrated;
  if (neighbor.evidenceTier !== undefined && !filters.tiers.has(neighbor.evidenceTier)) return false;
  if (filters.minFrequency !== null && neighbor.frequency !== undefined) {
    return RELATION_FREQUENCIES.indexOf(neighbor.frequency) <= RELATION_FREQUENCIES.indexOf(filters.minFrequency);
  }
  return true;
}

export interface FilteredRoute {
  readonly route: ClinicalRoute;
  /** Vecinos distintos que los filtros esconden, sobre los ya cargados. */
  readonly hiddenCount: number;
  /** Vecinos distintos cargados, antes de filtrar. */
  readonly totalCount: number;
}

function filterColumns(columns: readonly RouteColumn[], filters: NetworkFilters): readonly RouteColumn[] {
  return columns
    .filter((column) => !filters.hiddenColumns.has(column.key))
    .map((column) => ({ ...column, items: column.items.filter((item) => neighborPasses(item, filters)) }))
    // Una columna incompleta queda aunque su muestra no pase: «Ver todos» puede
    // traer vecinos que sí cumplen.
    .filter((column) => column.items.length > 0 || !column.complete);
}

function idsOf(route: ClinicalRoute): Set<string> {
  return new Set(
    [...route.findings, ...route.next, ...route.context].flatMap((column) => column.items.map((i) => i.conceptId)),
  );
}

/** Aplica los filtros a la ruta clínica y cuenta cuántos vecinos quedaron ocultos. */
export function applyNetworkFilters(route: ClinicalRoute, filters: NetworkFilters): FilteredRoute {
  const findings = filterColumns(route.findings, filters);
  const next = filterColumns(route.next, filters);
  const context = filterColumns(route.context, filters);
  const all = idsOf(route);
  const visible = idsOf({ findings, next, context, neighborCount: 0 });
  return {
    route: { findings, next, context, neighborCount: visible.size },
    hiddenCount: all.size - visible.size,
    totalCount: all.size,
  };
}
