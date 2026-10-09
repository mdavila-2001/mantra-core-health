import {
  idDeConjunto,
  idDeVersion,
  PARAGUAS_DEL_GLOSARIO,
  type FilaDeGlosario,
  type ManifiestoDelGlosario,
} from './glossary-shards';
import { uuid } from './mock-store';

/* ============================================================================
    Las formas con las que el glosario viaja por la API, armadas desde una
    fila de shard: el value set (`GET /terminology/value-sets`), las facetas
    (`GET /terminology/value-sets/$glossary-facets`), la entrada de la lista y
    la ficha (`GET /terminology/concepts` y `/:id`).

    Es la contraparte de `ConceptsService` y `ValueSetsService` de la API
    (rama `justin/glosario-es-lectura`). Todo texto sale de la fila: acá no se
    escribe contenido. En particular, **un término sin definición viaja sin
    definición** — la ficha dice que falta y por qué; el simulador no inventa
    el párrafo (antes lo hacía para la capa en inglés).
    ========================================================================== */

/** El code system del catálogo curado, espejo de `glossary-curated-es`. */
export const GLOSSARY_CODE_SYSTEM_VERSION_ID = uuid('code-system-version-glossary-curated-es');

/** Sistemas cuyo `code` es la clave de la plataforma, no un código externo publicable. */
const INTERNAL_SYSTEMS: ReadonlySet<string> = new Set([
  'glossary-curated-es',
  'netter-atlas-index',
]);

interface Conjunto {
  readonly internalCode: string;
  readonly name: string;
}

function reference(conjunto: Conjunto) {
  return { id: idDeConjunto(conjunto.internalCode), internalCode: conjunto.internalCode, name: conjunto.name };
}

function referenceWithUuid(conjunto: Conjunto) {
  return {
    valueSetId: idDeConjunto(conjunto.internalCode),
    internalCode: conjunto.internalCode,
    name: conjunto.name,
  };
}

/** Categoría y etiquetas de una fila, resueltas contra el manifiesto. */
function taxonomyOf(fila: FilaDeGlosario, manifiesto: ManifiestoDelGlosario) {
  const categoria = manifiesto.categories.find((c) => c.key === fila.categoryKey) ?? {
    internalCode: `glossary-category-${fila.categoryKey}`,
    name: fila.categoryKey,
  };
  const etiquetas = fila.tagKeys.flatMap((clave) => {
    const etiqueta = manifiesto.tags.find((t) => t.key === clave);
    return etiqueta === undefined ? [] : [etiqueta];
  });
  return { categoria, etiquetas };
}

/**
 * La imagen publicable de una fila, o `undefined`.
 *
 * Mismo criterio que `imageFromProperty` de la API: sin URL, atribución o
 * licencia no se publica. Una foto sin crédito no se muestra.
 */
export function imageOf(fila: FilaDeGlosario) {
  // Los importadores escriben `null` donde no hay imagen (SCHEMA.md): null y
  // ausente valen lo mismo.
  if (!fila.imageUrl || !fila.imageAttribution || !fila.imageLicense) {
    return undefined;
  }
  return {
    source: fila.imageUrl,
    ...(fila.imageThumbUrl ? { thumbnailSource: fila.imageThumbUrl } : {}),
    attribution: fila.imageAttribution,
    license: fila.imageLicense,
    ...(fila.imageSourcePage ? { sourcePage: fila.imageSourcePage } : {}),
    alt: `Imagen ilustrativa: ${fila.esName}`,
    status: 'approved' as const,
  };
}

/** Los value sets del glosario, como los devuelve el listado de conjuntos. */
export function inlineSets(manifiesto: ManifiestoDelGlosario) {
  const linea = (
    conjunto: Conjunto & { readonly count: number; readonly translatedCount?: number },
  ) => ({
    id: idDeConjunto(conjunto.internalCode),
    internalCode: conjunto.internalCode,
    name: conjunto.name,
    defaultVersionId: idDeVersion(conjunto.internalCode),
    memberCount: conjunto.count,
    // Cuántos de sus términos están en castellano: el mismo campo que publica
    // `justin/glosario-correcciones` para que la tarjeta no presuma un total
    // que en buena parte son nombres en inglés.
    ...(conjunto.translatedCount === undefined
      ? {}
      : { translatedMemberCount: conjunto.translatedCount }),
  });
  return [
    linea({
      ...PARAGUAS_DEL_GLOSARIO,
      count: manifiesto.total,
      ...(manifiesto.translatedTotal === undefined
        ? {}
        : { translatedCount: manifiesto.translatedTotal }),
    }),
    ...manifiesto.categories.map(linea),
    ...manifiesto.tags.map(linea),
  ];
}

/** Las facetas, como las devuelve `GET /terminology/value-sets/$glossary-facets`. */
export function inlineFacets(manifiesto: ManifiestoDelGlosario) {
  const etiquetaPorClave = new Map(manifiesto.tags.map((t) => [t.key, t]));
  const porFrecuencia = <T extends { count: number; name: string }>(a: T, b: T) =>
    b.count - a.count || a.name.localeCompare(b.name, 'es');

  const categories = manifiesto.categories
    .filter((categoria) => categoria.count > 0)
    .map((categoria) => ({
      ...reference(categoria),
      ...(categoria.description === undefined ? {} : { description: categoria.description }),
      count: categoria.count,
      ...(categoria.translatedCount === undefined
        ? {}
        : { translatedCount: categoria.translatedCount }),
      tags: Object.entries(categoria.tags)
        .flatMap(([clave, count]) => {
          const etiqueta = etiquetaPorClave.get(clave);
          return etiqueta === undefined || count === 0 ? [] : [{ ...reference(etiqueta), count }];
        })
        .sort(porFrecuencia),
    }));
  const tags = manifiesto.tags
    .filter((etiqueta) => etiqueta.count > 0)
    .map((etiqueta) => ({ ...reference(etiqueta), count: etiqueta.count }))
    .sort(porFrecuencia);
  return { categories, tags, total: manifiesto.total };
}

/** Una entrada de la lista, como la devuelve la búsqueda del glosario. */
export function inlineTerm(fila: FilaDeGlosario, manifiesto: ManifiestoDelGlosario) {
  const { categoria, etiquetas } = taxonomyOf(fila, manifiesto);
  const imagen = imageOf(fila);
  return {
    conceptId: fila.id,
    code: fila.code ?? '',
    display: fila.esName,
    slug: fila.slug,
    translated: fila.lang !== 'en',
    category: { internalCode: categoria.internalCode, name: categoria.name },
    // La definición breve es el resumen llano; lo importado no trae resumen
    // (no se redacta nada), así que cae a la frase descriptiva oficial de la
    // fuente y, si tampoco, a la definición verbatim (la tarjeta la corta a
    // cuatro líneas). Todo texto de la fuente, ninguno escrito acá.
    shortDefinition: fila.plainSummaryEs || fila.metaDescription || fila.definition,
    tags: etiquetas.map((etiqueta) => etiqueta.name),
    relationsCount: fila.relations.length,
    status: 'active' as const,
    valueSets: [PARAGUAS_DEL_GLOSARIO, categoria, ...etiquetas].map(reference),
    ...(imagen === undefined
      ? {}
      : { imageThumbnailUrl: imagen.thumbnailSource ?? imagen.source }),
  };
}

/** Las propiedades de la ficha: las que la fila trae, con los códigos de la API. */
function propertiesOf(fila: FilaDeGlosario): Record<string, unknown> {
  const propiedades: Record<string, unknown> = { ...(fila.properties ?? {}) };
  if (fila.code !== undefined && fila.codeSystem !== undefined && !INTERNAL_SYSTEMS.has(fila.codeSystem)) {
    propiedades['external_code'] = fila.code;
    propiedades['code_system'] = fila.codeSystem;
  }
  propiedades['lang'] = fila.lang;
  if (fila.reviewStatus !== undefined) propiedades['review_status'] = fila.reviewStatus;
  if (fila.source !== undefined) propiedades['source'] = fila.source;
  if (fila.sourceName !== undefined) propiedades['source_name'] = fila.sourceName;
  if (fila.sourceLicense !== undefined) propiedades['source_license'] = fila.sourceLicense;
  if (fila.definitionSource !== undefined && fila.definitionSource !== null) {
    propiedades['definition_source'] = fila.definitionSource;
  }
  if (typeof fila.definitionKind === 'string') propiedades['definition_kind'] = fila.definitionKind;
  if (Array.isArray(fila.sections) && fila.sections.length > 0) {
    propiedades['sections'] = fila.sections;
  }
  if (fila.sourceUrl) propiedades['source_url'] = fila.sourceUrl;
  if (fila.sourceRetrievedAt) {
    propiedades['source_retrieved_at'] = fila.sourceRetrievedAt;
  }
  if (fila.symptomIds !== undefined && fila.symptomIds.length > 0) {
    propiedades['symptom_ids'] = [...fila.symptomIds];
  }
  if (fila.analysisCategory !== undefined) {
    propiedades['analysis_category'] = fila.analysisCategory;
  }
  if (fila.drugFacts !== undefined && fila.drugFacts !== null) {
    propiedades['drug_facts'] = fila.drugFacts;
  }
  const imagen = imageOf(fila);
  if (imagen !== undefined) {
    propiedades['glossary-image'] = {
      url: imagen.source,
      thumbUrl: imagen.thumbnailSource,
      attribution: imagen.attribution,
      license: imagen.license,
      sourcePage: imagen.sourcePage,
    };
  }
  return propiedades;
}

/** La ficha completa, como la devuelve `GET /terminology/concepts/:id`. */
export function inlineSheet(fila: FilaDeGlosario, manifiesto: ManifiestoDelGlosario) {
  const { categoria, etiquetas } = taxonomyOf(fila, manifiesto);
  const imagen = imageOf(fila);
  return {
    conceptId: fila.id,
    code: fila.code ?? '',
    display: fila.esName,
    slug: fila.slug,
    translated: fila.lang !== 'en',
    codeSystemVersionId: GLOSSARY_CODE_SYSTEM_VERSION_ID,
    valueSets: [PARAGUAS_DEL_GLOSARIO, categoria, ...etiquetas].map(reference),
    // El nombre en inglés es una denominación más, con su idioma declarado. Si
    // ya es el nombre que se muestra (capa sin traducir), repetirlo no informa.
    synonyms: [
      ...(fila.esSynonyms ?? []).map((value) => ({ value, language: 'ES', preferred: false })),
      ...(!fila.enDisplay || fila.enDisplay === fila.esName
        ? []
        : [{ value: fila.enDisplay, language: 'EN', preferred: false }]),
    ],
    category: referenceWithUuid(categoria),
    tags: etiquetas.map(referenceWithUuid),
    ...(fila.definition === ''
      ? {}
      : { clinicalDefinition: { text: fila.definition, translated: fila.lang !== 'en' } }),
    ...(fila.plainSummaryEs === ''
      ? {}
      : { plainSummary: { text: fila.plainSummaryEs, translated: true } }),
    relations: fila.relations.map((relacion) => ({
      type: relacion.type,
      conceptId: relacion.targetId,
      slug: relacion.targetSlug,
      display: relacion.targetName,
    })),
    properties: propertiesOf(fila),
    ...(imagen === undefined ? {} : { image: imagen }),
  };
}
