import type {
  AnatomyIndexEntry,
  AnatomyLayer,
  AnatomyPart,
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

/** ¿La pieza se dibuja con este sexo? «Mujer» sólo quita lo exclusivo del cuerpo masculino. */
export function partVisibleFor(part: AnatomyPart, sex: AnatomySex): boolean {
  return !(sex === 'female' && part.sex === 'male');
}

/** Las mallas de una estructura (las dos caras de un hueso par, por ejemplo). */
export function meshesOf(parts: readonly AnatomyPart[], structureId: string, sex: AnatomySex): string[] {
  return parts.filter((p) => p.structureId === structureId && partVisibleFor(p, sex)).map((p) => p.meshId);
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
export function relatedMeshes(parts: readonly AnatomyPart[], structure: AnatomyStructure, sex: AnatomySex): string[] {
  const relacionadas = relatedStructureIds(structure);
  return parts
    .filter((p) => relacionadas.has(p.structureId) && p.structureId !== structure.id && partVisibleFor(p, sex))
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

/** Las entradas del índice cuyo nombre (castellano o inglés) contiene el texto; primero las que tienen pieza. */
export function searchIndex(entries: readonly AnatomyIndexEntry[], query: string, limit: number): AnatomyIndexEntry[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const aciertos = entries.filter(
    ([id, es, en]) => normalizeSearch(es ?? '').includes(q) || normalizeSearch(en).includes(q) || id.toLowerCase() === q,
  );
  aciertos.sort((a, b) => b[3] - a[3]);
  return aciertos.slice(0, limit);
}

/** El lado de una pieza par, dicho en castellano. */
export function sideLabel(side: AnatomyPart['side']): string | null {
  return side === 'right' ? 'lado derecho' : side === 'left' ? 'lado izquierdo' : null;
}
