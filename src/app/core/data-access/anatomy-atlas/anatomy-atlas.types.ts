/* ============================================================================
    Contratos del atlas anatómico 3D.

    Son la forma de los JSON que escribe `scripts/gen-anatomy-ontology-fixture.mjs`
    en `public/anatomy-atlas-3d/catalog/`. No es un recurso de la API: es
    contenido de referencia abierto (UBERON, FMA, BodyParts3D y el Human
    Reference Atlas de HuBMAP) que viaja con el
    frontend, igual que las mallas. Por eso se lee igual en la maqueta y contra
    la API real.
    ========================================================================== */

/** Las capas del modelo, una por GLB. */
export type AnatomyLayer = 'skeleton' | 'muscles' | 'vessels' | 'nervous' | 'organs';

/** El cuerpo que se muestra. Ver `GlossaryAnatomyAtlas` sobre lo que significa «female». */
export type AnatomySex = 'male' | 'female';

/** Una malla del modelo y la estructura que representa. */
export interface AnatomyPart {
  /**
   * Nombre del nodo en el GLB: el id de BodyParts3D (`FMA24474`, `BP24`) o el
   * nodo del Human Reference Atlas (`VH_F_cervix`).
   */
  readonly meshId: string;
  readonly layer: AnatomyLayer;
  /**
   * En qué cuerpo se dibuja: `shared` en los dos; `male` sólo en «Hombre»
   * (los genitales masculinos y la pelvis masculina de BodyParts3D); `female`
   * sólo en «Mujer» (la pelvis, el útero, las trompas, los ovarios y las mamas
   * del Visible Human Female, vía HuBMAP).
   */
  readonly sex: 'male' | 'female' | 'shared';
  readonly structureId: string;
  readonly shard: number;
  readonly side: 'right' | 'left' | null;
  readonly labelEn: string;
  /**
   * Cómo se cruzó la malla con UBERON; `fma_only` si no se cruzó. Las piezas
   * de HuBMAP usan su tabla de cruce: `hra_exact` (UBERON directo), `hra_fma`
   * (por su FMA) o `hra_only` (sin UBERON en el catálogo).
   */
  readonly match: 'fma_exact' | 'fma_parent' | 'fma_only' | 'hra_exact' | 'hra_fma' | 'hra_only';
}

/** Una referencia de la definición, ya clasificada. */
export interface AnatomyReference {
  readonly kind: 'pmid' | 'doi' | 'isbn' | 'wikipedia' | 'url' | 'curator' | 'xref';
  readonly value: string;
}

export interface AnatomyDefinition {
  /** El texto de UBERON, tal cual. */
  readonly en: string;
  /** Traducción automática sin revisión humana, o `null` si no hay. */
  readonly es: string | null;
  readonly refs: readonly AnatomyReference[];
}

/** Una relación declarada por la ontología, desde esta estructura. */
export interface AnatomyRelation {
  readonly type: string;
  readonly name: string;
  readonly target: string;
  readonly labelEn: string | null;
  readonly labelEs: string | null;
  readonly inCatalog: boolean;
}

/** La misma relación vista desde la otra punta: otra estructura apunta a esta. */
export interface AnatomyIncomingRelation {
  readonly type: string;
  readonly name: string;
  readonly source: string;
  readonly labelEn: string | null;
  readonly labelEs: string | null;
}

/**
 * Una referencia al índice de Netter: qué láminas. El texto del índice no se
 * publica (es de Elsevier y trae ruido de OCR); sólo el número de lámina.
 */
export interface AnatomyNetterEntry {
  readonly netterId: string;
  readonly plates: readonly number[];
  readonly matchKind: 'exact' | 'laterality_dropped';
}

/** La ficha de una estructura. */
export interface AnatomyStructure {
  readonly id: string;
  readonly labelEn: string;
  readonly labelEs: string | null;
  readonly synonymsEn: readonly string[];
  readonly fma: readonly string[];
  readonly regions: readonly string[];
  readonly definition: AnatomyDefinition | null;
  readonly isA: readonly { target: string; labelEn: string | null; labelEs: string | null; inCatalog: boolean }[];
  readonly relations: readonly AnatomyRelation[];
  readonly incoming: readonly AnatomyIncomingRelation[];
  readonly netter: readonly AnatomyNetterEntry[];
  readonly meshes: readonly string[];
  /** Siempre `null` en esta versión: no hubo acceso a la literatura para citarla. */
  readonly extendedDescription: null;
  readonly images: readonly never[];
}

/** Una fila del índice: `[id, nombre en castellano, nombre en inglés, tiene malla]`. */
export type AnatomyIndexEntry = readonly [string, string | null, string, 0 | 1];

export interface AnatomyIndex {
  readonly shards: number;
  readonly entries: readonly AnatomyIndexEntry[];
}

/**
 * Estructura compuesta → las partes suyas que sí tienen malla propia. «Pulmón»
 * no tiene malla: BodyParts3D dibuja sus lóbulos. Sólo figuran las compuestas
 * (las que tienen malla propia no están) y no las clases demasiado generales.
 */
export type AnatomyComposites = Readonly<Record<string, readonly string[]>>;
