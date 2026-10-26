import type {
  AnatomyAspect,
  AnatomyExtendedDescription,
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

/**
 * Qué tan buen acierto es una entrada para lo escrito; menor es mejor, `null` si no acierta.
 *
 * Cada palabra escrita tiene que aparecer en el nombre en castellano, en el
 * inglés o en el identificador. Entre los que aciertan manda el nombre en
 * castellano, que es el idioma de quien busca:
 *
 * - 0: el nombre es exactamente lo escrito («húmero»).
 * - 1: el nombre empieza con lo escrito («húmero» → «húmero distal»).
 * - 2: lo escrito son palabras completas del nombre («humero» → «cabeza del húmero»).
 * - 3: lo escrito abre una palabra del nombre («humero» → «humerocubital»).
 * - 4: lo escrito está dentro de una palabra o sólo en el nombre en inglés.
 */
function matchRank(entry: AnatomyIndexEntry, palabras: readonly string[], frase: string): number | null {
  const [id, es, en] = entry;
  const nombreEs = normalizeSearch(es ?? '');
  const nombreEn = normalizeSearch(en);
  const idMinuscula = id.toLowerCase();
  const aciertaEn = (texto: string) => palabras.every((p) => texto.includes(p));
  const enEs = nombreEs !== '' && aciertaEn(nombreEs);
  const enIngles = aciertaEn(nombreEn);
  if (!enEs && !enIngles && idMinuscula !== frase) return null;

  if (enEs) {
    if (nombreEs === frase) return 0;
    if (nombreEs.startsWith(frase)) return 1;
    const sus = nombreEs.split(/[^\p{L}\p{N}]+/u);
    if (palabras.every((p) => sus.includes(p))) return 2;
    if (palabras.every((p) => sus.some((palabra) => palabra.startsWith(p)))) return 3;
  }
  return 4;
}

/**
 * Las entradas del índice que aciertan con lo escrito, de mejor a peor.
 *
 * Se busca sin tildes ni mayúsculas y por palabras: «cabeza humero» encuentra
 * «cabeza del húmero». A igual acierto van primero las que tienen pieza 3D, y
 * después las de nombre más corto —«fémur» antes que «cabeza del fémur»—.
 */
export function searchIndex(entries: readonly AnatomyIndexEntry[], query: string, limit: number): AnatomyIndexEntry[] {
  const frase = normalizeSearch(query).replace(/\s+/g, ' ');
  if (frase.length < 2) return [];
  const palabras = frase.split(' ');
  const aciertos: { entrada: AnatomyIndexEntry; rango: number }[] = [];
  for (const entrada of entries) {
    const rango = matchRank(entrada, palabras, frase);
    if (rango !== null) aciertos.push({ entrada, rango });
  }
  aciertos.sort(
    (a, b) =>
      a.rango - b.rango ||
      b.entrada[3] - a.entrada[3] ||
      (a.entrada[1] ?? a.entrada[2]).length - (b.entrada[1] ?? b.entrada[2]).length,
  );
  return aciertos.slice(0, limit).map((a) => a.entrada);
}

/** El lado de una pieza par, dicho en castellano. */
export function sideLabel(side: AnatomyPart['side']): string | null {
  return side === 'right' ? 'lado derecho' : side === 'left' ? 'lado izquierdo' : null;
}

export const ASPECT_LABELS: Readonly<Record<AnatomyAspect, string>> = {
  situation: 'Situación',
  parts: 'Partes y morfología',
  relations: 'Relaciones',
  irrigation: 'Irrigación',
  innervation: 'Inervación',
  function: 'Función',
  clinical: 'Relevancia clínica',
};

/** Una frase con sus citas como números de la lista de fuentes (1, 2, …). */
export interface NumberedSentence {
  readonly es: string;
  readonly refs: readonly number[];
}

export interface SentenceGroup {
  readonly aspect: AnatomyAspect;
  readonly label: string;
  readonly sentences: readonly NumberedSentence[];
}

/**
 * Las frases de la descripción extendida agrupadas por aspecto, con cada cita
 * convertida en su número dentro de `sources`. Una cita que no está en
 * `sources` no se numera (el generador ya lo impide; acá no se inventa).
 */
export function groupSentences(description: AnatomyExtendedDescription): SentenceGroup[] {
  const numero = new Map(description.sources.map((s, i) => [s.id, i + 1]));
  const grupos = new Map<AnatomyAspect, NumberedSentence[]>();
  for (const frase of description.sentences) {
    const lista = grupos.get(frase.aspect) ?? [];
    lista.push({ es: frase.es, refs: frase.cites.map((c) => numero.get(c)).filter((n): n is number => n !== undefined) });
    grupos.set(frase.aspect, lista);
  }
  return [...grupos].map(([aspect, sentences]) => ({ aspect, label: ASPECT_LABELS[aspect], sentences }));
}

/** Los aspectos sin fuente, dichos en castellano y en minúscula: «irrigación, inervación». */
export function missingAspectsLabel(aspects: readonly AnatomyAspect[]): string {
  return aspects.map((a) => ASPECT_LABELS[a].toLowerCase()).join(', ');
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
