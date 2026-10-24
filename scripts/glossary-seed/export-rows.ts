/**
 * Exporta el glosario que hoy vive en los fixtures TypeScript —los 69 curados,
 * las capas de `data/glossary/` y el atlas anatómico— como filas de shard.
 *
 * Lo compila y corre `scripts/glossary-seed.mjs` con esbuild: así la semilla
 * sale de **los mismos** módulos que el simulador usaba (`glossary.ts`,
 * `anatomy.ts`, `anatomy-atlas.ts`), sin copiar su lógica y sin tocar su
 * contenido. Escribe el JSON por la salida estándar.
 */
import { CATEGORIES, LABELS, TERMS } from '../../src/app/core/mock/fixtures/glossary';
import { ENTRIES, inlineAnatomicalSheet, inlineEntry } from '../../src/app/core/mock/fixtures/anatomy';

const filas: Record<string, unknown>[] = [];

for (const termino of TERMS) {
  const propiedades: Record<string, unknown> = {};
  if (termino.drugFacts !== undefined) {
    // El NDC de los curados de farmacología viaja como hasta ahora, con los
    // cuatro códigos de `import-ndc.mjs`: `drugFacts` queda para CIMA.
    propiedades['active_ingredients'] = termino.drugFacts.activeIngredients;
    propiedades['dosage_form'] = termino.drugFacts.dosageForm;
    propiedades['route'] = termino.drugFacts.route;
    propiedades['manufacturer'] = termino.drugFacts.manufacturer;
  }
  filas.push({
    id: termino.id,
    slug: termino.slug,
    code: termino.externalCode?.code ?? termino.code,
    codeSystem: termino.externalCode?.system ?? 'glossary-curated-es',
    categoryKey: termino.categoryKey,
    tagKeys: termino.tagKeys,
    lang: termino.lang ?? 'es',
    esName: termino.esName,
    enDisplay: termino.enDisplay,
    ...(termino.esSynonyms === undefined ? {} : { esSynonyms: termino.esSynonyms }),
    definition: termino.clinicalDefinitionEs,
    plainSummaryEs: termino.plainSummaryEs,
    relations: termino.relations,
    ...(termino.symptomIds === undefined ? {} : { symptomIds: termino.symptomIds }),
    ...(termino.analysisCategory === undefined
      ? {}
      : { analysisCategory: termino.analysisCategory }),
    ...(termino.reviewStatus === undefined ? {} : { reviewStatus: termino.reviewStatus }),
    source: termino.source ?? 'alovida-curated',
    ...(Object.keys(propiedades).length === 0 ? {} : { properties: propiedades }),
  });
}

for (const entrada of ENTRIES) {
  const ficha = inlineAnatomicalSheet(entrada);
  filas.push({
    id: entrada.id,
    // En el simulador vivían en otro índice y podían repetir el slug de un
    // curado («corazon»); en shards el slug es único en todo el glosario. El
    // id —que es lo que va en los enlaces— no cambia.
    slug: `atlas-${entrada.slug}`,
    code: entrada.code,
    codeSystem: 'netter-atlas-index',
    categoryKey: 'anatomy',
    tagKeys: [],
    lang: 'es',
    esName: entrada.name,
    enDisplay: entrada.name,
    // Textos tal como los arma `anatomy.ts`: la definición es la del TIPO y
    // lo dice dentro del propio texto; la ubicación es lo que el Atlas publica.
    definition: ficha.clinicalDefinition.text,
    plainSummaryEs: inlineEntry(entrada).shortDefinition,
    relations: [],
    source: 'netter-atlas-index',
    reviewStatus: 'external-source',
    properties: ficha.properties,
  });
}

const taxonomia = {
  categories: CATEGORIES.map(({ key, internalCode, name }) => ({ key, internalCode, name })),
  tags: LABELS.map(({ key, internalCode, name }) => ({ key, internalCode, name })),
};

process.stdout.write(JSON.stringify({ filas, taxonomia }));
