/* ============================================================================
    Contratos del atlas anatómico 3D.

    Son la forma de los JSON que escribe `scripts/gen-anatomy-ontology-fixture.mjs`
    en `public/anatomy-atlas-3d/catalog/`. No es un recurso de la API: es
    contenido de referencia abierto (UBERON, FMA, BodyParts3D) que viaja con el
    frontend, igual que las mallas. Por eso se lee igual en la maqueta y contra
    la API real.
    ========================================================================== */

/** Las capas del modelo, una por GLB. */
export type AnatomyLayer = 'skeleton' | 'muscles' | 'vessels' | 'nervous' | 'organs';

/** El cuerpo que se muestra. Ver `AnatomyAtlasPage` sobre lo que significa «female». */
export type AnatomySex = 'male' | 'female';

/** Una malla del modelo y la estructura que representa. */
export interface AnatomyPart {
  /** Nombre del nodo en el GLB: el id de BodyParts3D (`FMA24474`, `BP24`). */
  readonly meshId: string;
  readonly layer: AnatomyLayer;
  /** `male` si la pieza es exclusiva del cuerpo masculino de referencia. */
  readonly sex: 'male' | 'shared';
  readonly structureId: string;
  readonly shard: number;
  readonly side: 'right' | 'left' | null;
  readonly labelEn: string;
  /** Cómo se cruzó la malla con UBERON; `fma_only` si no se cruzó. */
  readonly match: 'fma_exact' | 'fma_parent' | 'fma_only';
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
  /** El código TA2 (FIPAT), si un FMA de la ficha lleva a uno solo; `null` si no se pudo cruzar. */
  readonly ta2: AnatomyTa2 | null;
  /** `null` si no se buscó literatura para esta estructura (está fuera de la prioridad). */
  readonly extendedDescription: AnatomyExtendedDescription | null;
  readonly images: readonly AnatomyImage[];
}

/** Un término de la Terminologia Anatomica 2, cruzado por FMA vía Wikidata. */
export interface AnatomyTa2 {
  readonly code: string;
  readonly la: string | null;
  readonly en: string | null;
  /** El FMA de la ficha por el que se cruzó. */
  readonly fma: string;
  /** El ítem de Wikidata que declara el par TA2 ↔ FMA. */
  readonly wikidata: string;
}

/** Lo que se describe, en el orden en que se muestra. */
export type AnatomyAspect = 'situation' | 'parts' | 'relations' | 'irrigation' | 'innervation' | 'function' | 'clinical';

/** Una frase parafraseada de la literatura, con sus citas (`PMID:…`). */
export interface AnatomyCitedSentence {
  readonly aspect: AnatomyAspect;
  readonly es: string;
  readonly cites: readonly string[];
}

/** Un artículo citado. */
export interface AnatomyLiteratureSource {
  /** `PMID:…`, la clave con que lo citan las frases. */
  readonly id: string;
  readonly pmid: string;
  readonly doi: string | null;
  readonly title: string;
  readonly journal: string | null;
  readonly year: string | null;
}

/**
 * La descripción extendida: frases parafraseadas de resúmenes de PubMed y
 * Europe PMC. `no_source` = se buscó y no hubo con qué sustentar ninguna frase.
 */
export interface AnatomyExtendedDescription {
  readonly status: 'described' | 'no_source';
  readonly sentences: readonly AnatomyCitedSentence[];
  /** Los aspectos sin fuente: quedan vacíos y se dice. */
  readonly missingAspects: readonly AnatomyAspect[];
  readonly sources: readonly AnatomyLiteratureSource[];
  readonly searchedQuery: string;
}

/** Una imagen de Wikimedia Commons, con autor y licencia leídos de su API `extmetadata`. */
export interface AnatomyImage {
  /** `File:…` en Commons. */
  readonly file: string;
  readonly thumbUrl: string;
  readonly pageUrl: string;
  readonly author: string;
  /** `LicenseShortName` de Commons, tal cual («Public domain», «CC BY-SA 4.0»). */
  readonly license: string;
  readonly licenseUrl: string | null;
  readonly width: number;
  readonly height: number;
  /** Texto alternativo en castellano. */
  readonly altEs: string;
  /** El URL de la API de la que se leyeron autor y licencia. */
  readonly metadataUrl: string;
}

/** Una fila del índice: `[id, nombre en castellano, nombre en inglés, tiene malla]`. */
export type AnatomyIndexEntry = readonly [string, string | null, string, 0 | 1];

export interface AnatomyIndex {
  readonly shards: number;
  readonly entries: readonly AnatomyIndexEntry[];
}
