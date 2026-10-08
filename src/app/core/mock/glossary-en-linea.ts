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
export const GLOSARIO_CODE_SYSTEM_VERSION_ID = uuid('code-system-version-glossary-curated-es');

/** Sistemas cuyo `code` es la clave de la plataforma, no un código externo publicable. */
const SISTEMAS_INTERNOS: ReadonlySet<string> = new Set([
  'glossary-curated-es',
  'netter-atlas-index',
]);

interface Conjunto {
  readonly internalCode: string;
  readonly name: string;
}

function referencia(conjunto: Conjunto) {
  return { id: idDeConjunto(conjunto.internalCode), internalCode: conjunto.internalCode, name: conjunto.name };
}

function referenciaConUuid(conjunto: Conjunto) {
  return {
    valueSetId: idDeConjunto(conjunto.internalCode),
    internalCode: conjunto.internalCode,
    name: conjunto.name,
  };
}

/** Categoría y etiquetas de una fila, resueltas contra el manifiesto. */
function taxonomiaDe(fila: FilaDeGlosario, manifiesto: ManifiestoDelGlosario) {
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
export function imagenDe(fila: FilaDeGlosario) {
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
export function conjuntosEnLinea(manifiesto: ManifiestoDelGlosario) {
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
export function facetasEnLinea(manifiesto: ManifiestoDelGlosario) {
  const etiquetaPorClave = new Map(manifiesto.tags.map((t) => [t.key, t]));
  const porFrecuencia = <T extends { count: number; name: string }>(a: T, b: T) =>
    b.count - a.count || a.name.localeCompare(b.name, 'es');

  const categories = manifiesto.categories
    .filter((categoria) => categoria.count > 0)
    .map((categoria) => ({
      ...referencia(categoria),
      ...(categoria.description === undefined ? {} : { description: categoria.description }),
      count: categoria.count,
      ...(categoria.translatedCount === undefined
        ? {}
        : { translatedCount: categoria.translatedCount }),
      tags: Object.entries(categoria.tags)
        .flatMap(([clave, count]) => {
          const etiqueta = etiquetaPorClave.get(clave);
          return etiqueta === undefined || count === 0 ? [] : [{ ...referencia(etiqueta), count }];
        })
        .sort(porFrecuencia),
    }));
  const tags = manifiesto.tags
    .filter((etiqueta) => etiqueta.count > 0)
    .map((etiqueta) => ({ ...referencia(etiqueta), count: etiqueta.count }))
    .sort(porFrecuencia);
  return { categories, tags, total: manifiesto.total };
}

/** Una entrada de la lista, como la devuelve la búsqueda del glosario. */
export function terminoEnLinea(fila: FilaDeGlosario, manifiesto: ManifiestoDelGlosario) {
  const { categoria, etiquetas } = taxonomiaDe(fila, manifiesto);
  const imagen = imagenDe(fila);
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
    valueSets: [PARAGUAS_DEL_GLOSARIO, categoria, ...etiquetas].map(referencia),
    ...(imagen === undefined
      ? {}
      : { imageThumbnailUrl: imagen.thumbnailSource ?? imagen.source }),
  };
}

/** Las propiedades de la ficha: las que la fila trae, con los códigos de la API. */
function propiedadesDe(fila: FilaDeGlosario): Record<string, unknown> {
  const propiedades: Record<string, unknown> = { ...(fila.properties ?? {}) };
  if (fila.code !== undefined && fila.codeSystem !== undefined && !SISTEMAS_INTERNOS.has(fila.codeSystem)) {
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
  const imagen = imagenDe(fila);
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
export function fichaEnLinea(fila: FilaDeGlosario, manifiesto: ManifiestoDelGlosario) {
  const { categoria, etiquetas } = taxonomiaDe(fila, manifiesto);
  const imagen = imagenDe(fila);
  return {
    conceptId: fila.id,
    code: fila.code ?? '',
    display: fila.esName,
    slug: fila.slug,
    translated: fila.lang !== 'en',
    codeSystemVersionId: GLOSARIO_CODE_SYSTEM_VERSION_ID,
    valueSets: [PARAGUAS_DEL_GLOSARIO, categoria, ...etiquetas].map(referencia),
    // El nombre en inglés es una denominación más, con su idioma declarado. Si
    // ya es el nombre que se muestra (capa sin traducir), repetirlo no informa.
    synonyms: [
      ...(fila.esSynonyms ?? []).map((value) => ({ value, language: 'ES', preferred: false })),
      ...(!fila.enDisplay || fila.enDisplay === fila.esName
        ? []
        : [{ value: fila.enDisplay, language: 'EN', preferred: false }]),
    ],
    category: referenciaConUuid(categoria),
    tags: etiquetas.map(referenciaConUuid),
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
    properties: propiedadesDe(fila),
    ...(imagen === undefined ? {} : { image: imagen }),
  };
}

/* ---- vecindario del mapa (TAREA-41 §5) ------------------------------------- */

/** Los tipos de relación que el contrato publica; uno desconocido no viaja. */
export const TIPOS_DEL_VECINDARIO: ReadonlySet<string> = new Set([
  'RELATED_TERM',
  'DISEASE',
  'PROCEDURE',
  'TREATMENT',
  'ANATOMY',
  'DIAGNOSTIC_TEST',
  'SYMPTOM',
  'SPECIALTY',
  'INCLUDES',
  'PERFORMS',
  'SENDS_DATA_TO',
]);

export const VECINOS_POR_GRUPO = { porDefecto: 8, minimo: 1, maximo: 50 } as const;
export const PAGINA_DE_GRUPO = { porDefecto: 50, minimo: 1, maximo: 200 } as const;

/** Un vecino ya resuelto, venga de una relación saliente o entrante. */
export interface VecinoSimulado {
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly conceptId: string;
  readonly slug: string;
  readonly display: string;
  readonly categoryKey: string | null;
}

/** Qué parte del vecindario se pidió. */
export type PedidoDeVecindario =
  | { readonly modo: 'muestra'; readonly porGrupo: number }
  | {
      readonly modo: 'grupo';
      readonly type: string;
      readonly direction: 'outgoing' | 'incoming';
      readonly offset: number;
      readonly limit: number;
    };

/**
 * El vecindario como lo devuelve `GET /terminology/concepts/:id/glossary-neighborhood`.
 *
 * Agrupa por tipo y sentido, descarta las autorreferencias y los tipos que el
 * contrato no publica, y saca los repetidos dentro de un grupo. El orden es
 * alfabético (`es`) hasta que las relaciones traigan peso (TAREA-41 F1).
 */
export function vecindarioEnLinea(
  foco: FilaDeGlosario,
  manifiesto: ManifiestoDelGlosario,
  vecinos: readonly VecinoSimulado[],
  pedido: PedidoDeVecindario,
) {
  const grupos = new Map<string, Map<string, VecinoSimulado>>();
  for (const vecino of vecinos) {
    if (vecino.conceptId === foco.id || !TIPOS_DEL_VECINDARIO.has(vecino.type)) continue;
    if (pedido.modo === 'grupo' && (vecino.type !== pedido.type || vecino.direction !== pedido.direction)) {
      continue;
    }
    const clave = `${vecino.type}|${vecino.direction}`;
    if (!grupos.has(clave)) grupos.set(clave, new Map());
    grupos.get(clave)!.set(vecino.conceptId, vecino);
  }

  const categoria = (key: string | null) => {
    const encontrada = key === null ? undefined : manifiesto.categories.find((c) => c.key === key);
    return encontrada === undefined ? null : { internalCode: encontrada.internalCode, name: encontrada.name };
  };
  const termino = terminoEnLinea(foco, manifiesto);

  return {
    focus: {
      conceptId: termino.conceptId,
      slug: termino.slug,
      display: termino.display,
      category: termino.category,
      shortDefinition: termino.shortDefinition ?? '',
    },
    groups: [...grupos.values()].map((porId) => {
      const todos = [...porId.values()].sort((a, b) => a.display.localeCompare(b.display, 'es'));
      const desde = pedido.modo === 'grupo' ? pedido.offset : 0;
      const cuantos = pedido.modo === 'grupo' ? pedido.limit : pedido.porGrupo;
      const primero = todos[0]!;
      return {
        type: primero.type,
        direction: primero.direction,
        total: todos.length,
        items: todos.slice(desde, desde + cuantos).map((vecino) => ({
          conceptId: vecino.conceptId,
          slug: vecino.slug,
          display: vecino.display,
          category: categoria(vecino.categoryKey),
        })),
      };
    }),
  };
}
