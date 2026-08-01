/** Tipos de la vista para `terminology`. Se mapean desde los DTOs, no son ellos. */

/**
 * Una opción de un conjunto de valores.
 *
 * `conceptId` es lo que se manda de vuelta en cualquier campo `*ConceptId` del
 * contrato; `display` es sólo para mostrar. No ramificar por `display`: la
 * etiqueta es metadato de presentación y puede cambiar sin aviso, el código y el
 * identificador no.
 */
export interface ValueSetOption {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
  readonly definition?: string;
  /** Los conceptos abstractos agrupan y no se eligen. */
  readonly selectable?: boolean;
  readonly codeSystemVersionId: string;
  /** Posición dentro de la expansión; el orden ya viene aplicado. */
  readonly ordinal?: number;
}

/** Una página de la expansión vigente de un conjunto de valores. */
export interface ValueSetExpansionPage {
  readonly valueSetId: string;
  readonly valueSetVersionId: string;
  /** Etiqueta de la versión leída, p. ej. `1.0.0`. */
  readonly version: string;
  readonly items: readonly ValueSetOption[];
  readonly count: number;
  readonly limit: number;
  /**
   * Cursor de continuación, o `null` si ésta es la última página.
   *
   * Es **opaco**: se reenvía tal cual y no se interpreta. La API no publica su
   * forma justamente para poder cambiar las columnas de orden sin romper a nadie.
   */
  readonly nextCursor: string | null;
}

/** Parámetros opcionales de la lectura de una expansión. */
export interface ValueSetExpansionQuery {
  /** Versión concreta a leer; por defecto, la vigente del conjunto. */
  readonly valueSetVersionId?: string;
  /** Cursor devuelto por la página anterior. */
  readonly cursor?: string;
  /** Miembros por página. La API acota el máximo. */
  readonly limit?: number;
}
