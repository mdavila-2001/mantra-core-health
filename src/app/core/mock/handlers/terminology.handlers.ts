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
  conjuntosEnLinea,
  facetasEnLinea,
  fichaEnLinea,
  terminoEnLinea,
} from '../glossary-en-linea';
import {
  AlmacenDeGlosario,
  idDeConjunto,
  idDeVersion,
  leerConFetch,
  PARAGUAS_DEL_GLOSARIO,
  type ManifiestoDelGlosario,
} from '../glossary-shards';
import {
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  unauthorized,
  type MockReply,
  type MockRouter,
} from '../mock-router';
import { contiene, iso, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Terminología: conjuntos de valores, conceptos, etiquetas y el glosario.

    El glosario NO se arma acá ni se importa: lo lee `glossary-shards.ts` bajo
    demanda, con `fetch`, desde `public/glossary-data/` (el completo, fuera de
    git) o `public/glossary-seed/` (la semilla commiteada). Este archivo sólo
    traduce cada pedido a una lectura de shards y le da la forma de la API.
    Hasta el 2026-09-30 importaba `fixtures/glosario.ts` y `fixtures/anatomia.ts`
    —casi 3 MB de fixtures en el trozo de los manejadores—.
    ========================================================================== */

/**
 * Un value set del glosario, por su uuid o el de su versión: la clave con la
 * que se busca en los shards (`categoryKey`/`tagKey`) y de qué tipo es.
 */
function conjuntoDelGlosario(
  manifiesto: ManifiestoDelGlosario,
  id: string,
): { readonly tipo: 'paraguas' | 'categoria' | 'etiqueta'; readonly key: string } | null {
  const coincide = (internalCode: string) =>
    idDeConjunto(internalCode) === id || idDeVersion(internalCode) === id;
  if (coincide(PARAGUAS_DEL_GLOSARIO.internalCode)) {
    return { tipo: 'paraguas', key: PARAGUAS_DEL_GLOSARIO.key };
  }
  const categoria = manifiesto.categories.find((c) => coincide(c.internalCode));
  if (categoria !== undefined) return { tipo: 'categoria', key: categoria.key };
  const etiqueta = manifiesto.tags.find((t) => coincide(t.internalCode));
  if (etiqueta !== undefined) return { tipo: 'etiqueta', key: etiqueta.key };
  return null;
}

/** El fallo de lectura del glosario, con el sobre de error del repo. */
function glosarioNoDisponible(error: unknown): MockReply {
  console.error('[mock] no se pudo leer el glosario', error);
  return reply(503, {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'El glosario de la maqueta no está disponible.',
    error: 'Service Unavailable',
    correlationId: 'mock-glossary-shards',
  });
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

/* ============================================================================
    El doble de la carga masiva (§2 del contrato del 2026-09-25).

    Decide **por el nombre del archivo**, no por su contenido: el manejador es
    síncrono y no puede esperar un `File.arrayBuffer()`. Los nombres son los
    fixtures compartidos de §4 —`ok-50`, `con-errores`, `grande-10k`,
    `vacio-solo-encabezado`, `no-es-nada.pdf`— más `error-red`, así que el mismo
    archivo que usa el E2E produce el mismo informe acá.

    Los tres niveles de la regla 65:
    - **correcto** — `ok-50.*` → 50 leídas, 0 errores, `preview` de 20 filas;
      `dryRun` no inserta nada y no registra lote (Q-4); la segunda carga real
      de la misma versión omite lo que ya estaba (Q-7).
    - **límite** — `con-errores.*` → aborta entero con 5 problemas con `columna`
      (Q-2, todo o nada); `grande-*` → 413.
    - **inválido** — `.pdf` y cualquier extensión ajena → 422
      `IMPORT_FORMAT_UNSUPPORTED`; `vacio-*` → 422 `IMPORT_EMPTY_FILE`; sin
      archivo → 412; `profile` fuera de la lista → 422 `IMPORT_PROFILE_UNKNOWN`;
      sin sesión → 401; sin `SECURITY_ADMIN` → 403.

    **Lo único que este doble no puede producir es el S8 «la petición no
    llegó».** El estado 0 sólo lo emite `emitirFallo` del interceptor, y lo
    dispara la sesión, no un manejador: `emitir()` lanza `HttpErrorResponse`
    únicamente con `status >= 400`, así que devolver `{status: 0}` sería un 200
    con cuerpo raro. `error-red` devuelve por eso el fallo **más cercano que un
    manejador sí puede emitir**, un 503 con identificador de correlación (S9).
    Para mirar el S8 de verdad, desde la consola:

    ```js
    sessionStorage.setItem('mock:fallos',
      '[{"patron":"/import-file","modo":"red"}]');
    ```
    ========================================================================== */

/** Los perfiles de importación de §1. `designaciones` todavía no se sirve (Q-9). */
const PERFILES_DE_IMPORTACION = ['conceptos', 'designaciones'] as const;
type PerfilDeImportacion = (typeof PERFILES_DE_IMPORTACION)[number];
const PERFIL_POR_OMISION: PerfilDeImportacion = 'conceptos';

function esPerfilDeImportacion(valor: string): valor is PerfilDeImportacion {
  return (PERFILES_DE_IMPORTACION as readonly string[]).includes(valor);
}

/** El mismo tope que aplica el servidor (`FILE_STORAGE_MAX_SIZE_BYTES`). */
const MAX_BYTES_DE_IMPORTACION = 10 * 1024 * 1024;

/** Filas de datos de `ok-50` y de `con-errores` (§4). */
const FILAS_DEL_ARCHIVO_DE_PRUEBA = 50;

/** `ZZ-001`…`ZZ-050`: sintéticos y declarados, nunca datos de una persona. */
const CODIGOS_DEL_ARCHIVO_DE_PRUEBA: readonly string[] = Array.from(
  { length: FILAS_DEL_ARCHIVO_DE_PRUEBA },
  (_, indice) => `ZZ-${String(indice + 1).padStart(3, '0')}`,
);

/**
 * Las primeras 20 filas válidas. `line` cuenta el encabezado como fila 1, así
 * que la primera fila de datos es la 2 — es la numeración que ve quien abre el
 * archivo en una planilla, que es de lo único que sirve un número de fila.
 */
const VISTA_PREVIA: readonly {
  line: number;
  code: string;
  display: string;
  definition: string;
}[] = CODIGOS_DEL_ARCHIVO_DE_PRUEBA.slice(0, 20).map((code, indice) => ({
  line: indice + 2,
  code,
  display: `Concepto sintético ${code}`,
  definition: `Fila de ejemplo ${indice + 1} del archivo de prueba.`,
}));

/** Los 5 problemas de `con-errores` (§4), con su fila y su columna exactas. */
const ERRORES_DE_MUESTRA: readonly { line: number; column: string; message: string }[] = [
  { line: 5, column: 'display', message: 'está vacía' },
  { line: 9, column: 'code', message: 'está vacía' },
  { line: 14, column: 'code', message: 'supera los 255 caracteres' },
  { line: 20, column: 'code', message: 'ZZ-003 ya aparece antes en el archivo' },
  { line: 33, column: 'display', message: 'supera los 255 caracteres' },
];

/** Fila 1 = columnas canónicas del perfil; fila 2 = el ejemplo (§2). */
const PLANTILLA_CSV = 'code,display,definition\nZZ-000,Ejemplo sintético,Fila de ejemplo';

/**
 * El fallo más cercano al corte de red que un manejador puede emitir (ver la
 * cabecera de este bloque). `correlationId` es obligatorio: sin él el S9 de la
 * pantalla no tiene qué mostrarle a quien reporta el problema.
 */
const DEPENDENCIA_CAIDA: MockReply = reply(503, {
  statusCode: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'El importador no está disponible en este momento.',
  error: 'Service Unavailable',
  correlationId: 'mock-import-red',
});

/** El sobre de error del repo, con el `code` que declara §2. */
function errorDeImportacion(status: number, code: string, message: string): MockReply {
  return reply(status, {
    statusCode: status,
    code,
    message,
    error: status === 413 ? 'Payload Too Large' : 'Unprocessable Entity',
    correlationId: `mock-import-${code.toLowerCase()}`,
  });
}

/** El formato según la extensión, o `null` si no es ninguno de los tres. */
function formatoDeNombre(nombre: string): 'csv' | 'xlsx' | 'ndjson' | null {
  if (nombre.endsWith('.csv')) return 'csv';
  if (nombre.endsWith('.xlsx')) return 'xlsx';
  if (/\.(ndjson|jsonl|json)$/.test(nombre)) return 'ndjson';
  return null;
}

/** El archivo del multipart, con la guarda de SSR que usa el resto del doble. */
function archivoDelFormulario(body: unknown): File | null {
  if (typeof FormData === 'undefined' || !(body instanceof FormData)) return null;
  const archivo = body.get('file');
  return archivo instanceof File ? archivo : null;
}

function campoDelFormulario(body: unknown, clave: string): string | null {
  if (typeof FormData === 'undefined' || !(body instanceof FormData)) return null;
  const valor = body.get(clave);
  return typeof valor === 'string' ? valor : null;
}

export function registrarTerminologia(
  router: MockRouter,
  glosario: AlmacenDeGlosario = new AlmacenDeGlosario(leerConFetch),
): void {
  router.get('/terminology/value-sets/$glossary-facets', async () => {
    try {
      return facetasEnLinea(await glosario.manifiesto());
    } catch (error: unknown) {
      return glosarioNoDisponible(error);
    }
  });

  router.get('/terminology/value-sets', async ({ query }) => {
    const code = texto(query, 'code');
    const q = texto(query, 'query') ?? texto(query, 'q');
    // Los del glosario van primero; el resto del catálogo de la plataforma va
    // detrás, como hasta ahora. Si el glosario no se puede leer, el resto del
    // catálogo sigue sirviendo: un formulario de alta no depende de él.
    let delGlosario: ReturnType<typeof conjuntosEnLinea> = [];
    try {
      delGlosario = conjuntosEnLinea(await glosario.manifiesto());
    } catch (error: unknown) {
      console.error('[mock] el glosario no se pudo leer para el listado de conjuntos', error);
    }
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

  router.get('/terminology/value-sets/:id/$expand', async ({ params, query }) => {
    const id = params['id']!;
    // Un id del glosario sólo se reconoce leyendo el manifiesto; para el resto
    // del catálogo no hace falta, así que se prueba primero lo local.
    if (conjuntoPorId(id) === undefined) {
      try {
        const manifiesto = await glosario.manifiesto();
        const delGlosario = conjuntoDelGlosario(manifiesto, id);
        if (delGlosario !== null) {
          const limit = Math.max(1, Number(query.get('limit') ?? 200) || 200);
          const offset = Math.max(0, Number(query.get('cursor') ?? 0) || 0);
          const { filas, total } = await glosario.pagina({
            ...(delGlosario.tipo === 'categoria' ? { categoryKey: delGlosario.key } : {}),
            ...(delGlosario.tipo === 'etiqueta' ? { tagKey: delGlosario.key } : {}),
            offset,
            limit,
          });
          const internalCode =
            delGlosario.tipo === 'paraguas'
              ? PARAGUAS_DEL_GLOSARIO.internalCode
              : delGlosario.tipo === 'categoria'
                ? `glossary-category-${delGlosario.key}`
                : `glossary-tag-${delGlosario.key}`;
          return {
            valueSetId: idDeConjunto(internalCode),
            valueSetVersionId: idDeVersion(internalCode),
            version: '1.0.0',
            items: filas.map((fila, indice) => ({
              conceptId: fila.id,
              code: fila.code ?? '',
              display: fila.esName,
              definition: fila.plainSummaryEs,
              selectable: true,
              codeSystemVersionId: CODE_SYSTEM_VERSION_ID,
              ordinal: offset + indice + 1,
            })),
            count: total,
            limit,
            nextCursor: offset + limit < total ? String(offset + limit) : null,
          };
        }
      } catch (error: unknown) {
        return glosarioNoDisponible(error);
      }
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

  router.get('/terminology/concepts', async ({ query }) => {
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

    // El glosario: `includeValueSets` sin `valueSetId` acota al paraguas. La
    // página sale de los shards —orden alfabético, `offset` y `total`—, igual
    // que la API desde que pagina en la base.
    if (includeValueSets) {
      try {
        const manifiesto = await glosario.manifiesto();
        const conjunto =
          valueSetId === null
            ? ({ tipo: 'paraguas', key: PARAGUAS_DEL_GLOSARIO.key } as const)
            : conjuntoDelGlosario(manifiesto, valueSetId);
        if (conjunto === null) return notFound('El conjunto de valores no existe');

        const tagValueSetId = texto(query, 'tagValueSetId');
        const etiqueta =
          tagValueSetId === null ? null : conjuntoDelGlosario(manifiesto, tagValueSetId);
        if (tagValueSetId !== null && etiqueta?.tipo !== 'etiqueta') {
          return notFound('La etiqueta no existe');
        }

        const offset = Math.max(0, Number(query.get('offset') ?? 0) || 0);
        const tagKey =
          conjunto.tipo === 'etiqueta' ? conjunto.key : (etiqueta?.key ?? undefined);
        const { filas, total } = await glosario.pagina({
          ...(conjunto.tipo === 'categoria' ? { categoryKey: conjunto.key } : {}),
          ...(tagKey === undefined ? {} : { tagKey }),
          ...(q === null ? {} : { query: q }),
          offset,
          limit,
        });
        const items = filas.map((fila) => terminoEnLinea(fila, manifiesto));
        return { items, count: items.length, limit, offset, total };
      } catch (error: unknown) {
        return glosarioNoDisponible(error);
      }
    }

    const items = conceptos()
      .filter((c) => contiene(c.display, q) || contiene(c.code, q))
      .slice(0, limit)
      .map(opcion);
    return { items, count: items.length, limit };
  });

  router.get('/terminology/concepts/glossary-graph', async () => {
    const limit = 500;
    try {
      const manifiesto = await glosario.manifiesto();
      const { filas, total } = await glosario.pagina({ offset: 0, limit });
      const nodes = filas.map((fila) => {
        const term = terminoEnLinea(fila, manifiesto);
        return {
          conceptId: term.conceptId,
          slug: term.slug,
          display: term.display,
          category: term.category,
          shortDefinition: term.shortDefinition ?? '',
        };
      });
      const nodeIds = new Set(nodes.map((node) => node.conceptId));
      const edges = filas.flatMap((fila) =>
        fila.relations.flatMap((relation) =>
          nodeIds.has(relation.targetId)
            ? [{
                sourceConceptId: fila.id,
                targetConceptId: relation.targetId,
                type: relation.type,
              }]
            : [],
        ),
      );
      return {
        nodes,
        edges,
        count: nodes.length,
        limit,
        possiblyTruncated: total > nodes.length,
      };
    } catch (error: unknown) {
      return glosarioNoDisponible(error);
    }
  });

  router.get('/terminology/concepts/:id', async ({ params }) => {
    const c = conceptoPorId(params['id']!);
    if (c === undefined) {
      try {
        const fila = await glosario.porId(params['id']!);
        if (fila !== null) return fichaEnLinea(fila, await glosario.manifiesto());
      } catch (error: unknown) {
        return glosarioNoDisponible(error);
      }
      return notFound('Concepto no encontrado');
    }
    // `properties` va sólo en la ficha, no en la búsqueda/lista (`opcion()`):
    // mismo contrato que `ConceptDetailDto.properties` en la API real
    // (search-concepts.dto.ts) — son varias filas por concepto y traerlas en
    // cada resultado de un autocompletar es peso que la lista no usa.
    return {
      ...opcion(c),
      designations: [{ language: 'es', value: c.display, preferred: true }],
      properties: c.properties ?? {},
    };
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

  /* -- Carga masiva: el doble del importador (§2 del contrato del 25/09) ------

     Los códigos ya cargados por versión. Vive acá dentro y no en el módulo a
     propósito: cada `crearRouterSimulado()` estrena el suyo, así que un test
     no arrastra lo que cargó el anterior. Es lo que hace observable la regla
     Q-7 —un `code` que ya está en la versión se omite, nunca se actualiza—:
     importar `ok-50.csv` dos veces da 50 insertadas y después 50 omitidas. */
  const codigosPorVersion = new Map<string, Set<string>>();

  router.post('/terminology/versions/:id/import-file', ({ body, params, user }) => {
    if (user === null) return unauthorized();
    if (!user.roles.includes('SECURITY_ADMIN')) {
      return forbidden('Hace falta administración de seguridad para importar terminología.');
    }

    const archivo = archivoDelFormulario(body);
    if (archivo === null) {
      return preconditionFailed('No se recibió contenido en el campo "file"');
    }

    const perfil = campoDelFormulario(body, 'profile') ?? PERFIL_POR_OMISION;
    if (!esPerfilDeImportacion(perfil)) {
      return errorDeImportacion(422, 'IMPORT_PROFILE_UNKNOWN', `No existe el perfil «${perfil}».`);
    }

    const dryRun = campoDelFormulario(body, 'dryRun') === 'true';
    const nombre = archivo.name.toLowerCase();

    // Nivel inválido, primero el que ni siquiera llega al lector de archivos.
    if (nombre.includes('error-red')) return DEPENDENCIA_CAIDA;
    if (nombre.includes('grande') || archivo.size > MAX_BYTES_DE_IMPORTACION) {
      return errorDeImportacion(
        413,
        'PAYLOAD_TOO_LARGE',
        `El archivo supera los ${MAX_BYTES_DE_IMPORTACION / (1024 * 1024)} MB que acepta el servidor.`,
      );
    }

    const formato = formatoDeNombre(nombre);
    if (formato === null) {
      return errorDeImportacion(
        422,
        'IMPORT_FORMAT_UNSUPPORTED',
        'El archivo no es NDJSON, CSV ni XLSX.',
      );
    }
    if (nombre.includes('vacio')) {
      return errorDeImportacion(422, 'IMPORT_EMPTY_FILE', 'El archivo no tiene filas.');
    }

    const base = { format: formato, profile: perfil, dryRun };

    // Nivel límite: aborta entero (Q-2, todo o nada) y no toca la versión.
    if (nombre.includes('con-errores')) {
      return {
        ...base,
        batchId: null,
        aborted: true,
        totalRead: FILAS_DEL_ARCHIVO_DE_PRUEBA,
        inserted: 0,
        skipped: 0,
        errors: ERRORES_DE_MUESTRA.length,
        errorSamples: ERRORES_DE_MUESTRA,
        preview: [],
      };
    }

    // Nivel correcto. En dry-run no se registra lote (Q-4) ni se toca nada.
    const codigos = codigosPorVersion.get(params['id']!) ?? new Set<string>();
    const nuevos = CODIGOS_DEL_ARCHIVO_DE_PRUEBA.filter((codigo) => !codigos.has(codigo));
    if (!dryRun) {
      for (const codigo of nuevos) codigos.add(codigo);
      codigosPorVersion.set(params['id']!, codigos);
    }

    return {
      ...base,
      batchId: dryRun ? null : uuid(`lote-${params['id']}-${nombre}-${codigos.size}`),
      aborted: false,
      totalRead: FILAS_DEL_ARCHIVO_DE_PRUEBA,
      inserted: dryRun ? 0 : nuevos.length,
      skipped: dryRun ? 0 : FILAS_DEL_ARCHIVO_DE_PRUEBA - nuevos.length,
      errors: 0,
      errorSamples: [],
      preview: VISTA_PREVIA,
    };
  });

  router.get('/terminology/import-template', ({ query, user }) => {
    if (user === null) return unauthorized();
    if (!user.roles.includes('SECURITY_ADMIN')) {
      return forbidden('Hace falta administración de seguridad para importar terminología.');
    }

    const perfil = texto(query, 'profile') ?? PERFIL_POR_OMISION;
    if (!esPerfilDeImportacion(perfil)) {
      return errorDeImportacion(422, 'IMPORT_PROFILE_UNKNOWN', `No existe el perfil «${perfil}».`);
    }

    const formato = texto(query, 'format') ?? 'csv';
    if (formato !== 'csv' && formato !== 'xlsx') {
      return errorDeImportacion(
        422,
        'IMPORT_FORMAT_UNSUPPORTED',
        'La plantilla se descarga en CSV o en XLSX.',
      );
    }

    return {
      status: 200,
      // El cuerpo del XLSX es **el mismo texto**, no un libro de Excel: armar
      // uno exige una dependencia y este carril tiene prohibido agregarla. El
      // libro de verdad lo sirve `import-template.service.ts` de la API. Lo
      // que el doble sí reproduce entero es la **forma** de la respuesta —tipo,
      // `Content-Disposition` y nombre—, que es lo que ejercita la pantalla.
      body: PLANTILLA_CSV,
      headers: {
        'Content-Type':
          formato === 'csv'
            ? 'text/csv; charset=utf-8'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="plantilla-${perfil}.${formato}"`,
      },
    };
  });

  router.post('/terminology/versions/:id/publish', () => ({ ok: true }));
}
