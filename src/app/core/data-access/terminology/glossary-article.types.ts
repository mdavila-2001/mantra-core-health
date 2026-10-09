/**
 * El artículo enciclopédico de un término del glosario.
 *
 * Espejo de `articles.ndjson` (TAREA-41 §12.3): una línea por término, con
 * secciones de texto **literal de una fuente**, imágenes con licencia y datos
 * estructurados. Ningún campo se redacta en el front: lo que no viene, no se
 * dibuja (§12.2.2).
 */

/** Catálogo de secciones de §12.3, incluidos los 11 transversales aprobados el 2026-10-09. */
export type GlossarySectionKind =
  | 'definition'
  | 'overview'
  | 'symptoms'
  | 'causes'
  | 'risk_factors'
  | 'diagnosis'
  | 'treatment_overview'
  | 'complications'
  | 'prevention'
  | 'prognosis'
  | 'when_to_seek_care'
  | 'epidemiology'
  | 'genetics'
  | 'classification'
  | 'associated_conditions'
  | 'red_flags'
  | 'self_care'
  | 'location'
  | 'structure'
  | 'function'
  | 'blood_supply'
  | 'innervation'
  | 'clinical_relevance'
  | 'related_structures'
  | 'indications'
  | 'contraindications'
  | 'adverse_effects'
  | 'interactions'
  | 'pregnancy_lactation'
  | 'special_populations'
  | 'pharmacologic_class'
  | 'presentations'
  | 'purpose'
  | 'preparation'
  | 'procedure_description'
  | 'risks'
  | 'interpretation'
  | 'reference_values'
  | 'recovery'
  | 'alternatives'
  | 'scope'
  | 'conditions_treated'
  | 'subspecialties'
  | 'training'
  | 'transmission'
  | 'side_effects'
  | 'effects'
  | 'benefits'
  | 'how_it_works'
  | 'safe_use'
  | 'what_to_expect'
  | 'importance'
  | 'considerations'
  | 'additional_information';

/** Por qué una sección sale como extracto: lo que la fuente trae y no se muestra. */
export interface GlossaryOmittedBlock {
  readonly reason: string;
  readonly paragraphs: number;
}

export interface GlossaryArticleSection {
  readonly kind: GlossarySectionKind;
  readonly text: string;
  readonly lang: 'es' | 'en';
  /** Elementos de lista de la fuente, uno por línea. */
  readonly items?: readonly string[];
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly retrievedAt: string;
  readonly sourceVersion: string;
  /** Título o anclaje de la sección de origen. */
  readonly locator: string;
  /** Sólo con los párrafos limpios; el resto se omitió (dosis, A.D.A.M.). */
  readonly excerpt?: boolean;
  readonly omitted?: readonly GlossaryOmittedBlock[];
  /** El texto es una tabla: una fila por línea, celdas unidas por « | ». */
  readonly table?: boolean;
}

export type GlossaryArticleImageMatch = 'name-match' | 'label-match';

export interface GlossaryArticleImage {
  readonly url: string;
  readonly thumbUrl: string;
  readonly kind: 'photo' | 'image' | 'diagram';
  readonly caption: string;
  readonly captionLang?: 'es' | 'en';
  readonly altText: string;
  readonly altTextQuality: 'caption' | 'generic';
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourcePage: string;
  readonly retrievedAt: string;
  /** Cómo se enlazó la imagen al término. `label-match` no se muestra sin revisión humana. */
  readonly match?: GlossaryArticleImageMatch;
  /** `false` = la canalización la dejó apagada. */
  readonly enabled?: boolean;
}

export interface GlossaryArticleFact {
  readonly label: string;
  readonly value: string;
  readonly source: string;
  readonly sourceUrl: string;
}

export interface GlossaryArticleReference {
  readonly title: string;
  readonly url: string;
  readonly source: string;
}

export interface GlossaryArticle {
  readonly conceptRef: {
    readonly system: string;
    readonly code: string;
    readonly slug: string;
  };
  readonly lang: 'es' | 'en';
  readonly sections: readonly GlossaryArticleSection[];
  readonly images: readonly GlossaryArticleImage[];
  readonly facts: readonly GlossaryArticleFact[];
  readonly references: readonly GlossaryArticleReference[];
}
