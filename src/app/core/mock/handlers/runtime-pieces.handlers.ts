import type { MockRouter } from '../mock-router';
import { notFound, preconditionFailed } from '../mock-router';
import type {
  DiscoveryReport,
  PieceCause,
  PieceKind,
  PieceState,
  RuntimeInstance,
  RuntimePiece,
  RuntimePiecesPage,
} from '../../data-access/admin-portal/runtime-pieces.types';
import { PIECE_KINDS, PIECE_STATES } from '../../data-access/admin-portal/runtime-pieces.types';
import { SEMILLAS, HALLAZGOS, INSTANCIAS, type Semilla } from './runtime-pieces.seed';

/* ============================================================================
    Backend SIMULADO de las piezas en ejecución
    (`GET /admin/ops/runtime-pieces`, `GET …/:id`, `POST …/discover`).

    Devuelve el contrato exacto de la API con datos sintéticos y fijos. Cubre
    los seis estados, los ocho tipos, las tres clases de evidencia y hallazgos
    de cada gravedad, para que la pantalla muestre todo lo que sabe decir.
    Ninguna cifra de aquí es una medición: cada `causeDetail` empieza por
    «Simulado:».

    El descubrimiento simulado es IDEMPOTENTE como el real: la primera corrida
    «registra» las piezas que faltan; la segunda no cambia nada. Cada
    `registrarPiezasVivas` arma su propio estado, así que dos pruebas no se
    pisan.
    ========================================================================== */


const NO_MEDIDO = [
  'TICK_INDIVIDUAL: sólo se observa el latido del proceso anfitrión, no que cada tick corra',
  'REPLICAS: varias réplicas de un mismo worker comparten identificador y no se distinguen',
  'CODIGO_DINAMICO: rutas, jobs o cron que se arman en tiempo de ejecución sin literal en el código no los ve el escáner estático',
  'ENTORNO_DE_OTROS_PROCESOS: los interruptores de las piezas que corren en workers se leen del código, no del entorno de ese worker',
] as const;

const iso = (ms: number): string => new Date(ms).toISOString();

function pieza(s: Semilla, registradas: ReadonlySet<string>): RuntimePiece {
  const registrada = registradas.has(s.id);
  // Una pieza recién registrada pasa de «no registrada» a lo que le toca por su latido.
  const state: PieceState = s.registered === false && !registrada ? 'NO_REGISTRADA' : s.state;
  const cause: PieceCause = s.registered === false && !registrada ? 'NOT_IN_REGISTRY' : s.cause;
  const detail =
    s.registered === false && !registrada
      ? 'Simulado: existe en el código y no está en el registro de herramientas.'
      : s.detail;
  return {
    id: s.id,
    kind: s.kind,
    name: s.name,
    module: s.module,
    hosts: s.hosts,
    state,
    cause,
    causeDetail: detail,
    evidenceLevel: state === 'NO_REGISTRADA' || state === 'HUERFANA' ? 'NINGUNO' : s.level,
    instanceState: null,
    inCode: s.inCode === false ? false : true,
    wired: s.wired ?? null,
    required: s.required ?? null,
    evidence: { file: s.file, line: s.line },
    schedule: s.schedule ?? null,
    enable: { how: s.how, envVars: s.envVars ?? [], launchers: [] },
    heartbeat: s.heartbeat,
    attributes: s.attributes ?? {},
    registry: {
      present: registrada,
      active: registrada ? s.disabledInRegistry !== true : null,
      provenance: registrada
        ? {
            source: 'descubrimiento-estatico',
            evidence: `${s.file}:${s.line}`,
            discoveredAt: '2026-10-30',
            fingerprint: '0123456789abcdef',
            kind: s.kind,
            heartbeat: `${s.heartbeat.mode}:${s.heartbeat.instanceId ?? '-'}`,
          }
        : null,
      stale: registrada ? false : null,
    },
  };
}

/** La respuesta entera, evaluada «ahora»: las fechas se mueven, los estados no. */
export function piezasVivasSimuladas(
  query: URLSearchParams = new URLSearchParams(),
  registradas: ReadonlySet<string> = registradasInicialmente(),
  ahora = Date.now(),
): RuntimePiecesPage {
  const todas = SEMILLAS.map((s) => pieza(s, registradas));
  const hallazgos = HALLAZGOS.filter((h) => {
    const p = todas.find((x) => x.id === h.pieceId);
    // Un hallazgo de «no registrada» desaparece cuando se registra.
    return !(h.rule === 'NO_REGISTRADA' && p?.registry.present === true);
  });
  const conHallazgo = new Set(hallazgos.map((h) => h.pieceId));
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize') ?? 25) || 25));
  const q = (query.get('q') ?? '').trim().toLowerCase();
  const filtradas = todas.filter(
    (p) =>
      (!query.get('kind') || p.kind === query.get('kind')) &&
      (!query.get('state') || p.state === query.get('state')) &&
      (!query.get('host') || p.hosts.includes(query.get('host') as string)) &&
      (!query.get('module') || p.module === query.get('module')) &&
      (query.get('withFindings') !== 'true' || conHallazgo.has(p.id)) &&
      (q === '' ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.evidence.file.toLowerCase().includes(q)),
  );
  const byState = Object.fromEntries(
    PIECE_STATES.map((e) => [e, todas.filter((p) => p.state === e).length]),
  ) as Record<PieceState, number>;
  const byKind = Object.fromEntries(
    PIECE_KINDS.map((k) => [k, todas.filter((p) => p.kind === k).length]),
  ) as Record<PieceKind, number>;
  const instances: RuntimeInstance[] = INSTANCIAS.map((i) => {
    const alojadas = todas.filter((p) => p.hosts.includes(i.id));
    const porTipo: Partial<Record<PieceKind, number>> = {};
    for (const p of alojadas) porTipo[p.kind] = (porTipo[p.kind] ?? 0) + 1;
    return {
      ...i,
      lastHeartbeatAt: i.lastHeartbeatAt?.startsWith('AHORA-')
        ? iso(ahora - Number(i.lastHeartbeatAt.slice(6)) * 1000)
        : i.lastHeartbeatAt,
      startedAt: i.startedAt === 'INICIO' ? iso(ahora - 31 * 3_600_000) : i.startedAt,
      pieceCount: alojadas.length,
      piecesByKind: porTipo,
    };
  });
  return {
    data: filtradas.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      page,
      pageSize,
      total: filtradas.length,
      totalPages: Math.ceil(filtradas.length / pageSize),
    },
    evaluatedAt: iso(ahora),
    summary: { total: todas.length, byState, byKind },
    scan: {
      available: true,
      source: 'manifest',
      generatedAt: iso(ahora - 31 * 3_600_000),
      reason: null,
      filesRead: 4770,
      warnings: [],
    },
    heartbeatStore: { status: 'up', reason: null },
    thresholds: {
      workerHeartbeatIntervalSeconds: 15,
      degradedAfterSeconds: 30,
      downAfterSeconds: 60,
    },
    instances,
    findings: hallazgos,
    notMeasured: [...NO_MEDIDO],
  };
}

/** Lo que el registro ya tiene antes del primer descubrimiento (todo menos lo marcado `registered: false`). */
export function registradasInicialmente(): ReadonlySet<string> {
  return new Set(SEMILLAS.filter((s) => s.registered !== false).map((s) => s.id));
}

export function registrarPiezasVivas(router: MockRouter): void {
  const registradas = new Set(registradasInicialmente());

  router.get('/admin/ops/runtime-pieces', ({ query }) => piezasVivasSimuladas(query, registradas));

  router.get('/admin/ops/runtime-pieces/:id', ({ params }) => {
    const id = decodeURIComponent(params['id'] ?? '');
    const semilla = SEMILLAS.find((s) => s.id === id);
    if (!semilla) return notFound('Pieza no encontrada');
    const completa = piezasVivasSimuladas(new URLSearchParams(), registradas);
    const p = pieza(semilla, registradas);
    return {
      ...p,
      evaluatedAt: completa.evaluatedAt,
      findings: completa.findings.filter((h) => h.pieceId === id),
      launchers: p.enable.launchers,
    };
  });

  router.post('/admin/ops/runtime-pieces/discover', ({ body }) => {
    const dryRun = (body as { dryRun?: unknown } | null)?.dryRun === true;
    if (
      body !== null &&
      typeof body === 'object' &&
      Object.keys(body).some((k) => k !== 'dryRun')
    ) {
      return preconditionFailed('Simulado: el cuerpo sólo admite dryRun.');
    }
    const faltan = SEMILLAS.filter((s) => s.inCode !== false && !registradas.has(s.id));
    if (!dryRun) for (const s of faltan) registradas.add(s.id);
    const huerfanas = SEMILLAS.filter((s) => s.inCode === false).map((s) => s.id);
    const enCodigo = SEMILLAS.filter((s) => s.inCode !== false);
    const informe: DiscoveryReport = {
      dryRun,
      discoveredAt: '2026-10-31',
      scanned: enCodigo.length,
      created: faltan.length,
      updated: 0,
      unchanged: enCodigo.length - faltan.length,
      orphans: huerfanas.length,
      conflicts: 0,
      createdIds: faltan.map((s) => s.id),
      updatedIds: [],
      orphanIds: huerfanas,
      conflictIds: [],
      warnings: [],
    };
    return informe;
  });
}
