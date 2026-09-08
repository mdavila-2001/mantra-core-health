import {
  CODE_SYSTEM_ID,
  CODE_SYSTEM_VERSION_ID,
  conceptoPorId,
  conceptos,
  conjuntoPorId,
  miembrosDe,
  slugDe,
  todosLosConjuntos,
  type ConceptoSimulado,
} from '../fixtures/conceptos';
import { notFound, type MockRouter } from '../mock-router';
import { contiene, iso, paginar, texto } from '../mock-store';

/* ============================================================================
    Terminología: conjuntos de valores, conceptos, etiquetas y el glosario.
    ========================================================================== */

const CATEGORIAS_GLOSARIO: Readonly<Record<string, string>> = {
  'glossary-diseases': 'Enfermedades',
  'glossary-symptoms': 'Síntomas',
  'glossary-procedures': 'Procedimientos',
  'glossary-medications': 'Medicamentos',
  'glossary-anatomy': 'Anatomía',
  'glossary-tests': 'Estudios diagnósticos',
  'glossary-other': 'Otros términos',
};

function opcion(c: ConceptoSimulado) {
  return {
    conceptId: c.id,
    code: c.code,
    display: c.display,
    ...(c.definition === undefined ? {} : { definition: c.definition }),
    selectable: c.selectable,
    codeSystemVersionId: CODE_SYSTEM_VERSION_ID,
    ordinal: c.ordinal,
  };
}

function categoriaDe(c: ConceptoSimulado): { internalCode: string; name: string } | null {
  const vs = c.valueSets.find((v) => v.startsWith('glossary-') && v !== 'glossary-all-terms');
  return vs === undefined ? null : { internalCode: vs, name: CATEGORIAS_GLOSARIO[vs] ?? vs };
}

function terminoDeGlosario(c: ConceptoSimulado) {
  const categoria = categoriaDe(c);
  return {
    conceptId: c.id,
    code: c.code,
    display: c.display,
    slug: slugDe(c.display),
    translated: true,
    category: categoria,
    shortDefinition: c.definition ?? `Término del catálogo: ${c.display}.`,
    tags: categoria === null ? [] : [categoria.name],
    relationsCount: relacionesDe(c).length,
    status: 'active' as const,
    valueSets: c.valueSets
      .filter((v) => v.startsWith('glossary-'))
      .map((v) => ({ id: conjuntoPorId(v)?.id ?? v, internalCode: v, name: CATEGORIAS_GLOSARIO[v] ?? 'Glosario' })),
  };
}

function relacionesDe(c: ConceptoSimulado) {
  const categoria = categoriaDe(c);
  if (categoria === null) return [];
  const tipo =
    categoria.internalCode === 'glossary-diseases'
      ? 'TREATMENT'
      : categoria.internalCode === 'glossary-medications'
        ? 'DISEASE'
        : 'RELATED_TERM';
  const destino =
    categoria.internalCode === 'glossary-diseases'
      ? 'glossary-medications'
      : categoria.internalCode === 'glossary-medications'
        ? 'glossary-diseases'
        : 'glossary-symptoms';
  return miembrosDe(destino)
    .slice(c.ordinal % 3, (c.ordinal % 3) + 3)
    .map((r) => ({ type: tipo, conceptId: r.id, slug: slugDe(r.display), display: r.display }));
}

export function registrarTerminologia(router: MockRouter): void {
  router.get('/terminology/value-sets', ({ query }) => {
    const code = texto(query, 'code');
    const q = texto(query, 'query') ?? texto(query, 'q');
    const todos = todosLosConjuntos()
      .filter((c) => code === null || c.internalCode === code)
      .filter((c) => contiene(c.name, q) || contiene(c.internalCode, q))
      .map((c) => ({
        id: c.id,
        internalCode: c.internalCode,
        name: c.name,
        description: c.description,
        defaultVersionId: c.defaultVersionId,
        memberCount: miembrosDe(c.internalCode).length,
      }));
    return paginar(todos, query, 50);
  });

  router.get('/terminology/value-sets/:id/$expand', ({ params, query }) => {
    const conjunto = conjuntoPorId(params['id']!);
    if (conjunto === undefined) return notFound('Conjunto de valores no encontrado');
    const pagina = paginar(miembrosDe(conjunto.internalCode).map(opcion), query, 200);
    return {
      valueSetId: conjunto.id,
      valueSetVersionId: conjunto.defaultVersionId,
      version: '1.0.0',
      ...pagina,
    };
  });

  router.get('/terminology/concepts', ({ query }) => {
    const ids = texto(query, 'ids');
    const q = texto(query, 'q');
    const valueSetId = texto(query, 'valueSetId');
    const includeValueSets = query.get('includeValueSets') === 'true';
    const limit = Number(query.get('limit') ?? 50) || 50;

    if (ids !== null) {
      const encontrados = ids
        .split(',')
        .map((id) => conceptoPorId(id.trim()))
        .filter((c): c is ConceptoSimulado => c !== undefined)
        .map(opcion);
      return { items: encontrados, count: encontrados.length, limit };
    }

    // El glosario: `includeValueSets` sin `valueSetId` acota al paraguas.
    if (includeValueSets) {
      const conjunto = valueSetId === null ? undefined : conjuntoPorId(valueSetId);
      const universo = conjunto === undefined ? miembrosDe('glossary-all-terms') : miembrosDe(conjunto.internalCode);
      const items = universo
        .filter((c) => contiene(c.display, q) || contiene(c.code, q) || contiene(c.definition, q))
        .slice(0, limit)
        .map(terminoDeGlosario);
      return { items, count: items.length, limit };
    }

    const items = conceptos()
      .filter((c) => contiene(c.display, q) || contiene(c.code, q))
      .slice(0, limit)
      .map(opcion);
    return { items, count: items.length, limit };
  });

  router.get('/terminology/concepts/:id', ({ params, query }) => {
    const c = conceptoPorId(params['id']!);
    if (c === undefined) return notFound('Concepto no encontrado');
    const categoria = categoriaDe(c);
    if (query.get('includeValueSets') === 'true' || categoria !== null) {
      const base = terminoDeGlosario(c);
      return {
        ...base,
        codeSystemVersionId: CODE_SYSTEM_VERSION_ID,
        synonyms: [{ value: c.display, language: 'es', preferred: true }],
        category:
          categoria === null ? null : { ...categoria, valueSetId: conjuntoPorId(categoria.internalCode)?.id ?? '' },
        tags: categoria === null ? [] : [{ ...categoria, valueSetId: conjuntoPorId(categoria.internalCode)?.id ?? '' }],
        clinicalDefinition: { text: c.definition ?? `Definición clínica de ${c.display}.`, translated: true },
        plainSummary: {
          text: c.definition
            ? `En palabras simples: ${c.definition.charAt(0).toLowerCase()}${c.definition.slice(1)}`
            : `Explicación sencilla de ${c.display}.`,
          translated: true,
        },
        relations: relacionesDe(c),
        properties: { code: c.code, system: 'AloVida' },
      };
    }
    return { ...opcion(c), designations: [{ language: 'es', value: c.display, preferred: true }] };
  });

  router.get('/terminology/code-systems', () => ({
    items: [
      { id: CODE_SYSTEM_ID, internalCode: 'ALOVIDA', name: 'Catálogo AloVida', canonicalUrl: 'https://alovida.bo/fhir/CodeSystem/alovida' },
      { id: 'cs-icd10', internalCode: 'ICD10', name: 'CIE-10', canonicalUrl: 'http://hl7.org/fhir/sid/icd-10' },
      { id: 'cs-ndc', internalCode: 'NDC', name: 'Vademécum NDC', canonicalUrl: 'http://hl7.org/fhir/sid/ndc' },
    ],
  }));

  router.get('/terminology/code-systems/:id/versions', () => ({
    items: [
      { id: CODE_SYSTEM_VERSION_ID, version: '1.0.0', state: 'ACTIVE', isDefault: true, publishedAt: iso(-120), acceptsConcepts: false },
      { id: 'csv-1-1-0', version: '1.1.0', state: 'DRAFT', isDefault: false, publishedAt: null, acceptsConcepts: true },
    ],
  }));

  router.post('/terminology/versions/:id/import-file', () => ({
    batchId: 'lote-1',
    totalRead: 128,
    inserted: 120,
    skipped: 6,
    errors: 2,
    errorSamples: [
      { line: 14, message: 'Código duplicado: I10' },
      { line: 87, message: 'Falta la columna display' },
    ],
  }));

  router.post('/terminology/versions/:id/publish', () => ({ ok: true }));
}
