import type { TreeNode, TreeRow } from './tree.types';

/* ============================================================================
    Lógica pura del árbol: aplanado por nodos abiertos y navegación por teclado.
    Sin Angular, para probarla de a una función.
    ========================================================================== */

/** Las filas visibles, en orden de lectura, según qué nodos están abiertos. */
export function flattenTree<T>(nodes: readonly TreeNode<T>[], expanded: ReadonlySet<string>): readonly TreeRow<T>[] {
  const filas: TreeRow<T>[] = [];
  const recorrer = (lista: readonly TreeNode<T>[], level: number, parentId: string | null): void => {
    lista.forEach((node, indice) => {
      const expandable = (node.children?.length ?? 0) > 0;
      const abierto = expandable && expanded.has(node.id);
      filas.push({ node, level, position: indice + 1, setSize: lista.length, parentId, expandable, expanded: abierto });
      if (abierto) recorrer(node.children!, level + 1, node.id);
    });
  };
  recorrer(nodes, 1, null);
  return filas;
}

/** Los ancestros de un nodo (del más lejano al más cercano), o `[]` si no está o es raíz. */
export function treeAncestorIds<T>(nodes: readonly TreeNode<T>[], id: string): readonly string[] {
  const buscar = (lista: readonly TreeNode<T>[], camino: readonly string[]): readonly string[] | null => {
    for (const nodo of lista) {
      if (nodo.id === id) return camino;
      const dentro = buscar(nodo.children ?? [], [...camino, nodo.id]);
      if (dentro !== null) return dentro;
    }
    return null;
  };
  return buscar(nodes, []) ?? [];
}

/** Los ids de todos los nodos que tienen hijos. */
export function expandableIds<T>(nodes: readonly TreeNode<T>[]): readonly string[] {
  return nodes.flatMap((n) => ((n.children?.length ?? 0) > 0 ? [n.id, ...expandableIds(n.children!)] : []));
}

export type TreeMove =
  | { readonly kind: 'focus'; readonly id: string }
  | { readonly kind: 'expand'; readonly id: string }
  | { readonly kind: 'collapse'; readonly id: string }
  | { readonly kind: 'expand-siblings'; readonly id: string }
  | { readonly kind: 'select'; readonly id: string; readonly activate: boolean }
  | { readonly kind: 'none' };

const NINGUNO: TreeMove = { kind: 'none' };

/**
 * Qué hace una tecla sobre la fila enfocada, según el patrón «Tree View» de la
 * guía de prácticas de ARIA: las flechas mueven el foco, derecha/izquierda abren,
 * cierran o saltan al hijo/padre, Inicio y Fin van a los extremos, `*` abre a
 * los hermanos y Enter/Espacio eligen.
 */
export function moveFor<T>(key: string, filas: readonly TreeRow<T>[], focusedId: string): TreeMove {
  const i = filas.findIndex((f) => f.node.id === focusedId);
  if (i < 0) return NINGUNO;
  const fila = filas[i];
  switch (key) {
    case 'ArrowDown':
      return i + 1 < filas.length ? { kind: 'focus', id: filas[i + 1].node.id } : NINGUNO;
    case 'ArrowUp':
      return i > 0 ? { kind: 'focus', id: filas[i - 1].node.id } : NINGUNO;
    case 'Home':
      return { kind: 'focus', id: filas[0].node.id };
    case 'End':
      return { kind: 'focus', id: filas[filas.length - 1].node.id };
    case 'ArrowRight':
      if (!fila.expandable) return NINGUNO;
      if (!fila.expanded) return { kind: 'expand', id: fila.node.id };
      return i + 1 < filas.length ? { kind: 'focus', id: filas[i + 1].node.id } : NINGUNO;
    case 'ArrowLeft':
      if (fila.expandable && fila.expanded) return { kind: 'collapse', id: fila.node.id };
      return fila.parentId === null ? NINGUNO : { kind: 'focus', id: fila.parentId };
    case '*':
      return { kind: 'expand-siblings', id: fila.node.id };
    case 'Enter':
      return { kind: 'select', id: fila.node.id, activate: true };
    case ' ':
      return { kind: 'select', id: fila.node.id, activate: false };
    default:
      return NINGUNO;
  }
}

/**
 * Escritura anticipada: la próxima fila (después de la enfocada, con vuelta al
 * principio) cuyo rótulo empieza con lo tecleado. Sin distinguir mayúsculas ni tildes.
 */
export function typeAheadTarget<T>(prefix: string, filas: readonly TreeRow<T>[], focusedId: string | null): string | null {
  const limpio = plegar(prefix);
  if (limpio === '' || filas.length === 0) return null;
  const desde = Math.max(0, filas.findIndex((f) => f.node.id === focusedId));
  // Con un solo carácter se busca a partir de la fila siguiente; con varios, desde la actual.
  const arranque = prefix.length === 1 ? desde + 1 : desde;
  for (let k = 0; k < filas.length; k++) {
    const fila = filas[(arranque + k) % filas.length];
    if (!fila.node.disabled && plegar(fila.node.label).startsWith(limpio)) return fila.node.id;
  }
  return null;
}

function plegar(texto: string): string {
  return texto.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
