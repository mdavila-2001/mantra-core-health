/** Una hoja del árbol: lo que la persona termina eligiendo. */
export interface TreeSelectItem<T> {
  /** El valor que se emite al elegirla. */
  readonly value: T;
  /** Lo que se lee en la fila. */
  readonly label: string;
  /**
   * Aclaración corta a la derecha del nombre — una provincia, un código.
   *
   * Es **contexto**, no identidad: no participa de la búsqueda ni del nombre
   * accesible de la fila, porque una fila que se lee distinto de como se busca
   * es una fila que aparece cuando nadie la llamó.
   */
  readonly hint?: string;
}

/** Una rama: un grupo con sus hojas. Un solo nivel de anidamiento, a propósito. */
export interface TreeSelectGroup<T> {
  /** Titular de la rama. Se puede buscar por él: trae todas sus hojas. */
  readonly label: string;
  /** Las hojas, en el orden en que se muestran. */
  readonly items: readonly TreeSelectItem<T>[];
}
