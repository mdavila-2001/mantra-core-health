import type {
  AnatomyComposites,
  AnatomyIndexEntry,
  AnatomyLayer,
  AnatomyPart,
  AnatomyReference,
  AnatomySex,
  AnatomyStructure,
} from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';

/* ============================================================================
    Lógica pura del atlas 3D: qué mallas resaltar, cómo agrupar relaciones y
    cómo buscar. Sin Angular ni three.js, para probarla sin navegador.
    ========================================================================== */

export const LAYER_LABELS: Readonly<Record<AnatomyLayer, string>> = {
  skeleton: 'Huesos',
  muscles: 'Músculos',
  vessels: 'Vasos',
  nervous: 'Sistema nervioso',
  organs: 'Órganos',
};

export const LAYER_ORDER: readonly AnatomyLayer[] = ['skeleton', 'muscles', 'organs', 'vessels', 'nervous'];

/** Las capas encendidas al entrar: los músculos taparían los órganos. */
export const DEFAULT_LAYERS: readonly AnatomyLayer[] = ['skeleton', 'organs'];

/** `UBERON:0000981` → `https://purl.obolibrary.org/obo/UBERON_0000981`. */
export function ontologyUrl(id: string): string | null {
  const uberon = /^UBERON:(\d+)$/.exec(id);
  if (uberon) return `https://purl.obolibrary.org/obo/UBERON_${uberon[1]}`;
  const fma = /^FMA:(\d+)$/.exec(id);
  if (fma) return `https://purl.org/sig/ont/fma/fma${fma[1]}`;
  return null;
}

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

/** Las estructuras que tienen algo que resaltar: las de malla propia y las compuestas. */
export function structuresWithMesh(parts: readonly AnatomyPart[], composites: AnatomyComposites): Set<string> {
  return new Set([...parts.map((p) => p.structureId), ...Object.keys(composites)]);
}

/**
 * Las estructuras que se están dibujando: con malla en una capa encendida y
 * visible para el sexo elegido. Una compuesta cuenta si se dibuja alguna parte suya.
 */
export function drawnStructures(
  parts: readonly AnatomyPart[],
  layers: ReadonlySet<AnatomyLayer>,
  sex: AnatomySex,
  composites: AnatomyComposites,
): Set<string> {
  const propias = new Set(parts.filter((p) => layers.has(p.layer) && partVisibleFor(p, sex)).map((p) => p.structureId));
  const dibujadas = new Set(propias);
  for (const [id, partes] of Object.entries(composites)) {
    if (partes.some((parte) => propias.has(parte))) dibujadas.add(id);
  }
  return dibujadas;
}

/** Las estructuras relacionadas: lo que la ficha declara, en los dos sentidos. */
export function relatedStructureIds(structure: AnatomyStructure): Set<string> {
  const ids = new Set<string>();
  for (const r of structure.relations) ids.add(r.target);
  for (const r of structure.incoming) ids.add(r.source);
  ids.delete(structure.id);
  return ids;
}

/** Las mallas de las estructuras relacionadas, sin las de la propia estructura. */
export function relatedMeshes(
  parts: readonly AnatomyPart[],
  structure: AnatomyStructure,
  sex: AnatomySex,
  composites: AnatomyComposites = {},
): string[] {
  const propias = new Set(structureIdsOf(structure.id, composites));
  const relacionadas = new Set([...relatedStructureIds(structure)].flatMap((id) => structureIdsOf(id, composites)));
  return parts
    .filter((p) => relacionadas.has(p.structureId) && !propias.has(p.structureId) && partVisibleFor(p, sex))
    .map((p) => p.meshId);
}

/** Una relación para mostrar: con quién y si se puede abrir. */
export interface RelatedItem {
  readonly id: string;
  readonly label: string;
  /** Tiene pieza en el modelo, esté o no encendida su capa. */
  readonly hasMesh: boolean;
  /** Se está dibujando resaltada ahora: tiene pieza y su capa está encendida. */
  readonly highlighted: boolean;
  readonly inCatalog: boolean;
}

export interface RelationGroup {
  readonly name: string;
  readonly items: readonly RelatedItem[];
}

/** El nombre que se muestra: el castellano si existe, el de la ontología si no. */
export function displayName(labelEs: string | null, labelEn: string | null, id: string): string {
  return labelEs ?? labelEn ?? id;
}

/** Agrupa salientes y entrantes por nombre de relación, en el orden en que aparecen. */
export function groupRelations(
  structure: AnatomyStructure,
  withMesh: ReadonlySet<string>,
  inCatalog: ReadonlySet<string>,
  drawn: ReadonlySet<string> = withMesh,
): RelationGroup[] {
  const grupos = new Map<string, RelatedItem[]>();
  const agregar = (nombre: string, item: RelatedItem) => {
    const lista = grupos.get(nombre) ?? [];
    if (!lista.some((i) => i.id === item.id)) lista.push(item);
    grupos.set(nombre, lista);
  };
  for (const r of structure.relations) {
    agregar(r.name, {
      id: r.target,
      label: displayName(r.labelEs, r.labelEn, r.target),
      hasMesh: withMesh.has(r.target),
      highlighted: drawn.has(r.target),
      inCatalog: inCatalog.has(r.target),
    });
  }
  for (const r of structure.incoming) {
    agregar(r.name, {
      id: r.source,
      label: displayName(r.labelEs, r.labelEn, r.source),
      hasMesh: withMesh.has(r.source),
      highlighted: drawn.has(r.source),
      inCatalog: inCatalog.has(r.source),
    });
  }
  return [...grupos].map(([name, items]) => ({ name, items }));
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

/** Una página (1-based) de `items`; la página se acota al rango válido. */
export function pageOf<T>(items: readonly T[], page: number, size: number): T[] {
  const ultima = Math.max(1, Math.ceil(items.length / size));
  const actual = Math.min(Math.max(1, page), ultima);
  return items.slice((actual - 1) * size, actual * size);
}

/**
 * Reparte los grupos de relaciones por páginas de `size` filas en total,
 * sin partir el orden: un grupo que cae entre dos páginas continúa en la siguiente.
 */
export function pageRelationGroups(groups: readonly RelationGroup[], page: number, size: number): RelationGroup[] {
  const filas = groups.flatMap((g) => g.items.map((item) => ({ name: g.name, item })));
  const visibles = pageOf(filas, page, size);
  const porGrupo = new Map<string, RelatedItem[]>();
  for (const { name, item } of visibles) porGrupo.set(name, [...(porGrupo.get(name) ?? []), item]);
  return [...porGrupo].map(([name, items]) => ({ name, items }));
}

/* ---- «Mujer» ----------------------------------------------------------- */

/**
 * Lo que se ve sólo en «Mujer», para elegirlo sin tocar el lienzo: las
 * estructuras de las piezas femeninas, los órganos que ellas forman (útero,
 * mama) y las estructuras exclusivamente femeninas con pieza. Las clases
 * genéricas que también quedan formadas sólo por piezas femeninas
 * («conducto», «tubérculo») no ayudan a elegir: los órganos de HuBMAP que
 * UBERON no trae (la mama izquierda) son `FMA:`.
 */
export function femaleModelEntries(
  parts: readonly AnatomyPart[],
  composites: AnatomyComposites,
  femaleOnlyIds: readonly string[],
  porId: ReadonlyMap<string, AnatomyIndexEntry>,
): AnatomyIndexEntry[] {
  const femeninas = new Set(parts.filter((p) => p.sex === 'female').map((p) => p.structureId));
  const exclusivas = new Set(femaleOnlyIds);
  const organos = Object.entries(composites)
    .filter(([id, miembros]) => (exclusivas.has(id) || id.startsWith('FMA:')) && miembros.every((m) => femeninas.has(m)))
    .map(([id]) => id);
  const conPieza = femaleOnlyIds.filter((id) => porId.get(id)?.[3] === 1);
  return entriesOf([...femeninas, ...organos, ...conPieza], porId);
}

/** Las estructuras exclusivamente femeninas que ninguna malla libre dibuja (la vagina, la vulva). */
export function femaleMissingEntries(
  femaleOnlyIds: readonly string[],
  porId: ReadonlyMap<string, AnatomyIndexEntry>,
): AnatomyIndexEntry[] {
  return entriesOf(femaleOnlyIds.filter((id) => porId.get(id)?.[3] === 0), porId);
}

/** Las filas del índice de estos ids, sin repetir y en orden alfabético castellano. */
function entriesOf(ids: readonly string[], porId: ReadonlyMap<string, AnatomyIndexEntry>): AnatomyIndexEntry[] {
  return [...new Set(ids)]
    .map((id) => porId.get(id))
    .filter((e): e is AnatomyIndexEntry => e !== undefined)
    .sort((a, b) => displayName(a[1], a[2], a[0]).localeCompare(displayName(b[1], b[2], b[0]), 'es'));
}

/* ---- referencias ------------------------------------------------------ */

/** El enlace de una referencia, si es de un tipo que se puede abrir. */
export function referenceUrl(ref: AnatomyReference): string | null {
  switch (ref.kind) {
    case 'pmid':
      return `https://pubmed.ncbi.nlm.nih.gov/${ref.value}/`;
    case 'doi':
      return `https://doi.org/${ref.value}`;
    case 'wikipedia':
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(ref.value)}`;
    case 'url':
    case 'curator':
      return ref.value;
    default:
      return null;
  }
}

export function referenceLabel(ref: AnatomyReference): string {
  const nombres: Record<AnatomyReference['kind'], string> = {
    pmid: 'PubMed',
    doi: 'DOI',
    isbn: 'ISBN',
    wikipedia: 'Wikipedia (en)',
    url: 'Enlace',
    curator: 'Curador (ORCID)',
    xref: 'Referencia cruzada',
  };
  return `${nombres[ref.kind]}: ${ref.value}`;
}
