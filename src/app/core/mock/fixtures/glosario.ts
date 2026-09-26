import { ETIQUETAS_DE_REGION, TERMINOS_DE_LAMINA } from './anatomia-atlas';
import { uuid } from '../mock-store';
import {
  CATEGORIAS_DE_GLOSARIO,
  ETIQUETAS_DE_GLOSARIO,
  GLOSARIO_TODOS_LOS_TERMINOS,
  TERMINOS_DE_GLOSARIO,
  type EntradaDeTaxonomia,
  type TerminoDeGlosario,
} from './glosario.generated';

/* ============================================================================
    El glosario médico del backend simulado.

    Indexa el catálogo que porta `glosario.generated.ts` —12 categorías, 15
    etiquetas, los 69 términos curados con definición clínica, resumen llano,
    sinónimos y relaciones tipadas, **y las capas de `data/glossary/`**:
    enfermedades y análisis en castellano con código ICD-10-CM/LOINC, y las
    categorías ICD-10-CM completas en inglés— y le da la forma con la que
    viaja por la API real (`GET /terminology/value-sets` y
    `GET /terminology/concepts`).

    Los identificadores se derivan con `uuid()` a partir del código, igual que
    en `conceptos.ts`: son estables entre recargas, así que un enlace a un
    término sigue sirviendo.

    Este archivo **indexa**; no declara contenido. Todo texto de un término
    viene del seed del backend — ver la cabecera del archivo generado.
    ========================================================================== */

/** El code system del catálogo curado, espejo de `glossary-curated-es`. */
export const GLOSARIO_CODE_SYSTEM_VERSION_ID = uuid('code-system-version-glossary-curated-es');

/** Un value set del glosario, con su identidad ya derivada. */
export interface ConjuntoDeGlosario extends EntradaDeTaxonomia {
  readonly id: string;
  readonly defaultVersionId: string;
}

/** Un término del glosario, indexado y con identidad. */
export interface ConceptoDeGlosario extends TerminoDeGlosario {
  readonly id: string;
  /** `GLOSSARY_<SLUG>`, la misma fórmula que `glossary-seed.service.ts`. */
  readonly code: string;
}

function conConjunto(entrada: EntradaDeTaxonomia): ConjuntoDeGlosario {
  return {
    ...entrada,
    id: uuid(`value-set-${entrada.internalCode}`),
    defaultVersionId: uuid(`value-set-version-${entrada.internalCode}`),
  };
}

/** El código FHIR de un término, derivado de su slug — fórmula del backend. */
function codigoDe(slug: string): string {
  return `GLOSSARY_${slug.toUpperCase().replace(/-/g, '_')}`;
}

/** Las 12 categorías, en el orden de la grilla (el del catálogo, no alfabético). */
export const CATEGORIAS: readonly ConjuntoDeGlosario[] = CATEGORIAS_DE_GLOSARIO.map(conConjunto);

/** Las 15 etiquetas clínicas. */
/**
 * Las 15 etiquetas clínicas del catálogo, más las 8 regiones del atlas.
 *
 * Las regiones se suman acá y no en el generador del glosario porque no son
 * del mismo catálogo: salen de `data/anatomy-atlas/` y tienen su propio
 * generador. Lo que comparten es la forma, que es lo que permite que el
 * glosario las filtre sin enterarse de que vienen de otra parte.
 */
export const ETIQUETAS: readonly ConjuntoDeGlosario[] = [
  ...ETIQUETAS_DE_GLOSARIO,
  ...ETIQUETAS_DE_REGION,
].map(conConjunto);

/** El value set paraguas: todo término es miembro de éste. */
export const PARAGUAS: ConjuntoDeGlosario = conConjunto(GLOSARIO_TODOS_LOS_TERMINOS);

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
export const TERMINOS: readonly ConceptoDeGlosario[] = [
  ...TERMINOS_DE_GLOSARIO,
  ...TERMINOS_DE_LAMINA,
]
  .map((termino) => ({
    ...termino,
    id: uuid(`concept-glossary-${termino.slug}`),
    code: codigoDe(termino.slug),
  }))
  .sort((a, b) => a.esName.localeCompare(b.esName, 'es'));

const porId = new Map(TERMINOS.map((t) => [t.id, t]));
const porSlug = new Map(TERMINOS.map((t) => [t.slug, t]));
const categoriaPorClave = new Map(CATEGORIAS.map((c) => [c.key, c]));
const etiquetaPorClave = new Map(ETIQUETAS.map((t) => [t.key, t]));
const conjuntoPorCodigoInterno = new Map(
  [PARAGUAS, ...CATEGORIAS, ...ETIQUETAS].map((c) => [c.internalCode, c]),
);
const conjuntoPorIdentificador = new Map(
  [PARAGUAS, ...CATEGORIAS, ...ETIQUETAS].flatMap((c) => [
    [c.id, c] as const,
    [c.defaultVersionId, c] as const,
  ]),
);

/** Un término por su identificador de concepto, o `undefined`. */
export function terminoPorId(id: string): ConceptoDeGlosario | undefined {
  return porId.get(id);
}

/** Un término por su slug, o `undefined`. */
export function terminoPorSlug(slug: string): ConceptoDeGlosario | undefined {
  return porSlug.get(slug);
}

/** Un value set del glosario por su uuid (o el de su versión), o `undefined`. */
export function conjuntoDeGlosarioPorId(id: string): ConjuntoDeGlosario | undefined {
  return conjuntoPorIdentificador.get(id);
}

/** Un value set del glosario por su código interno, o `undefined`. */
export function conjuntoDeGlosarioPorCodigo(internalCode: string): ConjuntoDeGlosario | undefined {
  return conjuntoPorCodigoInterno.get(internalCode);
}

/** La categoría de un término. Siempre existe: el generador lo valida. */
export function categoriaDeTermino(termino: ConceptoDeGlosario): ConjuntoDeGlosario {
  const categoria = categoriaPorClave.get(termino.categoryKey);
  if (categoria === undefined) {
    throw new Error(`El término «${termino.slug}» declara una categoría inexistente.`);
  }
  return categoria;
}

/** Las etiquetas clínicas de un término, en el orden del catálogo. */
export function etiquetasDeTermino(termino: ConceptoDeGlosario): readonly ConjuntoDeGlosario[] {
  return termino.tagKeys
    .map((clave) => etiquetaPorClave.get(clave))
    .filter((etiqueta): etiqueta is ConjuntoDeGlosario => etiqueta !== undefined);
}

/** Los términos que pertenecen a un value set del glosario. */
export function miembrosDeConjunto(conjunto: ConjuntoDeGlosario): readonly ConceptoDeGlosario[] {
  if (conjunto.internalCode === PARAGUAS.internalCode) return TERMINOS;
  if (conjunto.internalCode.startsWith('glossary-category-')) {
    return TERMINOS.filter((t) => t.categoryKey === conjunto.key);
  }
  return TERMINOS.filter((t) => t.tagKeys.includes(conjunto.key));
}

/**
 * Un término está traducido salvo que su capa lo declare en inglés.
 *
 * Los curados y las capas en castellano no llevan `lang` o llevan `es`; la
 * capa ancha de ICD-10-CM llega en inglés (`en`) y la pantalla lo dice en vez
 * de disimularlo.
 */
function estaTraducido(termino: ConceptoDeGlosario): boolean {
  return termino.lang !== 'en';
}

/** Cómo se llama en la ficha el sistema de codificación de un término. */
const NOMBRE_DE_SISTEMA: Readonly<Record<string, string>> = {
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
function textosDe(termino: ConceptoDeGlosario): {
  clinicalDefinition: { text: string; translated: boolean };
  plainSummary: { text: string; translated: boolean };
} {
  if (estaTraducido(termino)) {
    return {
      clinicalDefinition: { text: termino.clinicalDefinitionEs, translated: true },
      plainSummary: { text: termino.plainSummaryEs, translated: true },
    };
  }
  const sistema =
    termino.externalCode === undefined
      ? 'su sistema de codificación'
      : (NOMBRE_DE_SISTEMA[termino.externalCode.system] ?? termino.externalCode.system);
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
function propiedadesDe(termino: ConceptoDeGlosario): Record<string, unknown> {
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

/** Un value set del glosario como lo devuelve `GET /terminology/value-sets`. */
export function conjuntoEnLinea(conjunto: ConjuntoDeGlosario) {
  return {
    id: conjunto.id,
    internalCode: conjunto.internalCode,
    name: conjunto.name,
    defaultVersionId: conjunto.defaultVersionId,
    memberCount: miembrosDeConjunto(conjunto).length,
  };
}

/** Una entrada del glosario, como la devuelve la búsqueda de términos. */
export function terminoEnLinea(termino: ConceptoDeGlosario) {
  const categoria = categoriaDeTermino(termino);
  const etiquetas = etiquetasDeTermino(termino);
  return {
    conceptId: termino.id,
    code: termino.code,
    display: termino.esName,
    slug: termino.slug,
    // Los curados y las capas en castellano vienen traducidos; la capa ancha
    // de ICD-10-CM llega en inglés y la lista lo marca.
    translated: estaTraducido(termino),
    category: { internalCode: categoria.internalCode, name: categoria.name },
    // Lo mismo que el backend: la definición breve es el resumen llano.
    shortDefinition: termino.plainSummaryEs,
    tags: etiquetas.map((etiqueta) => etiqueta.name),
    relationsCount: termino.relations.length,
    status: 'active' as const,
    valueSets: [PARAGUAS, categoria, ...etiquetas].map((conjunto) => ({
      id: conjunto.id,
      internalCode: conjunto.internalCode,
      name: conjunto.name,
    })),
  };
}

/** La ficha completa de un término, como la devuelve `GET /terminology/concepts/:id`. */
export function fichaEnLinea(termino: ConceptoDeGlosario) {
  const categoria = categoriaDeTermino(termino);
  const etiquetas = etiquetasDeTermino(termino);
  const referencia = (conjunto: ConjuntoDeGlosario) => ({
    valueSetId: conjunto.id,
    internalCode: conjunto.internalCode,
    name: conjunto.name,
  });

  return {
    conceptId: termino.id,
    code: termino.code,
    display: termino.esName,
    slug: termino.slug,
    translated: estaTraducido(termino),
    codeSystemVersionId: GLOSARIO_CODE_SYSTEM_VERSION_ID,
    valueSets: [PARAGUAS, categoria, ...etiquetas].map((conjunto) => ({
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
    ...textosDe(termino),
    relations: termino.relations.flatMap((relacion) => {
      const destino = porSlug.get(relacion.targetSlug);
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
    properties: propiedadesDe(termino),
  };
}
