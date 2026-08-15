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

/* ---------------------------------------------------------------------------
   Reconstrucción del glosario (carril 03): diccionario por categorías, con
   relaciones clínicas tipadas.

   `CatalogConcepts` es una tabla compartida por **todos** los enums de la
   plataforma; lo que hace que una fila sea «un término del glosario» es
   pertenecer al value set paraguas `glossary-all-terms` — el backend lo aplica
   scopeando automáticamente cualquier lectura hecha con `lang=ES`, que es como
   este cliente llama siempre a `searchGlossary`/`readGlossaryTerm`. Acá no hace
   falta pedirlo explícitamente: no cambia ni un parámetro, sólo lo que el
   backend devuelve dentro del mismo contrato.
   --------------------------------------------------------------------------- */

/** Los seis tipos de relación clínica tipada entre dos términos del glosario. */
export const GLOSSARY_RELATION_TYPES = [
  'RELATED_TERM',
  'DISEASE',
  'PROCEDURE',
  'TREATMENT',
  'ANATOMY',
  'DIAGNOSTIC_TEST',
] as const;
export type GlossaryRelationType = (typeof GLOSSARY_RELATION_TYPES)[number];

/**
 * Una relación clínica dirigida hacia otro término del glosario.
 *
 * Trae ya lo necesario para enlazar (`conceptId`) y para mostrar (`display`,
 * `slug`) sin una segunda lectura: la ficha las pinta agrupadas por `type`.
 */
export interface GlossaryRelation {
  readonly type: GlossaryRelationType;
  readonly conceptId: string;
  readonly slug: string;
  readonly display: string;
}

/**
 * Un texto con su bandera de traducción — el mismo patrón que ya usaba
 * `translated` a nivel de término, aplicado ahora a un campo puntual.
 *
 * `translated` en `false` significa que el catálogo no tiene ese texto en
 * castellano y lo que llega es el original (ES es obligatorio en el seed, así
 * que esto sólo puede pasar del lado que hoy no se siembra en todos los
 * términos). Se muestra igual, marcado — nunca en blanco.
 */
export interface GlossaryLocalizedText {
  readonly text: string;
  readonly translated: boolean;
}

/** La categoría de un término, tal como la nombra un resultado de búsqueda. */
export interface GlossaryCategoryRef {
  readonly internalCode: string;
  readonly name: string;
}

/** La misma referencia, con el uuid del value set — la que trae la ficha completa. */
export interface GlossaryCategoryDetailRef extends GlossaryCategoryRef {
  readonly valueSetId: string;
}

/**
 * Estado editorial de un término publicado.
 *
 * Hoy sólo existe `'active'`: el endpoint público filtra `stateConceptId =
 * TERM_ACTIVE` y nunca deja pasar un borrador. El tipo no es un enum cerrado a
 * un solo valor por capricho — es lo que el contrato declara hoy, y el día que
 * el backend publique otro estado público, esta unión es el lugar donde se lo
 * suma.
 */
export type GlossaryTermStatus = 'active';

/**
 * Licencia y atribución de una imagen médica del glosario.
 *
 * Ningún término la trae hoy — el backend documenta la decisión explícita de
 * no sembrar ninguna hasta que exista una política de licencias verificada
 * para imágenes externas (ver `glossary-reconstruction-spec.md`). El campo
 * existe igual porque el contrato lo declara: cuando un futuro carril suba una
 * imagen con su licencia, esta pantalla ya sabe mostrarla.
 */
export interface GlossaryImage {
  readonly source: string;
  readonly license: string;
  readonly attribution: string;
  readonly alt: string;
  readonly status: string;
}

/** Identidad compartida entre el resultado de búsqueda y la ficha completa. */
interface GlossaryTermBase {
  readonly conceptId: string;
  /** Código dentro de su sistema, como `I10`. */
  readonly code: string;
  readonly display: string;
  /** Identificador legible y estable del término, para enlazar entre sí. */
  readonly slug: string;
  readonly translated?: boolean;
  readonly valueSets?: readonly GlossaryTermTag[];
}

/**
 * Una entrada del glosario: el término, su categoría, su definición breve y
 * sus etiquetas — la fila de la tabla de resultados o del listado de una
 * categoría.
 *
 * `category` es **una sola** (o `null`, si el catálogo no la declaró); `tags`
 * son las etiquetas clínicas, 0..N. Son dos conjuntos de value sets distintos
 * del backend (`glossary-category-*` y `glossary-tag-*`) y por eso no se
 * mezclan en un solo array como antes.
 */
export interface GlossaryTerm extends GlossaryTermBase {
  readonly category: GlossaryCategoryRef | null;
  readonly shortDefinition: string;
  readonly tags: readonly string[];
  /** Cuántas relaciones clínicas tiene. La lista completa vive en la ficha. */
  readonly relationsCount: number;
  readonly status: GlossaryTermStatus;
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

/**
 * La ficha completa de un término, que es lo que se abre al hacerle clic.
 *
 * No extiende `GlossaryTerm`: `category` y `tags` tienen ahí una forma más
 * liviana (pensada para una fila de tabla) que acá, donde la ficha trae el uuid
 * del value set de la categoría y el objeto completo de cada etiqueta.
 * Forzar la misma forma en las dos hubiera significado mentir en una de las
 * dos, o ensanchar la fila de la tabla con datos que nunca pinta.
 */
export interface GlossaryTermDetail extends GlossaryTermBase {
  readonly codeSystemVersionId: string;
  readonly valueSets: readonly GlossaryTermTag[];
  readonly synonyms: readonly GlossarySynonym[];
  readonly category: GlossaryCategoryDetailRef | null;
  readonly tags: readonly GlossaryCategoryDetailRef[];
  readonly clinicalDefinition: GlossaryLocalizedText;
  readonly plainSummary: GlossaryLocalizedText;
  readonly relations: readonly GlossaryRelation[];
  /** Ausente en todos los términos sembrados hoy — ver {@link GlossaryImage}. */
  readonly image?: GlossaryImage;
}
