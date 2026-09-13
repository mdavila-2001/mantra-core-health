import {
  CODE_SYSTEM_ID,
  CODE_SYSTEM_VERSION_ID,
  conceptoPorId,
  conceptos,
  conjuntoPorId,
  miembrosDe,
  todosLosConjuntos,
  type ConceptoSimulado,
} from '../fixtures/conceptos';
import {
  CATEGORIAS,
  ETIQUETAS,
  PARAGUAS,
  conjuntoDeGlosarioPorId,
  conjuntoEnLinea,
  fichaEnLinea,
  miembrosDeConjunto,
  terminoEnLinea,
  terminoPorId,
  type ConceptoDeGlosario,
} from '../fixtures/glosario';
import { notFound, type MockRouter } from '../mock-router';
import { contiene, iso, paginar, texto } from '../mock-store';

/* ============================================================================
    Terminología: conjuntos de valores, conceptos, etiquetas y el glosario.

    El glosario NO se arma acá: lo sirve `fixtures/glosario.ts`, que indexa el
    catálogo curado del backend (12 categorías `glossary-category-*`, 15
    etiquetas `glossary-tag-*` y 69 términos con definición clínica, resumen
    llano, sinónimos y relaciones tipadas). Hasta el 2026-09-11 este archivo
    inventaba siete categorías propias —`glossary-diseases`, `glossary-symptoms`…—
    con códigos que el backend no tiene: la pantalla filtra por el prefijo
    canónico y las descartaba todas, así que la maqueta nunca mostró una sola
    definición.
    ========================================================================== */

/** Un término del glosario coincide por nombre, sinónimo, definición o código. */
function coincide(termino: ConceptoDeGlosario, q: string | null): boolean {
  return (
    contiene(termino.esName, q) ||
    contiene(termino.enDisplay, q) ||
    contiene(termino.code, q) ||
    contiene(termino.clinicalDefinitionEs, q) ||
    contiene(termino.plainSummaryEs, q) ||
    (termino.esSynonyms ?? []).some((sinonimo) => contiene(sinonimo, q))
  );
}

/**
 * El código tal como lo publica la API real.
 *
 * Los estados de reserva se siembran como `BK-CONFIRMED` por comodidad, pero la
 * agenda reconoce `BOOKING_CONFIRMED` (`features/agenda/booking-status.ts`): sin
 * esta traducción todas las citas del simulador se veían «Sin registrar».
 */
function codigoPublicado(codigo: string): string {
  return codigo.startsWith('BK-') ? `BOOKING_${codigo.slice(3).replace(/-/g, '_')}` : codigo;
}

function opcion(c: ConceptoSimulado) {
  return {
    conceptId: c.id,
    code: codigoPublicado(c.code),
    display: c.display,
    ...(c.definition === undefined ? {} : { definition: c.definition }),
    selectable: c.selectable,
    codeSystemVersionId: CODE_SYSTEM_VERSION_ID,
    ordinal: c.ordinal,
  };
}

export function registrarTerminologia(router: MockRouter): void {
  router.get('/terminology/value-sets', ({ query }) => {
    const code = texto(query, 'code');
    const q = texto(query, 'query') ?? texto(query, 'q');
    // Los del glosario van primero y en el orden de la grilla; el resto del
    // catálogo de la plataforma va detrás, como hasta ahora.
    const delGlosario = [PARAGUAS, ...CATEGORIAS, ...ETIQUETAS].map(conjuntoEnLinea);
    const delCatalogo = todosLosConjuntos().map((c) => ({
      id: c.id,
      internalCode: c.internalCode,
      name: c.name,
      description: c.description,
      defaultVersionId: c.defaultVersionId,
      memberCount: miembrosDe(c.internalCode).length,
    }));
    const todos = [...delGlosario, ...delCatalogo]
      .filter((c) => code === null || c.internalCode === code)
      .filter((c) => contiene(c.name, q) || contiene(c.internalCode, q));
    return paginar(todos, query, 50);
  });

  router.get('/terminology/value-sets/:id/$expand', ({ params, query }) => {
    const delGlosario = conjuntoDeGlosarioPorId(params['id']!);
    if (delGlosario !== undefined) {
      const pagina = paginar(
        miembrosDeConjunto(delGlosario).map((t, indice) => ({
          conceptId: t.id,
          code: t.code,
          display: t.esName,
          definition: t.plainSummaryEs,
          selectable: true,
          codeSystemVersionId: CODE_SYSTEM_VERSION_ID,
          ordinal: indice + 1,
        })),
        query,
        200,
      );
      return {
        valueSetId: delGlosario.id,
        valueSetVersionId: delGlosario.defaultVersionId,
        version: '1.0.0',
        ...pagina,
      };
    }

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
      const conjunto = valueSetId === null ? PARAGUAS : conjuntoDeGlosarioPorId(valueSetId);
      const universo = conjunto === undefined ? [] : miembrosDeConjunto(conjunto);
      const coincidentes = universo.filter((t) => coincide(t, q));
      // `count` es el total que coincide, no el recortado: es lo que la
      // pantalla lee para avisar que se mostró sólo una parte.
      return {
        items: coincidentes.slice(0, limit).map(terminoEnLinea),
        count: coincidentes.length,
        limit,
      };
    }

    const items = conceptos()
      .filter((c) => contiene(c.display, q) || contiene(c.code, q))
      .slice(0, limit)
      .map(opcion);
    return { items, count: items.length, limit };
  });

  router.get('/terminology/concepts/:id', ({ params }) => {
    const delGlosario = terminoPorId(params['id']!);
    if (delGlosario !== undefined) return fichaEnLinea(delGlosario);

    const c = conceptoPorId(params['id']!);
    if (c === undefined) return notFound('Concepto no encontrado');
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
