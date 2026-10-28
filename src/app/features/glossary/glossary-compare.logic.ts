import type {
  GlossaryNeighbor,
  GlossaryNeighborhood,
} from '../../core/data-access/terminology/terminology.types';
import { compareNeighbors } from '@shared/components/molecules/relation-evidence/relation-evidence.logic';
import { buildClinicalRoute, type RouteColumnKey } from './glossary-clinical-route';

/* ============================================================================
    Comparador diferencial (TAREA-41 F5.3): «¿por qué A y no B?».

    Se arma del lado del cliente con los dos vecindarios, repartidos por la
    MISMA ruta clínica que usa el mapa: un hallazgo es lo que el mapa pone en
    «Criterios diagnósticos de la norma» o «Síntomas y signos»; un estudio, lo
    que pone en «Estudios» o «Estudios que exige la norma». Así el comparador
    nunca clasifica distinto que el mapa.
   ============================================================================ */

const FINDING_COLUMNS: readonly RouteColumnKey[] = ['criteria', 'symptoms'];
const STUDY_COLUMNS: readonly RouteColumnKey[] = ['requiredTests', 'tests'];

/** Un término que aparece en los dos vecindarios, con la evidencia de cada lado. */
export interface SharedNeighbor {
  readonly conceptId: string;
  readonly display: string;
  readonly inA: GlossaryNeighbor;
  readonly inB: GlossaryNeighbor;
}

export interface SplitNeighbors {
  readonly shared: readonly SharedNeighbor[];
  readonly onlyA: readonly GlossaryNeighbor[];
  readonly onlyB: readonly GlossaryNeighbor[];
}

export interface DifferentialComparison {
  readonly findings: SplitNeighbors;
  readonly studies: SplitNeighbors;
  /** Si algún grupo de A o de B llegó recortado: la comparación puede omitir términos. */
  readonly truncated: boolean;
}

/** Los vecinos de las columnas pedidas, sin repetir y sin los dos términos comparados. */
function neighborsIn(
  neighborhood: GlossaryNeighborhood,
  keys: readonly RouteColumnKey[],
  excluded: ReadonlySet<string>,
): Map<string, GlossaryNeighbor> {
  const route = buildClinicalRoute(neighborhood);
  const columns = [...route.findings, ...route.next, ...route.context].filter((c) => keys.includes(c.key));
  const byId = new Map<string, GlossaryNeighbor>();
  for (const column of columns) {
    for (const item of column.items) {
      if (!excluded.has(item.conceptId) && !byId.has(item.conceptId)) byId.set(item.conceptId, item);
    }
  }
  return byId;
}

/** La fuerza conjunta de un término compartido: manda la más débil de las dos. */
function sharedStrength(item: SharedNeighbor): number {
  return Math.min(item.inA.strength ?? -1, item.inB.strength ?? -1);
}

/** Reparte dos conjuntos de vecinos en compartidos y propios de cada lado. */
export function splitNeighbors(
  a: ReadonlyMap<string, GlossaryNeighbor>,
  b: ReadonlyMap<string, GlossaryNeighbor>,
): SplitNeighbors {
  const shared: SharedNeighbor[] = [];
  const onlyA: GlossaryNeighbor[] = [];
  for (const [conceptId, inA] of a) {
    const inB = b.get(conceptId);
    if (inB === undefined) onlyA.push(inA);
    else shared.push({ conceptId, display: inA.display, inA, inB });
  }
  const onlyB = [...b.values()].filter((item) => !a.has(item.conceptId));
  return {
    shared: shared.sort(
      (x, y) => sharedStrength(y) - sharedStrength(x) || x.display.localeCompare(y.display, 'es'),
    ),
    onlyA: onlyA.sort(compareNeighbors),
    onlyB: onlyB.sort(compareNeighbors),
  };
}

function isTruncated(neighborhood: GlossaryNeighborhood): boolean {
  return neighborhood.groups.some((group) => group.items.length < group.total);
}

/**
 * Compara dos vecindarios: hallazgos compartidos y propios, y los estudios que
 * sólo pide uno de los dos (los que discriminan).
 */
export function compareNeighborhoods(a: GlossaryNeighborhood, b: GlossaryNeighborhood): DifferentialComparison {
  const excluded = new Set([a.focus.conceptId, b.focus.conceptId]);
  return {
    findings: splitNeighbors(
      neighborsIn(a, FINDING_COLUMNS, excluded),
      neighborsIn(b, FINDING_COLUMNS, excluded),
    ),
    studies: splitNeighbors(neighborsIn(a, STUDY_COLUMNS, excluded), neighborsIn(b, STUDY_COLUMNS, excluded)),
    truncated: isTruncated(a) || isTruncated(b),
  };
}
