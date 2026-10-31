/* ============================================================================
    Catálogo de estudios pedibles (`GET /clinical/study-catalog`, C1 y C2).

    Lo que el médico elige al pedir: laboratorio con sus componentes,
    imagenología con modalidad, región, lateralidad y contraste. La API es la
    autoridad: el front no deduce la familia del prefijo del código, la lee de
    `family`.
    ========================================================================== */

/** Familia del estudio según el catálogo (no según el prefijo de su código). */
export type StudyFamily = 'LAB' | 'IMAGING' | 'CARDIO' | 'PATHOLOGY' | 'PROCEDURE';

/** Muestra que el catálogo sugiere para un análisis. */
export interface StudySpecimenHint {
  readonly text: string;
  readonly code: string;
  readonly hl7Code: string | null;
  readonly snomedCode: string | null;
  readonly source: string;
}

export interface StudyProvenance {
  readonly source: string | null;
  readonly version: string | null;
  readonly sourceIds: readonly string[];
}

/** Un renglón del listado. `conceptId` es el `codeConceptId` de la orden. */
export interface StudyCatalogItem {
  readonly conceptId: string;
  readonly code: string;
  readonly legacyCode: string | null;
  readonly codeSystem: string;
  readonly display: string;
  readonly family: StudyFamily;
  /** Es un panel desplegable: se piden sus componentes marcados. */
  readonly componentsSelectable: boolean;
  readonly componentCount: number;
  readonly specimenHint: StudySpecimenHint | null;
  readonly modalityConceptId: string | null;
  readonly bodySiteConceptId: string | null;
  readonly provenance: StudyProvenance;
}

export interface StudyCatalogPage {
  readonly items: readonly StudyCatalogItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

export interface StudyCatalogQuery {
  readonly family?: StudyFamily;
  /** Texto libre (hasta 100 caracteres); la API ignora tildes y mayúsculas. */
  readonly q?: string;
  readonly cursor?: string;
  /** 1 a 100; la API aplica 25 si se omite. */
  readonly limit?: number;
}

/** Un componente de un panel; los paneles anidados traen `children`. */
export interface StudyComponentNode {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
  readonly ordinal: number;
  readonly selectedByDefault: boolean;
  readonly exampleUnits: readonly string[];
  readonly isPanel: boolean;
  readonly loincCode: string | null;
  readonly loincName: string | null;
  readonly children: readonly StudyComponentNode[];
}

export interface StudyOption {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
  readonly isDefault: boolean;
}

export interface AllowedBodySite {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
  readonly parentConceptId: string | null;
  readonly regionType: string | null;
  /** La región es par: admite lateralidad. */
  readonly admitsLaterality: boolean;
  readonly isDefault: boolean;
}

export interface StudyLabDetail {
  readonly section: string | null;
  readonly fasting: boolean | null;
  readonly turnaroundHours: number | null;
  readonly loincCode: string | null;
  readonly loincName: string | null;
}

export interface StudyImagingDetail {
  readonly projections: readonly string[];
  readonly contrast: string;
  readonly contrastRoute: string | null;
  readonly preparation: string | null;
  readonly requiresLaterality: boolean;
  readonly loincCode: string | null;
  readonly radlexRpid: string | null;
}

export interface StudyAttribution {
  readonly source: string;
  readonly url: string;
  readonly license: string;
  readonly text: string;
}

/** El detalle de un estudio: todo lo que el formulario necesita para armar la orden. */
export interface StudyCatalogDetail extends StudyCatalogItem {
  readonly components: readonly StudyComponentNode[];
  readonly suggestedSpecimen: StudyOption | null;
  readonly allowedSpecimenTypes: readonly StudyOption[];
  readonly allowedModalities: readonly StudyOption[];
  readonly allowedBodySites: readonly AllowedBodySite[];
  readonly lateralityOptions: readonly StudyOption[];
  readonly contrastOptions: readonly StudyOption[];
  readonly lab: StudyLabDetail | null;
  readonly imaging: StudyImagingDetail | null;
  /** Avisos de licencia que deben mostrarse (LOINC, DICOM, SNOMED, RadLex, UBERON). */
  readonly attribution: readonly StudyAttribution[];
}
