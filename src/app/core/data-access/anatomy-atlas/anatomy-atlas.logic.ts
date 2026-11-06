import type {
  AnatomyComposites,
  AnatomyIndexEntry,
  AnatomyLayer,
  AnatomyPart,
  AnatomySex,
} from './anatomy-atlas.types';

/* ============================================================================
    Lógica pura del atlas 3D que comparten el glosario y el selector de la
    región del cuerpo de la orden de estudios: nombres de capa, mallas de una
    estructura, búsqueda en el índice y lado de una pieza. Sin Angular ni
    three.js. Vivía en `features/glossary`; se subió a `core` para que `shared`
    la use sin importar de `features` (el glosario la sigue re-exportando).
    ========================================================================== */

export const LAYER_LABELS: Readonly<Record<AnatomyLayer, string>> = {
  skeleton: 'Huesos',
  muscles: 'Músculos',
  vessels: 'Vasos',
  nervous: 'Sistema nervioso',
  organs: 'Órganos',
};

export const LAYER_ORDER: readonly AnatomyLayer[] = ['skeleton', 'muscles', 'organs', 'vessels', 'nervous'];


/** ¿La pieza se dibuja con este sexo? Las compartidas siempre; las de un cuerpo, sólo en ese. */
export function partVisibleFor(part: AnatomyPart, sex: AnatomySex): boolean {
  return part.sex === 'shared' || part.sex === sex;
}

/**
 * Las estructuras cuyas mallas representan a esta: ella misma y, si es
 * compuesta, las partes suyas que tienen malla (el pulmón, sus lóbulos).
 */
export function structureIdsOf(structureId: string, composites: AnatomyComposites): string[] {
  return [structureId, ...(composites[structureId] ?? [])];
}

/** Las mallas de una estructura (las dos caras de un hueso par; los lóbulos de un pulmón). */
export function meshesOf(
  parts: readonly AnatomyPart[],
  structureId: string,
  sex: AnatomySex,
  composites: AnatomyComposites = {},
): string[] {
  const ids = new Set(structureIdsOf(structureId, composites));
  return parts.filter((p) => ids.has(p.structureId) && partVisibleFor(p, sex)).map((p) => p.meshId);
}


/** El nombre que se muestra: el castellano si existe, el de la ontología si no. */
export function displayName(labelEs: string | null, labelEn: string | null, id: string): string {
  return labelEs ?? labelEn ?? id;
}


/** Quita tildes y mayúsculas, para comparar lo que se escribe con los nombres. */
export function normalizeSearch(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim();
}

/** Los nombres ya normalizados de cada entrada, calculados una vez por índice y no en cada tecla. */
const NORMALIZED_NAMES = new WeakMap<readonly AnatomyIndexEntry[], readonly (readonly [string, string])[]>();

function normalizedNames(entries: readonly AnatomyIndexEntry[]): readonly (readonly [string, string])[] {
  let nombres = NORMALIZED_NAMES.get(entries);
  if (nombres === undefined) {
    nombres = entries.map(([, es, en]) => [normalizeSearch(es ?? ''), normalizeSearch(en)] as const);
    NORMALIZED_NAMES.set(entries, nombres);
  }
  return nombres;
}

/** Las entradas del índice cuyo nombre (castellano o inglés) contiene el texto; primero las que tienen pieza. */
export function searchIndex(entries: readonly AnatomyIndexEntry[], query: string, limit: number): AnatomyIndexEntry[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const nombres = normalizedNames(entries);
  const aciertos = entries.filter(
    ([id], i) => nombres[i][0].includes(q) || nombres[i][1].includes(q) || id.toLowerCase() === q,
  );
  aciertos.sort((a, b) => b[3] - a[3]);
  return aciertos.slice(0, limit);
}


/** El lado de una pieza par, dicho en castellano. */
export function sideLabel(side: AnatomyPart['side']): string | null {
  return side === 'right' ? 'lado derecho' : side === 'left' ? 'lado izquierdo' : null;
}

/* ---- de la pieza del cuerpo a la región del catálogo de imagenología ---- */

/** Lo que el catálogo de la API dice de cada región (`body-regions.data.ts`). */
export interface BodyRegionsData {
  readonly regions: Readonly<Record<string, { readonly name: string; readonly lateral: boolean }>>;
  readonly meshToRegion: Readonly<Record<string, string>>;
  readonly structureToRegion: Readonly<Record<string, string>>;
}

/** El código del concepto de una región en `imaging-body-structure` (`TORAX` → `IMG_REGION_TORAX`). */
export function regionConceptCode(region: string): string {
  return `IMG_REGION_${region}`;
}

/**
 * La región del catálogo a la que pertenece la pieza marcada, o `null`. Primero
 * por la malla tocada; si no está, por la estructura (sólo si es de una única
 * región). Sin cruce no se adivina: el médico elige la región.
 */
export function regionOfPart(part: { readonly meshId: string; readonly structureId: string }, data: BodyRegionsData): string | null {
  return data.meshToRegion[part.meshId] ?? data.structureToRegion[part.structureId] ?? null;
}
