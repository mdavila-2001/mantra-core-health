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

/**
 * Etiquetas de un puñado de conceptos, por su identificador.
 *
 * Es el camino inverso al de un selector: el resto del contrato devuelve
 * `*ConceptId` en uuid, y ninguna pantalla puede mostrar un uuid. Se resuelve
 * con `GET /terminology/concepts?ids=…`.
 */
export type ConceptLabels = ReadonlyMap<string, ValueSetOption>;

/** Parámetros opcionales de la lectura de una expansión. */
export interface ValueSetExpansionQuery {
  /** Versión concreta a leer; por defecto, la vigente del conjunto. */
  readonly valueSetVersionId?: string;
  /** Cursor devuelto por la página anterior. */
  readonly cursor?: string;
  /** Miembros por página. La API acota el máximo. */
  readonly limit?: number;
}

/**
 * Una página de la búsqueda de conceptos por texto.
 *
 * Sin cursor: la API la acota con `limit` y no publica continuación. Buscar por
 * texto es acotar hasta encontrar, no pasear por el catálogo entero — para eso
 * está la expansión de un conjunto de valores, que sí pagina.
 */
export interface ConceptSearchPage {
  readonly items: readonly ValueSetOption[];
  readonly count: number;
  readonly limit: number;
}

/** Parámetros de la búsqueda de conceptos (UC-03-13). */
export interface ConceptSearchQuery {
  /** Texto a buscar en el código o la denominación. */
  readonly query?: string;
  /** Acota a una versión de sistema de códigos. */
  readonly codeSystemVersionId?: string;
  /** Tope de resultados; la API usa 50 por defecto. */
  readonly limit?: number;
}

/* ---------------------------------------------------------------------------
   El glosario: etiquetas y términos en castellano.

   Todo lo que sigue se agrega **al final** y no toca nada de arriba.
   `ValueSetOption` en particular queda intacta: es la forma que devuelve el
   backend para los selectores y la consume medio repositorio.

   Son tipos aparte y no una ampliación de `ValueSetOption` porque describen
   otra cosa. Un selector necesita «qué mando en este campo»; un glosario
   necesita «cómo se llama esto, qué significa y bajo qué categorías cae». El día
   que el catálogo cambie el shape de una, la otra no tiene por qué moverse.
   --------------------------------------------------------------------------- */

/**
 * Una **etiqueta** del glosario: un conjunto de valores del catálogo.
 *
 * Las categorías no son un campo nuevo ni una invención de la pantalla — son los
 * conjuntos de valores que el modelo ya tenía: «Diagnóstico», «Severidad», «Vía
 * de administración». El glosario nunca los había pedido.
 */
export interface GlossaryTag {
  readonly id: string;
  /** Código interno estable, como `condition-severity`. Es lo que viaja en la URL. */
  readonly internalCode: string;
  /** Nombre legible. Ya viene en castellano del catálogo. */
  readonly name: string;
  /** Qué agrupa, si el catálogo lo declara. */
  readonly description?: string;
  /** Versión vigente del conjunto, o `null` si todavía no hay ninguna. */
  readonly defaultVersionId: string | null;
  /** Cuántos términos tiene. Es el conteo que se muestra junto a la etiqueta. */
  readonly memberCount?: number;
}

/** Una página del listado de etiquetas. */
export interface GlossaryTagPage {
  readonly items: readonly GlossaryTag[];
  readonly count: number;
  readonly limit: number;
  /** Cursor opaco de continuación, o `null` si ésta es la última página. */
  readonly nextCursor: string | null;
}

/** Parámetros del listado de etiquetas. */
export interface GlossaryTagQuery {
  /** Código interno exacto. */
  readonly code?: string;
  /** Texto libre sobre el código interno y el nombre. */
  readonly query?: string;
  /** Cursor devuelto por la página anterior. */
  readonly cursor?: string;
  /** Conjuntos por página. */
  readonly limit?: number;
}

/** Una etiqueta nombrada desde el término al que pertenece. */
export interface GlossaryTermTag {
  readonly id: string;
  readonly internalCode: string;
  readonly name: string;
}

/**
 * Una entrada del glosario: el término, qué significa y bajo qué categorías cae.
 *
 * `translated` en `false` significa que el catálogo **no tiene** ese término en
 * castellano y lo que se muestra es el original del sistema de codificación. Se
 * publica para poder decirlo en pantalla: dejar el hueco en blanco o mostrar el
 * inglés como si fuera lo pedido son las dos formas de mentir acá.
 */
export interface GlossaryTerm {
  readonly conceptId: string;
  /** Código dentro de su sistema, como `I10`. */
  readonly code: string;
  readonly display: string;
  readonly definition?: string;
  readonly translated?: boolean;
  readonly valueSets?: readonly GlossaryTermTag[];
}

/** Una página de términos del glosario. */
export interface GlossaryTermPage {
  readonly items: readonly GlossaryTerm[];
  readonly count: number;
  readonly limit: number;
}

/** Qué se le pide al glosario: texto, categoría o las dos cosas. */
export interface GlossaryQuery {
  /** Texto a buscar. */
  readonly query?: string;
  /** Categoría por la que se está navegando. */
  readonly valueSetId?: string;
  /** Tope de términos. */
  readonly limit?: number;
}

/** Otra forma de nombrar el mismo término. */
export interface GlossarySynonym {
  readonly value: string;
  /** Idioma de la denominación, cuando el catálogo lo declara. */
  readonly language?: string;
  /** Si es la preferida de su idioma. */
  readonly preferred?: boolean;
}

/** La ficha completa de un término, que es lo que se abre al hacerle clic. */
export interface GlossaryTermDetail extends GlossaryTerm {
  readonly codeSystemVersionId: string;
  readonly valueSets: readonly GlossaryTermTag[];
  readonly synonyms: readonly GlossarySynonym[];
}
