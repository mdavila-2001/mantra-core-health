/* ============================================================================
    Contratos del árbol de N niveles (`app-tree`).

    El componente no sabe de dominio: recibe nodos con `id`, rótulo y, si los
    tiene, hijos. Lo que significa un nodo —un espacio, una unidad, una
    categoría— lo decide quien lo monta, que también decide qué pasa al elegirlo.
    ========================================================================== */

/** Un nodo del árbol. `children` vacío o ausente = hoja. */
export interface TreeNode<T = unknown> {
  /** Identidad estable del nodo; es lo que se emite al elegirlo. */
  readonly id: string;
  /** Lo que se lee en la fila y da el nombre accesible del `treeitem`. */
  readonly label: string;
  /**
   * Aclaración corta junto al nombre —un código, un piso—. Es contexto: no
   * participa del nombre accesible de la fila ni de la escritura anticipada.
   */
  readonly hint?: string;
  readonly children?: readonly TreeNode<T>[];
  /** Se ve pero no se puede elegir (`aria-disabled`). */
  readonly disabled?: boolean;
  /** Se dibuja atenuado: un nodo que ya no está vigente pero sigue existiendo. */
  readonly muted?: boolean;
  /** Carga útil del dominio; el árbol no la lee, la plantilla de fila sí. */
  readonly data?: T;
}

/** Una fila visible: un nodo con su posición, ya aplanado por los nodos abiertos. */
export interface TreeRow<T = unknown> {
  readonly node: TreeNode<T>;
  /** Profundidad desde 1, como `aria-level`. */
  readonly level: number;
  /** Posición entre sus hermanos desde 1 (`aria-posinset`). */
  readonly position: number;
  /** Cantidad de hermanos (`aria-setsize`). */
  readonly setSize: number;
  readonly parentId: string | null;
  readonly expandable: boolean;
  readonly expanded: boolean;
}

/** Lo que recibe la plantilla de fila opcional. */
export interface TreeRowContext<T = unknown> {
  readonly $implicit: TreeNode<T>;
  readonly level: number;
  readonly expanded: boolean;
  readonly selected: boolean;
}
