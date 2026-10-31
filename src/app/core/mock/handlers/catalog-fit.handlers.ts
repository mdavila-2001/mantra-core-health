import type {
  CatalogFit,
  FitCheckResult,
  FitCheckStatus,
  FitDimension,
  FitDimensionScore,
  FitHistoryEntry,
  FitReport,
  FitRunAccepted,
  FitRunView,
  FitSeverity,
  FitVerdict,
} from '../../data-access/admin-portal/catalog-fit.types';
import {
  forbidden,
  reply,
  unauthorized,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';

/* ============================================================================
    Backend SIMULADO de la sonda de ajuste de la catalogación
    (`GET /admin/catalog/fit` y `POST /admin/catalog/fit/run`).

    Devuelve el contrato de la API (`catalog-fit.dto.ts`) con cifras SINTÉTICAS:
    nada de esto es una medición del catálogo real. Cada hallazgo y cada razón
    empiezan por «Simulado:» para que nadie lo confunda con una. Cubre los cinco
    estados de una comprobación (OK, FALLA, SIN_DATO, NO_DECLARADO, NO_APLICA),
    una dimensión sin puntaje (mutabilidad: NO_DECLARADO) y un veredicto
    DESAJUSTADA, para que la pantalla muestre todos sus caminos.

    Es con estado, como la API: pedir una corrida la deja EN_CURSO, la siguiente
    lectura pasada la duración simulada la ve COMPLETADA con un informe nuevo y
    una línea más en el historial. La misma `Idempotency-Key` devuelve la misma
    corrida; con una en vuelo, también.
    ========================================================================== */

const LECTURA = [
  'SUPERADMIN',
  'SECURITY_ADMIN',
  'PLATFORM_ADMIN',
  'GOVERNANCE_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'DPO',
  'AUDITOR',
  'DATA_STEWARD',
] as const;
const ESCRITURA = [
  'SUPERADMIN',
  'GOVERNANCE_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'DATA_STEWARD',
] as const;
const CLAVE_VALIDA = /^[A-Za-z0-9._:-]{8,128}$/;

const TTL_SEGUNDOS = 86_400;
const REFRESCO_SEGUNDOS = 300;
const ATRASADO_TRAS_SEGUNDOS = 3 * REFRESCO_SEGUNDOS;
/** Cuánto tarda una corrida simulada en terminar. */
const DURACION_SIMULADA_MS = 1_800;
const HISTORIAL = 48;
const UMBRAL_ESCANEO_MS = 35 * 60_000;

interface Semilla {
  readonly id: string;
  readonly dimension: FitDimension;
  readonly title: string;
  readonly severity: FitSeverity;
  readonly status: FitCheckStatus;
  readonly covered: number | null;
  readonly denominator: number | null;
  readonly hallazgos: readonly (readonly [string, string])[];
  readonly total?: number;
  readonly reason?: string;
  readonly remediation: string;
}

/* Las comprobaciones y sus ids son las de la API; los números y los sujetos, inventados. */
const SEMILLAS: readonly Semilla[] = [
  {
    id: 'FIT-RUT-001',
    dimension: 'ROUTES',
    title: 'Toda ruta HTTP del código está en el inventario de operaciones',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 1_616,
    denominator: 1_618,
    hallazgos: [
      [
        'GET /ejemplo/rutas-nuevas',
        'Simulado: ExampleController.list existe en el código y no está en el inventario',
      ],
      [
        'POST /ejemplo/rutas-nuevas/:p/cerrar',
        'Simulado: ExampleController.close existe en el código y no está en el inventario',
      ],
    ],
    remediation:
      'Regenerar el inventario (`yarn inventario:endpoints`) y, si la ruta sigue sin aparecer, revisar que su controlador esté registrado y documentado en el contrato.',
  },
  {
    id: 'FIT-RUT-002',
    dimension: 'ROUTES',
    title: 'Toda operación del inventario corresponde a una ruta real (sin huérfanas)',
    severity: 'ALTA',
    status: 'OK',
    covered: 1_618,
    denominator: 1_618,
    hallazgos: [],
    remediation:
      'Regenerar el inventario; si la operación sigue ahí, la ruta se borró o cambió de plantilla.',
  },
  {
    id: 'FIT-RUT-003',
    dimension: 'ROUTES',
    title: 'El inventario sólo lista rutas reales (sin métodos auxiliares con verbo desconocido)',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_698,
    denominator: 1_709,
    total: 11,
    hallazgos: [
      ['ExampleController_toInt', 'Simulado: entrada con verbo DESCONOCIDO: no es una ruta HTTP'],
    ],
    remediation:
      'Corregir el generador del inventario para que un método sin decorador HTTP no se registre como operación.',
  },
  {
    id: 'FIT-RUT-004',
    dimension: 'ROUTES',
    title: 'Toda ruta del inventario está publicada en el contrato OpenAPI',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_525,
    denominator: 1_618,
    total: 93,
    hallazgos: [
      [
        'GET /ejemplo/borrador',
        'Simulado: ExampleDraftController_list existe en el código y el contrato OpenAPI no la publica',
      ],
    ],
    remediation: 'Documentar el controlador para Swagger y regenerar `openapi/openapi.json`.',
  },
  {
    id: 'FIT-MOD-001',
    dimension: 'MODEL',
    title: 'Toda tabla del modelo existe en el catálogo vivo (escaneo)',
    severity: 'ALTA',
    status: 'OK',
    covered: 1_313,
    denominator: 1_313,
    hallazgos: [],
    remediation: 'Aplicar el DDL del modelo a la base y pedir un escaneo.',
  },
  {
    id: 'FIT-MOD-002',
    dimension: 'MODEL',
    title: 'Toda tabla observada en la base existe en el catálogo estático (modelo)',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 1_312,
    denominator: 1_313,
    hallazgos: [['ejemplo.tabla_de_mas', 'Simulado: la base la tiene y el modelo no la declara']],
    remediation:
      'Declararla en el modelo y regenerar el inventario, o excluir su schema del escaneo.',
  },
  {
    id: 'FIT-MOD-003',
    dimension: 'MODEL',
    title: 'Toda columna del modelo existe en el catálogo vivo',
    severity: 'ALTA',
    status: 'OK',
    covered: 18_263,
    denominator: 18_263,
    hallazgos: [],
    remediation: 'Aplicar la migración del modelo a la base y reescanear.',
  },
  {
    id: 'FIT-MOD-004',
    dimension: 'MODEL',
    title: 'Toda columna observada en la base existe en el catálogo estático',
    severity: 'MEDIA',
    status: 'OK',
    covered: 18_263,
    denominator: 18_263,
    hallazgos: [],
    remediation: 'Declarar la columna en el modelo y regenerar el inventario.',
  },
  {
    id: 'FIT-MOD-005',
    dimension: 'MODEL',
    title: 'El ORM coincide con el modelo (entidades, columnas, nulabilidad y tipos)',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 3,
    denominator: 6,
    hallazgos: [
      [
        'entidadesSinTabla',
        'Simulado: entidades del ORM sin tabla en el modelo: 12 elemento(s) (ejemplo.a, ejemplo.b)',
      ],
      ['nulabilidad', 'Simulado: nulabilidad divergente: 4 elemento(s)'],
    ],
    remediation:
      'Regenerar las entidades desde el modelo; el esquema fluye modelo → entidades, nunca al revés.',
  },
  {
    id: 'FIT-MOD-006',
    dimension: 'MODEL',
    title:
      'El modelo coincide con la base contra la que se generó el inventario (foto de generación)',
    severity: 'MEDIA',
    status: 'SIN_DATO',
    covered: null,
    denominator: null,
    hallazgos: [],
    reason: 'Simulado: deriva modelo/base (inventario): falló la lectura (Error)',
    remediation: 'Regenerar la comparación contra una base con el DDL actual.',
  },
  {
    id: 'FIT-COM-001',
    dimension: 'COMPLETENESS',
    title: 'Toda operación declara las tablas que afecta (o por qué no toca ninguna)',
    severity: 'ALTA',
    status: 'OK',
    covered: 1_618,
    denominator: 1_618,
    hallazgos: [],
    remediation: 'Revisar la operación: si toca datos, el generador no resolvió la llamada.',
  },
  {
    id: 'FIT-COM-002',
    dimension: 'COMPLETENESS',
    title: 'Toda operación con cuerpo declara su DTO de entrada',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_007,
    denominator: 1_012,
    hallazgos: [
      [
        'POST /ejemplo/archivos',
        'Simulado: ExampleController_upload recibe cuerpo y no declara el DTO de entrada',
      ],
    ],
    remediation: 'Tipar el `@Body()` con una clase DTO validada y anotarla para el contrato.',
  },
  {
    id: 'FIT-COM-003',
    dimension: 'COMPLETENESS',
    title: 'Toda operación con respuesta declara su DTO de salida',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_446,
    denominator: 1_599,
    total: 153,
    hallazgos: [
      [
        'PATCH /ejemplo/activos/{id}',
        'Simulado: ExampleController_patch no declara el DTO de salida',
      ],
    ],
    remediation:
      'Anotar el handler con `@ApiResponse({ type: …Dto })`. Las respuestas 204 no cuentan.',
  },
  {
    id: 'FIT-COM-004',
    dimension: 'COMPLETENESS',
    title: 'Toda operación no pública declara los roles que la pueden llamar',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_256,
    denominator: 1_554,
    total: 298,
    hallazgos: [
      [
        'GET /ejemplo/contenido',
        'Simulado: ExampleController_content exige sesión pero ningún rol',
      ],
    ],
    remediation:
      'Declarar `@Roles(...)` o dejar escrito en el contrato que basta una sesión autenticada.',
  },
  {
    id: 'FIT-COM-005',
    dimension: 'COMPLETENESS',
    title: 'Toda tabla tiene descripción de sistema (modelo o comentario en la base)',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_259,
    denominator: 1_313,
    total: 54,
    hallazgos: [
      [
        'ejemplo.tabla_sin_descripcion',
        'Simulado: sin descripción de sistema ni en el modelo ni en la base',
      ],
    ],
    remediation: 'Documentar la tabla en el modelo y regenerar el inventario.',
  },
  {
    id: 'FIT-COM-006',
    dimension: 'COMPLETENESS',
    title: 'Toda tabla observada tiene ficha curada con descripción de negocio',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 212,
    denominator: 1_313,
    total: 1_101,
    hallazgos: [['ejemplo.tabla_sin_ficha', 'Simulado: sin ficha curada']],
    remediation: 'Completar la ficha del objeto y enviarla a revisión.',
  },
  {
    id: 'FIT-FRE-001',
    dimension: 'FRESHNESS',
    title: 'El último escaneo de la base no está vencido',
    severity: 'ALTA',
    status: 'OK',
    covered: 1,
    denominator: 1,
    hallazgos: [],
    remediation:
      'Ver los escaneos y comprobar que el worker `data_catalog` esté vivo en «Instancias».',
  },
  {
    id: 'FIT-FRE-002',
    dimension: 'FRESHNESS',
    title: 'La última importación del inventario corresponde al código desplegado (huella)',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 0,
    denominator: 1,
    hallazgos: [
      [
        'huella',
        'Simulado: código aaaa111122223333 ≠ lo importado bbbb444455556666 (2 solo en el código, 0 solo en lo importado)',
      ],
    ],
    remediation: 'Pedir la importación con un inventario regenerado desde este código.',
  },
  {
    id: 'FIT-FRE-003',
    dimension: 'FRESHNESS',
    title: 'El inventario generado corresponde al código desplegado (huella)',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 0,
    denominator: 1,
    hallazgos: [['huella', 'Simulado: código aaaa111122223333 ≠ el inventario bbbb444455556666']],
    remediation:
      'Regenerar el inventario en la imagen; uno viejo describe una API que ya no existe.',
  },
  {
    id: 'FIT-MUT-001',
    dimension: 'MUTABILITY',
    title:
      'Toda tabla declara su clasificación de mutabilidad (append-only, actualizable, soft-delete, purga, legal-hold)',
    severity: 'MEDIA',
    status: 'NO_DECLARADO',
    covered: null,
    denominator: null,
    hallazgos: [],
    reason:
      'Simulado: no hay una fuente de mutabilidad registrada: la taxonomía aún no existe, así que no se mide ni se inventa un cero.',
    remediation:
      'Al registrar la fuente de la taxonomía, esta comprobación pasa de «No declarado» a medir. Mientras tanto no falla el módulo.',
  },
  {
    id: 'FIT-SEN-001',
    dimension: 'SENSITIVITY',
    title: 'Toda tabla observada tiene su sensibilidad clasificada',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 901,
    denominator: 1_313,
    total: 412,
    hallazgos: [['ejemplo.tabla_sin_clasificar', 'Simulado: sensibilidad UNKNOWN']],
    remediation:
      'Clasificar la tabla en su ficha; `UNKNOWN` significa «sin clasificar», no «sin datos sensibles».',
  },
  {
    id: 'FIT-SEN-002',
    dimension: 'SENSITIVITY',
    title: 'Toda columna observada tiene su sensibilidad clasificada',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 17_100,
    denominator: 18_263,
    total: 1_163,
    hallazgos: [['ejemplo.tabla_sin_clasificar.columna', 'Simulado: sin ficha de columna']],
    remediation: 'Correr la clasificación automática y revisar a mano las columnas en duda.',
  },
  {
    id: 'FIT-SEN-003',
    dimension: 'SENSITIVITY',
    title:
      'Ninguna columna que parece dato personal, clínico o credencial está sin clasificar o por debajo de lo detectado',
    severity: 'ALTA',
    status: 'NO_APLICA',
    covered: null,
    denominator: null,
    hallazgos: [],
    reason: 'Simulado: no hay nada que comprobar: el universo está vacío',
    remediation: 'Subir la sensibilidad de la columna al nivel detectado.',
  },
];

function resultado(s: Semilla): FitCheckResult {
  const medida = s.status === 'OK' || s.status === 'FALLA';
  const total = s.total ?? s.hallazgos.length;
  return {
    id: s.id,
    dimension: s.dimension,
    title: s.title,
    severity: s.severity,
    status: s.status,
    covered: s.covered,
    denominator: s.denominator,
    summary: medida
      ? `Simulado: ${s.covered} de ${s.denominator} cumplen.`
      : 'Simulado: no se pudo comprobar.',
    reason: s.reason ?? null,
    remediation: s.remediation,
    evidence:
      s.id === 'FIT-FRE-001' ? { thresholdMs: UMBRAL_ESCANEO_MS, lastStatus: 'SUCCEEDED' } : {},
    findings: s.hallazgos.map(([subject, detail]) => ({ subject, detail })),
    findingsTotal: total,
    findingsTruncated: total > s.hallazgos.length,
  };
}

const DIMENSIONES: readonly FitDimension[] = [
  'ROUTES',
  'MODEL',
  'COMPLETENESS',
  'FRESHNESS',
  'MUTABILITY',
  'SENSITIVITY',
];

/** Mismo puntaje que la API: Σ de ítems de las comprobaciones medidas, con su base; `null` sin base. */
export function puntuar(
  dimension: FitDimension,
  checks: readonly FitCheckResult[],
): FitDimensionScore {
  const propias = checks.filter((c) => c.dimension === dimension);
  const medidas = propias.filter((c) => c.status === 'OK' || c.status === 'FALLA');
  const covered = medidas.reduce((a, c) => a + (c.covered ?? 0), 0);
  const denominator = medidas.reduce((a, c) => a + (c.denominator ?? 0), 0);
  const status =
    medidas.length > 0
      ? 'MEDIDA'
      : propias.some((c) => c.status === 'NO_DECLARADO')
        ? 'NO_DECLARADO'
        : propias.some((c) => c.status === 'SIN_DATO')
          ? 'SIN_DATO'
          : 'NO_APLICA';
  return {
    dimension,
    status,
    covered: status === 'MEDIDA' ? covered : null,
    denominator: status === 'MEDIDA' ? denominator : null,
    ratio:
      status === 'MEDIDA' && denominator > 0
        ? Math.round((covered / denominator) * 10_000) / 10_000
        : null,
    checksMeasured: medidas.length,
    checksUnmeasured: propias.filter((c) => c.status === 'SIN_DATO' || c.status === 'NO_DECLARADO')
      .length,
    checksFailed: medidas.filter((c) => c.status === 'FALLA').length,
  };
}

/** Mismo veredicto que la API: no promedia; una falla ALTA desajusta. */
export function veredicto(checks: readonly FitCheckResult[]): FitVerdict {
  const medidas = checks.filter((c) => c.status === 'OK' || c.status === 'FALLA');
  if (medidas.length === 0) return 'SIN_DATOS';
  const fallas = medidas.filter((c) => c.status === 'FALLA');
  if (fallas.some((c) => c.severity === 'ALTA')) return 'DESAJUSTADA';
  if (
    fallas.some((c) => c.severity === 'MEDIA' || c.severity === 'BAJA') ||
    checks.some((c) => c.status === 'SIN_DATO' && c.severity === 'ALTA')
  )
    return 'CON_AVISOS';
  return 'AJUSTADA';
}

const iso = (ms: number): string => new Date(ms).toISOString();

function informe(ahora: number): FitReport {
  const checks = SEMILLAS.map(resultado);
  return {
    modelVersion: 'catalog-fit/v1',
    evaluatedAt: iso(ahora),
    verdict: veredicto(checks),
    dimensions: DIMENSIONES.map((d) => puntuar(d, checks)),
    checks,
    blindSpots: checks
      .filter((c) => c.status === 'SIN_DATO' || c.status === 'NO_DECLARADO')
      .map((c) => c.id),
    fingerprints: {
      routesInCode: 'aaaa111122223333',
      routesInInventory: 'bbbb444455556666',
      routesImported: 'bbbb444455556666',
    },
    deployment: { commit: 'simulado', builtAt: 'desconocido' },
    thresholds: { scanStaleAfterMs: UMBRAL_ESCANEO_MS },
  };
}

function lineaDeHistorial(
  runId: string,
  ahora: number,
  trigger: 'TICK' | 'MANUAL',
  empeora: number,
): FitHistoryEntry {
  const r = informe(ahora);
  return {
    runId,
    evaluatedAt: r.evaluatedAt,
    trigger,
    verdict: r.verdict,
    // la tendencia simulada mejora con el tiempo: así el historial tiene qué mostrar
    dimensions: r.dimensions.map((d) => ({
      dimension: d.dimension,
      status: d.status,
      covered: d.covered === null ? null : Math.max(0, d.covered - empeora),
      denominator: d.denominator,
      ratio:
        d.covered === null || d.denominator === null || d.denominator === 0
          ? null
          : Math.round((Math.max(0, d.covered - empeora) / d.denominator) * 10_000) / 10_000,
    })),
    failedChecks: r.checks.filter((c) => c.status === 'FALLA').map((c) => c.id),
    blindSpots: [...r.blindSpots],
  };
}

function vista(run: SimRun): FitRunView {
  return {
    runId: run.runId,
    status: run.status,
    trigger: run.trigger,
    requestedAt: iso(run.requestedAt),
    finishedAt: run.finishedAt === null ? null : iso(run.finishedAt),
    durationMs: run.finishedAt === null ? null : run.finishedAt - run.requestedAt,
    errorCode: null,
  };
}

interface SimRun {
  readonly runId: string;
  readonly trigger: 'TICK' | 'MANUAL';
  readonly requestedAt: number;
  status: 'EN_CURSO' | 'COMPLETADA';
  finishedAt: number | null;
}

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function registrarSondaCatalogo(router: MockRouter, reloj: () => number = Date.now): void {
  const inicio = reloj();
  let contador = 1;
  let ultima: SimRun = {
    runId: uuid(contador++),
    trigger: 'TICK',
    requestedAt: inicio - 120_000,
    status: 'COMPLETADA',
    finishedAt: inicio - 118_000,
  };
  let enVuelo: SimRun | null = null;
  const claves = new Map<string, SimRun>();
  const historial: FitHistoryEntry[] = Array.from({ length: 12 }, (_, i) =>
    lineaDeHistorial(
      uuid(1000 + i),
      inicio - (13 - i) * REFRESCO_SEGUNDOS * 1000,
      'TICK',
      (12 - i) * 7,
    ),
  );
  historial.push(lineaDeHistorial(ultima.runId, ultima.finishedAt ?? inicio, ultima.trigger, 0));

  /** Una corrida en vuelo que ya pasó su duración simulada se cierra con un informe nuevo. */
  function avanzar(ahora: number): void {
    if (enVuelo === null || ahora - enVuelo.requestedAt < DURACION_SIMULADA_MS) return;
    enVuelo.status = 'COMPLETADA';
    enVuelo.finishedAt = ahora;
    historial.push(lineaDeHistorial(enVuelo.runId, ahora, enVuelo.trigger, 0));
    if (historial.length > HISTORIAL) historial.shift();
    ultima = enVuelo;
    enVuelo = null;
  }

  const sinAcceso = (
    req: MockRequest,
    roles: readonly string[],
    motivo: string,
  ): MockReply | null => {
    if (req.user === null) return unauthorized();
    return req.user.roles.some((r) => roles.includes(r)) ? null : forbidden(motivo);
  };

  router.get('/admin/catalog/fit', (req) => {
    const negado = sinAcceso(req, LECTURA, 'Hace falta un rol de lectura del catálogo de datos.');
    if (negado) return negado;
    const ahora = reloj();
    avanzar(ahora);
    const fin = ultima.finishedAt ?? ahora;
    const edad = Math.round((ahora - fin) / 1000);
    const vigente = edad <= TTL_SEGUNDOS;
    const respuesta: CatalogFit = {
      modelVersion: 'catalog-fit/v1',
      state: !vigente ? 'SIN_RESULTADO' : edad > ATRASADO_TRAS_SEGUNDOS ? 'ATRASADO' : 'VIGENTE',
      noResultReason: vigente ? null : 'EXPIRADO',
      ageSeconds: vigente ? edad : null,
      running: enVuelo === null ? null : vista(enVuelo),
      lastRun: vigente ? vista(ultima) : null,
      lastFailure: null,
      report: vigente ? informe(fin) : null,
      history: [...historial],
      retention: {
        kind: 'MEMORIA_DEL_PROCESO',
        ttlSeconds: TTL_SEGUNDOS,
        historySize: HISTORIAL,
        tickIntervalSeconds: REFRESCO_SEGUNDOS,
        staleAfterSeconds: ATRASADO_TRAS_SEGUNDOS,
        note: 'Simulado: los resultados reales viven en la memoria del proceso de la API; un reinicio los vacía.',
      },
    };
    return respuesta;
  });

  router.post('/admin/catalog/fit/run', (req) => {
    const negado = sinAcceso(
      req,
      ESCRITURA,
      'Hace falta un rol de escritura del catálogo de datos.',
    );
    if (negado) return negado;
    const clave = req.headers.get('Idempotency-Key');
    if (clave === null || !CLAVE_VALIDA.test(clave))
      return reply(422, {
        statusCode: 422,
        code: 'VALIDATION_FAILED',
        message:
          'La cabecera Idempotency-Key es obligatoria (8–128 caracteres: letras, números, . _ : -)',
        error: 'Unprocessable Entity',
        details: {
          violations: [
            { field: 'Idempotency-Key', reason: 'INVALID', message: 'Idempotency-Key inválida' },
          ],
        },
      });
    const ahora = reloj();
    avanzar(ahora);
    const previa = claves.get(clave);
    let run: SimRun;
    let creada = false;
    if (previa !== undefined) run = previa;
    else if (enVuelo !== null) run = enVuelo;
    else {
      run = {
        runId: uuid(contador++),
        trigger: 'MANUAL',
        requestedAt: ahora,
        status: 'EN_CURSO',
        finishedAt: null,
      };
      enVuelo = run;
      creada = true;
    }
    claves.set(clave, run);
    const cuerpo: FitRunAccepted = {
      runId: run.runId,
      status: run.status,
      created: creada,
      acceptedAt: iso(run.requestedAt),
      statusUrl: '/admin/catalog/fit',
    };
    return reply(202, cuerpo);
  });
}
