import type {
  CatalogFit,
  FitCheckResult,
  FitDimension,
  FitDimensionScore,
  FitHistoryEntry,
  FitReport,
  FitRunAccepted,
  FitRunView,
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
import { SEMILLAS, type Semilla } from './catalog-fit.seed';

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
