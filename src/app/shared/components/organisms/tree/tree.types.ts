import type { Tone } from '../../tone/tone.types';

/**
 * Un nodo de `app-tree`: cualquier profundidad.
 *
 * El organismo **recibe** el árbol ya armado; no sabe de espacios, unidades ni
 * de ninguna API (composition-rules §3). Quien sabe arma los nodos.
 */
export interface TreeItem {
  /** Identificador estable: es lo que se emite al elegir. */
  readonly id: string;
  /** Lo que se lee en la fila, y contra lo que busca el type-ahead. */
  readonly label: string;
  /** Texto secundario en la misma fila (código, función). */
  readonly description?: string;
  /** Una marca a la derecha (estado). */
  readonly badge?: { readonly label: string; readonly variant: Tone };
  /** Los hijos. Ausente o vacío = hoja. */
  readonly children?: readonly TreeItem[];
}

/** Una fila visible ya aplanada: lo que el teclado recorre. */
export interface FilaVisible {
  readonly item: TreeItem;
  readonly level: number;
  readonly parentId: string | null;
  readonly posInSet: number;
  readonly setSize: number;
  readonly hasChildren: boolean;
}
