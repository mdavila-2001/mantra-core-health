import type {
  AnatomyIndexEntry,
  AnatomyLayer,
  AnatomyPart,
  AnatomySex,
} from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { partVisibleFor } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.logic';

/* ============================================================================
    Lógica pura del selector de la parte del cuerpo: de una malla tocada o de
    una estructura elegida en la lista a la misma selección. Sin Angular ni
    three.js, para probar que el puntero y el teclado eligen lo mismo.
    ========================================================================== */

/** Lo que el selector emite: la malla, su estructura (`UBERON:`/`FMA:`), su capa y su lado. */
export interface BodySiteSelection {
  readonly meshId: string;
  readonly structureId: string;
  readonly layer: AnatomyLayer;
  readonly side: 'right' | 'left' | null;
}

function selectionOf(part: AnatomyPart): BodySiteSelection {
  return { meshId: part.meshId, structureId: part.structureId, layer: part.layer, side: part.side };
}

/** La selección de una malla tocada en el cuerpo, o `null` si el catálogo no la conoce. */
export function selectionOfMesh(parts: readonly AnatomyPart[], meshId: string): BodySiteSelection | null {
  const part = parts.find((p) => p.meshId === meshId);
  return part === undefined ? null : selectionOf(part);
}

/**
 * La selección de una estructura elegida en la lista. Un hueso par tiene una
 * malla por lado: con una sola, esa; con dos, la del lado que ya se había
 * marcado si hay, y si no la primera **sin lado**, porque elegir uno en nombre
 * del médico sería inventar el dato (el lado se indica aparte).
 */
export function selectionOfStructure(
  parts: readonly AnatomyPart[],
  structureId: string,
  sex: AnatomySex,
  preferredSide: 'right' | 'left' | null = null,
): BodySiteSelection | null {
  const own = parts.filter((p) => p.structureId === structureId && partVisibleFor(p, sex));
  if (own.length === 0) return null;
  if (own.length === 1) return selectionOf(own[0]);
  const preferred = preferredSide === null ? undefined : own.find((p) => p.side === preferredSide);
  if (preferred !== undefined) return selectionOf(preferred);
  return { ...selectionOf(own[0]), side: null };
}

/**
 * Las mallas a resaltar: la tocada si se conoce su lado; si el lado no está
 * definido (elegida en la lista, hueso par), todas las de la estructura.
 */
export function highlightedMeshes(
  parts: readonly AnatomyPart[],
  selection: BodySiteSelection | null,
  sex: AnatomySex,
): string[] {
  if (selection === null) return [];
  if (selection.side !== null) return [selection.meshId];
  const own = parts.filter((p) => p.structureId === selection.structureId && partVisibleFor(p, sex));
  return own.length === 0 ? [selection.meshId] : own.map((p) => p.meshId);
}

/** Las estructuras que se pueden elegir en la lista: sólo las que tienen malla propia. */
export function pickableEntries(entries: readonly AnatomyIndexEntry[]): AnatomyIndexEntry[] {
  return entries.filter((e) => e[3] === 1);
}

/** El lado en palabras, o `null`. */
export function sideWords(side: BodySiteSelection['side']): string | null {
  return side === 'right' ? 'derecho' : side === 'left' ? 'izquierdo' : null;
}
