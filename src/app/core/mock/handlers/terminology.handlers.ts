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
  coincideAnatomia,
  entradaEnLinea,
  entradaPorId,
  esConjuntoConAnatomia,
  fichaAnatomicaEnLinea,
  ENTRADAS as ENTRADAS_ANATOMICAS,
} from '../fixtures/anatomia';
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

export function registrarTerminologia(router: MockRouter): void {
  router.get('/terminology/value-sets', ({ query }) => {
    const code = texto(query, 'code');
    const q = texto(query, 'query') ?? texto(query, 'q');
    // Los del glosario van primero y en el orden de la grilla; el resto del
    // catálogo de la plataforma va detrás, como hasta ahora.
    const delGlosario = [PARAGUAS, ...CATEGORIAS, ...ETIQUETAS].map((conjunto) => {
      const enLinea = conjuntoEnLinea(conjunto);
      // `conjuntoEnLinea` sólo cuenta el catálogo curado. Sin esto la tarjeta
      // «Anatomía» diría 3 y la categoría tendría 3 164: la grilla esconde las
      // que declaran cero, así que el conteo decide qué se ve.
      return esConjuntoConAnatomia(conjunto)
        ? { ...enLinea, memberCount: enLinea.memberCount + ENTRADAS_ANATOMICAS.length }
        : enLinea;
    });
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
      const curados = miembrosDeConjunto(delGlosario).map((t) => ({
        conceptId: t.id,
        code: t.code,
        display: t.esName,
        definition: t.plainSummaryEs,
      }));
      const anatomicos = esConjuntoConAnatomia(delGlosario)
        ? ENTRADAS_ANATOMICAS.map((e) => {
            const enLinea = entradaEnLinea(e);
            return {
              conceptId: enLinea.conceptId,
              code: enLinea.code,
              display: enLinea.display,
              definition: enLinea.shortDefinition,
            };
          })
        : [];
      const pagina = paginar(
        [...curados, ...anatomicos].map((miembro, indice) => ({
          ...miembro,
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
      if (conjunto === undefined) return { items: [], count: 0, limit };

      const curados = miembrosDeConjunto(conjunto)
        .filter((t) => coincide(t, q))
        .map(terminoEnLinea);
      // La taxonomía de Netter vive aparte del catálogo curado (ver
      // `fixtures/anatomia.ts`) y entra por la misma categoría «Anatomía».
      const anatomicos = esConjuntoConAnatomia(conjunto)
        ? ENTRADAS_ANATOMICAS.filter((e) => coincideAnatomia(e, q)).map(entradaEnLinea)
        : [];
      // Los curados van primero: están escritos por alguien, con definición
      // clínica y resumen llano. Las 3 161 entradas del índice son el fondo.
      const coincidentes = [...curados, ...anatomicos];

      // `count` es el total que coincide, no el recortado: es lo que la
      // pantalla lee para avisar que se mostró sólo una parte.
      return {
        items: coincidentes.slice(0, limit),
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

    const anatomico = entradaPorId(params['id']!);
    if (anatomico !== undefined) return fichaAnatomicaEnLinea(anatomico);

    const c = conceptoPorId(params['id']!);
    if (c === undefined) return notFound('Concepto no encontrado');
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
