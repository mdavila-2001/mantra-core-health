import { REGION_LABELS, PLATE_TERMS } from './anatomy-atlas';
import { uuid } from '../mock-store';
import {
  CATEGORIAS_DE_GLOSARIO,
  ETIQUETAS_DE_GLOSARIO,
  GLOSARIO_TODOS_LOS_TERMINOS,
  TERMINOS_DE_GLOSARIO,
  type EntradaDeTaxonomia,
  type TerminoDeGlosario,
} from './glossary.generated';

/* ============================================================================
    El glosario médico del backend simulado.

    Indexa el catálogo que porta `glossary.generated.ts` —12 categorías, 15
    etiquetas, los 69 términos curados con definición clínica, resumen llano,
    sinónimos y relaciones tipadas, **y las capas de `data/glossary/`**:
    enfermedades y análisis en castellano con código ICD-10-CM/LOINC, y las
    categorías ICD-10-CM completas en inglés— y le da la forma con la que
    viaja por la API real (`GET /terminology/value-sets` y
    `GET /terminology/concepts`).

    Los identificadores se derivan con `uuid()` a partir del código, igual que
    en `concepts.ts`: son estables entre recargas, así que un enlace a un
    término sigue sirviendo.

    Este archivo **indexa**; no declara contenido. Todo texto de un término
    viene del seed del backend — ver la cabecera del archivo generado.
    ========================================================================== */

/** El code system del catálogo curado, espejo de `glossary-curated-es`. */
export const GLOSSARY_CODE_SYSTEM_VERSION_ID = uuid('code-system-version-glossary-curated-es');

/** Un value set del glosario, con su identidad ya derivada. */
export interface GlossarySet extends EntradaDeTaxonomia {
  readonly id: string;
  readonly defaultVersionId: string;
}

/** Un término del glosario, indexado y con identidad. */
export interface GlossaryConcept extends TerminoDeGlosario {
  readonly id: string;
  /** `GLOSSARY_<SLUG>`, la misma fórmula que `glossary-seed.service.ts`. */
  readonly code: string;
}

function withSet(entrada: EntradaDeTaxonomia): GlossarySet {
  return {
    ...entrada,
    id: uuid(`value-set-${entrada.internalCode}`),
    defaultVersionId: uuid(`value-set-version-${entrada.internalCode}`),
  };
}

/** El código FHIR de un término, derivado de su slug — fórmula del backend. */
function codeOf(slug: string): string {
  return `GLOSSARY_${slug.toUpperCase().replace(/-/g, '_')}`;
}

/** Las 12 categorías, en el orden de la grilla (el del catálogo, no alfabético). */
export const CATEGORIES: readonly GlossarySet[] = CATEGORIAS_DE_GLOSARIO.map(withSet);

/** Las 16 etiquetas clínicas. */
/**
 * Las 16 etiquetas clínicas del catálogo, más las 8 regiones del atlas.
 *
 * Las regiones se suman acá y no en el generador del glosario porque no son
 * del mismo catálogo: salen de `data/anatomy-atlas/` y tienen su propio
 * generador. Lo que comparten es la forma, que es lo que permite que el
 * glosario las filtre sin enterarse de que vienen de otra parte.
 */
export const LABELS: readonly GlossarySet[] = [
  ...ETIQUETAS_DE_GLOSARIO,
  ...REGION_LABELS,
].map(withSet);

/** El value set paraguas: todo término es miembro de éste. */
export const UMBRELLA: GlossarySet = withSet(GLOSARIO_TODOS_LOS_TERMINOS);

/**
 * Los términos del glosario, ordenados alfabéticamente por su nombre en
 * castellano — el mismo orden que el backend aplica cuando se pide `lang`.
 *
 * Son los curados y las capas de `data/glossary/` (ver `CONTEO_DE_CAPAS`)
 * **más las 548 láminas** del atlas anatómico, que entran como términos de la
 * categoría Anatomía. Comparten tipo y orden: para el glosario no hay dos
 * clases de término, y por eso la búsqueda, la ficha y el filtro por etiqueta
 * funcionan igual para todos sin una línea de más.
 */
export const TERMS: readonly GlossaryConcept[] = [
  ...TERMINOS_DE_GLOSARIO,
  ...PLATE_TERMS,
]
  .map((termino) => ({
    ...termino,
    id: uuid(`concept-glossary-${termino.slug}`),
    code: codeOf(termino.slug),
  }))
  .sort((a, b) => a.esName.localeCompare(b.esName, 'es'));

/** {@link TERMS} con los traducidos adelante; el orden alfabético se conserva dentro de cada grupo. */
const TERMS_IN_FIRST_SPANISH: readonly GlossaryConcept[] = [
  ...TERMS.filter((t) => t.lang !== 'en'),
  ...TERMS.filter((t) => t.lang === 'en'),
];

const byId = new Map(TERMS.map((t) => [t.id, t]));
const bySlug = new Map(TERMS.map((t) => [t.slug, t]));
const categoryByKey = new Map(CATEGORIES.map((c) => [c.key, c]));
const labelByKey = new Map(LABELS.map((t) => [t.key, t]));
const setByInternalCode = new Map(
  [UMBRELLA, ...CATEGORIES, ...LABELS].map((c) => [c.internalCode, c]),
);
const setByIdentifier = new Map(
  [UMBRELLA, ...CATEGORIES, ...LABELS].flatMap((c) => [
    [c.id, c] as const,
    [c.defaultVersionId, c] as const,
  ]),
);

/** Un término por su identificador de concepto, o `undefined`. */
export function termById(id: string): GlossaryConcept | undefined {
  return byId.get(id);
}

/** Un término por su slug, o `undefined`. */
export function termBySlug(slug: string): GlossaryConcept | undefined {
  return bySlug.get(slug);
}

/** Un value set del glosario por su uuid (o el de su versión), o `undefined`. */
export function glossaryByIdSet(id: string): GlossarySet | undefined {
  return setByIdentifier.get(id);
}

/** Un value set del glosario por su código interno, o `undefined`. */
export function glossaryByCodeSet(internalCode: string): GlossarySet | undefined {
  return setByInternalCode.get(internalCode);
}

/** La categoría de un término. Siempre existe: el generador lo valida. */
export function termCategory(termino: GlossaryConcept): GlossarySet {
  const categoria = categoryByKey.get(termino.categoryKey);
  if (categoria === undefined) {
    throw new Error(`El término «${termino.slug}» declara una categoría inexistente.`);
  }
  return categoria;
}

/** Las etiquetas clínicas de un término, en el orden del catálogo. */
export function termLabels(termino: GlossaryConcept): readonly GlossarySet[] {
  return termino.tagKeys
    .map((clave) => labelByKey.get(clave))
    .filter((etiqueta): etiqueta is GlossarySet => etiqueta !== undefined);
}

/**
 * Los términos que pertenecen a un value set del glosario.
 *
 * Primero los que están en castellano y después los que sólo tienen su nombre
 * original en inglés, cada grupo en orden alfabético. La capa ICD-10-CM suma
 * casi dos mil categorías en inglés a «Enfermedades»: en orden alfabético puro
 * tapaban a las doscientas traducidas, que son las que se leen.
 */
export function setMembers(conjunto: GlossarySet): readonly GlossaryConcept[] {
  if (conjunto.internalCode === UMBRELLA.internalCode) return TERMS_IN_FIRST_SPANISH;
  if (conjunto.internalCode.startsWith('glossary-category-')) {
    return TERMS_IN_FIRST_SPANISH.filter((t) => t.categoryKey === conjunto.key);
  }
  return TERMS_IN_FIRST_SPANISH.filter((t) => t.tagKeys.includes(conjunto.key));
}

/**
 * Un término está traducido salvo que su capa lo declare en inglés.
 *
 * Los curados y las capas en castellano no llevan `lang` o llevan `es`; la
 * capa ancha de ICD-10-CM llega en inglés (`en`) y la pantalla lo dice en vez
 * de disimularlo.
 */
export function isTranslated(termino: Pick<GlossaryConcept, 'lang'>): boolean {
  return termino.lang !== 'en';
}

/** Cómo se llama en la ficha el sistema de codificación de un término. */
const SYSTEM_NAME: Readonly<Record<string, string>> = {
  icd10cm: 'ICD-10-CM',
  loinc: 'LOINC',
};

/**
 * La definición y el resumen de un término, como los muestra la ficha.
 *
 * Un término en inglés no trae definición ni resumen: su fuente publica sólo
 * el código y el nombre oficial, y acá no se fabrica ninguna (regla 97.4). La
 * ficha lo dice con todas las letras en vez de mostrar un párrafo vacío o,
 * peor, uno inventado. Los dos textos son metadatos, no contenido clínico.
 */
function textsOf(termino: GlossaryConcept): {
  clinicalDefinition: { text: string; translated: boolean };
  plainSummary: { text: string; translated: boolean };
} {
  if (isTranslated(termino)) {
    return {
      clinicalDefinition: { text: termino.clinicalDefinitionEs, translated: true },
      plainSummary: { text: termino.plainSummaryEs, translated: true },
    };
  }
  const sistema =
    termino.externalCode === undefined
      ? 'su sistema de codificación'
      : (SYSTEM_NAME[termino.externalCode.system] ?? termino.externalCode.system);
  const codigo = termino.externalCode === undefined ? '' : ` «${termino.externalCode.code}»`;
  return {
    clinicalDefinition: {
      text:
        `Sin definición cargada. La fuente de ${sistema} publica sólo el código${codigo} y el ` +
        'nombre oficial en inglés; no se escribe una definición sin fuente.',
      translated: true,
    },
    plainSummary: {
      text: `Categoría${codigo} de ${sistema}, con su nombre original: ${termino.enDisplay}.`,
      translated: true,
    },
  };
}

/**
 * Las propiedades extendidas de un término: lo que el contrato publica como
 * `properties` (`Record<string, unknown>`), con nombres en snake_case como
 * las cuatro del NDC. Sólo viajan las que el término tiene — una propiedad
 * ausente es correcta; una vacía confunde a quien la lee.
 */
function propertiesOf(termino: GlossaryConcept): Record<string, unknown> {
  const propiedades: Record<string, unknown> = {};
  if (termino.drugFacts !== undefined) {
    // Las cuatro propiedades del NDC, sólo en los términos de farmacología:
    // es de donde `drugFactsFrom()` arma la ficha de medicamento.
    propiedades['active_ingredients'] = termino.drugFacts.activeIngredients;
    propiedades['dosage_form'] = termino.drugFacts.dosageForm;
    propiedades['route'] = termino.drugFacts.route;
    propiedades['manufacturer'] = termino.drugFacts.manufacturer;
  }
  if (termino.externalCode !== undefined) {
    propiedades['external_code'] = termino.externalCode.code;
    propiedades['code_system'] = termino.externalCode.system;
  }
  if (termino.lang !== undefined) propiedades['lang'] = termino.lang;
  if (termino.reviewStatus !== undefined) propiedades['review_status'] = termino.reviewStatus;
  if (termino.source !== undefined) propiedades['source'] = termino.source;
  if (termino.symptomIds !== undefined && termino.symptomIds.length > 0) {
    propiedades['symptom_ids'] = [...termino.symptomIds];
  }
  if (termino.analysisCategory !== undefined) {
    propiedades['analysis_category'] = termino.analysisCategory;
  }
  return propiedades;
}

/* ---- las tres formas con las que el glosario viaja por la API ------------- */

/**
 * Un value set del glosario como lo devuelve `GET /terminology/value-sets`.
 *
 * `translatedMemberCount` dice cuántos de sus términos están en castellano:
 * sin él, la tarjeta de «Enfermedades» anunciaba más de dos mil términos
 * cuando casi todos son categorías ICD-10-CM con el título en inglés.
 */
export function inlineSet(conjunto: GlossarySet) {
  const miembros = setMembers(conjunto);
  return {
    id: conjunto.id,
    internalCode: conjunto.internalCode,
    name: conjunto.name,
    defaultVersionId: conjunto.defaultVersionId,
    memberCount: miembros.length,
    translatedMemberCount: miembros.filter(isTranslated).length,
  };
}

/** Una entrada del glosario, como la devuelve la búsqueda de términos. */
export function inlineTerm(termino: GlossaryConcept) {
  const categoria = termCategory(termino);
  const etiquetas = termLabels(termino);
  return {
    conceptId: termino.id,
    code: termino.code,
    display: termino.esName,
    slug: termino.slug,
    // Los curados y las capas en castellano vienen traducidos; la capa ancha
    // de ICD-10-CM llega en inglés y la lista lo marca.
    translated: isTranslated(termino),
    category: { internalCode: categoria.internalCode, name: categoria.name },
    // Lo mismo que el backend: la definición breve es el resumen llano.
    shortDefinition: termino.plainSummaryEs,
    tags: etiquetas.map((etiqueta) => etiqueta.name),
    relationsCount: termino.relations.length,
    status: 'active' as const,
    valueSets: [UMBRELLA, categoria, ...etiquetas].map((conjunto) => ({
      id: conjunto.id,
      internalCode: conjunto.internalCode,
      name: conjunto.name,
    })),
  };
}

/** La ficha completa de un término, como la devuelve `GET /terminology/concepts/:id`. */
export function inlineSheet(termino: GlossaryConcept) {
  const categoria = termCategory(termino);
  const etiquetas = termLabels(termino);
  const referencia = (conjunto: GlossarySet) => ({
    valueSetId: conjunto.id,
    internalCode: conjunto.internalCode,
    name: conjunto.name,
  });

  return {
    conceptId: termino.id,
    code: termino.code,
    display: termino.esName,
    slug: termino.slug,
    translated: isTranslated(termino),
    codeSystemVersionId: GLOSSARY_CODE_SYSTEM_VERSION_ID,
    valueSets: [UMBRELLA, categoria, ...etiquetas].map((conjunto) => ({
      id: conjunto.id,
      internalCode: conjunto.internalCode,
      name: conjunto.name,
    })),
    // El nombre en inglés del catálogo es una denominación más del término, no
    // un sinónimo en castellano: viaja con su idioma declarado, que es lo que
    // la ficha muestra entre paréntesis. Si el nombre ya es el inglés (capa
    // sin traducir), repetirlo como sinónimo no informa.
    synonyms: [
      ...(termino.esSynonyms ?? []).map((valor) => ({
        value: valor,
        language: 'ES',
        preferred: false,
      })),
      ...(termino.enDisplay === termino.esName
        ? []
        : [{ value: termino.enDisplay, language: 'EN', preferred: false }]),
    ],
    category: referencia(categoria),
    tags: etiquetas.map(referencia),
    ...textsOf(termino),
    relations: termino.relations.flatMap((relacion) => {
      const destino = bySlug.get(relacion.targetSlug);
      // El generador ya descarta las huérfanas; esto es la segunda barrera.
      return destino === undefined
        ? []
        : [
            {
              type: relacion.type,
              conceptId: destino.id,
              slug: destino.slug,
              display: destino.esName,
            },
          ];
    }),
    properties: propertiesOf(termino),
  };
}
