import type { MockRouter } from '../mock-router';
import { notFound, preconditionFailed } from '../mock-router';
import type {
  DiscoveryReport,
  EvidenceLevel,
  PieceCause,
  PieceKind,
  PieceState,
  RuntimeFinding,
  RuntimeInstance,
  RuntimePiece,
  RuntimePiecesPage,
} from '../../data-access/admin-portal/runtime-pieces.types';
import { PIECE_KINDS, PIECE_STATES } from '../../data-access/admin-portal/runtime-pieces.types';

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

interface Semilla {
  readonly id: string;
  readonly kind: PieceKind;
  readonly name: string;
  readonly module: string;
  readonly hosts: readonly string[];
  readonly file: string;
  readonly line: number;
  readonly how: string;
  readonly envVars?: readonly string[];
  readonly schedule?: RuntimePiece['schedule'];
  readonly heartbeat: RuntimePiece['heartbeat'];
  readonly wired?: boolean;
  /** Estado cuando la pieza está registrada. */
  readonly state: PieceState;
  readonly cause: PieceCause;
  readonly detail: string;
  readonly level: EvidenceLevel;
  readonly required?: boolean | null;
  /** `false`: la fila sólo está en el registro (el código ya no la tiene). */
  readonly inCode?: boolean;
  /** `false`: falta en el registro hasta que se descubra. */
  readonly registered?: boolean;
  readonly disabledInRegistry?: boolean;
  readonly attributes?: RuntimePiece['attributes'];
}

const intervalo = (ms: number, raw: string): NonNullable<RuntimePiece['schedule']> => ({
  type: 'interval',
  intervalMs: ms,
  cron: null,
  raw,
});

const SEMILLAS: readonly Semilla[] = [
  {
    id: 'rtp.proceso.api',
    kind: 'PROCESO',
    name: 'API HTTP',
    module: 'app',
    hosts: ['api'],
    file: 'src/main.ts',
    line: 89,
    how: 'proceso principal del contenedor `api`',
    heartbeat: { mode: 'SELF', instanceId: 'api' },
    state: 'VIVA',
    cause: 'SELF',
    detail: 'Simulado: la instancia que respondió esta consulta.',
    level: 'PROPIO',
    required: true,
  },
  {
    id: 'rtp.proceso.worker-messaging',
    kind: 'PROCESO',
    name: 'Worker messaging',
    module: 'messaging',
    hosts: ['worker-messaging'],
    file: 'src/worker-messaging.ts',
    line: 4,
    how: 'servicio de compose en docker-compose.yml y docker-compose.coolify.yml',
    envVars: ['WORKER_HEALTH_PORT'],
    heartbeat: { mode: 'PROCESS', instanceId: 'worker-messaging' },
    state: 'VIVA',
    cause: 'OK',
    detail: 'Simulado: último latido hace 5 s.',
    level: 'PROPIO',
    required: true,
    attributes: { inComposeDev: true, inCoolify: true, optIn: false },
  },
  {
    id: 'rtp.proceso.worker-scheduling',
    kind: 'PROCESO',
    name: 'Worker scheduling',
    module: 'scheduling',
    hosts: ['worker-scheduling'],
    file: 'src/worker-scheduling.ts',
    line: 4,
    how: 'servicio de compose en docker-compose.yml y docker-compose.coolify.yml',
    envVars: ['WORKER_HEALTH_PORT'],
    heartbeat: { mode: 'PROCESS', instanceId: 'worker-scheduling' },
    state: 'VIVA',
    cause: 'HEARTBEAT_LATE',
    detail:
      'Simulado: latido reciente pero degradado: último latido hace 42 s, por encima de 30 s.',
    level: 'PROPIO',
    required: true,
    attributes: { inComposeDev: true, inCoolify: true, optIn: false },
  },
  {
    id: 'rtp.proceso.worker-billing',
    kind: 'PROCESO',
    name: 'Worker billing',
    module: 'billing',
    hosts: ['worker-billing'],
    file: 'src/worker-billing.ts',
    line: 4,
    how: 'servicio de compose en docker-compose.yml',
    envVars: ['WORKER_HEALTH_PORT'],
    heartbeat: { mode: 'PROCESS', instanceId: 'worker-billing' },
    state: 'SIN_LATIDO',
    cause: 'HEARTBEAT_EXPIRED',
    detail: 'Simulado: worker-billing: sin latido desde hace 1380 s (umbral 60 s).',
    level: 'NINGUNO',
    required: true,
    attributes: { inComposeDev: true, inCoolify: false, optIn: false },
  },
  {
    id: 'rtp.proceso.worker-files',
    kind: 'PROCESO',
    name: 'Worker files',
    module: 'files',
    hosts: ['worker-files'],
    file: 'src/worker-files.ts',
    line: 8,
    how: 'servicio de compose en docker-compose.yml; perfil opt-in malware-scan',
    envVars: ['WORKER_HEALTH_PORT'],
    heartbeat: { mode: 'PROCESS', instanceId: 'worker-files' },
    state: 'SIN_LATIDO',
    cause: 'NEVER_SEEN',
    detail: 'Simulado: worker-files: ningún latido recibido de esta instancia.',
    level: 'NINGUNO',
    required: false,
    attributes: { inComposeDev: true, inCoolify: false, optIn: true },
  },
  {
    id: 'rtp.job.messaging.outbox-relay',
    kind: 'JOB_PROGRAMADO',
    name: 'messaging/outbox-relay',
    module: 'messaging',
    hosts: ['worker-messaging'],
    file: 'src/worker/jobs/messaging/outbox-relay.job.ts',
    line: 49,
    how: 'dentro de worker-messaging; sin interruptor propio',
    schedule: intervalo(5000, 'RELAY_INTERVAL_MS'),
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-messaging' },
    wired: true,
    state: 'VIVA',
    cause: 'HOST_ALIVE',
    detail: 'Simulado: vive en worker-messaging, que late.',
    level: 'ANFITRION',
    required: true,
  },
  {
    id: 'rtp.job.scheduling.expire-holds',
    kind: 'JOB_PROGRAMADO',
    name: 'scheduling/expire-holds',
    module: 'scheduling',
    hosts: ['worker-scheduling'],
    file: 'src/worker/jobs/scheduling/expire-holds.job.ts',
    line: 30,
    how: 'dentro de worker-scheduling; sin interruptor propio',
    schedule: intervalo(30_000, 'EXPIRE_HOLDS_INTERVAL_MS'),
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-scheduling' },
    wired: true,
    state: 'VIVA',
    cause: 'HEARTBEAT_LATE',
    detail: 'Simulado: latido reciente pero degradado: último latido hace 42 s.',
    level: 'ANFITRION',
    required: true,
  },
  {
    id: 'rtp.job.billing.run-due-dunning',
    kind: 'JOB_PROGRAMADO',
    name: 'billing/run-due-dunning',
    module: 'billing',
    hosts: ['worker-billing'],
    file: 'src/worker/jobs/billing/run-due-dunning.job.ts',
    line: 34,
    how: 'dentro de worker-billing; sin interruptor propio',
    schedule: intervalo(3_600_000, 'RUN_DUE_DUNNING_INTERVAL_MS'),
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-billing' },
    wired: true,
    state: 'SIN_LATIDO',
    cause: 'HEARTBEAT_EXPIRED',
    detail: 'Simulado: worker-billing: sin latido desde hace 1380 s (umbral 60 s).',
    level: 'NINGUNO',
    required: true,
  },
  {
    id: 'rtp.job.files.malware-scan',
    kind: 'JOB_PROGRAMADO',
    name: 'files/malware-scan',
    module: 'files',
    hosts: ['worker-files'],
    file: 'src/worker/jobs/files/malware-scan.job.ts',
    line: 119,
    how: 'dentro de worker-files; condicionada por MALWARE_SCAN_ENABLED',
    envVars: ['MALWARE_SCAN_ENABLED'],
    schedule: intervalo(30_000, 'SCAN_INTERVAL_MS'),
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-files' },
    wired: true,
    state: 'DESHABILITADA',
    cause: 'REGISTRY_DISABLED',
    detail: 'Simulado: el registro la marca como deshabilitada.',
    level: 'NINGUNO',
    required: false,
    disabledInRegistry: true,
  },
  {
    id: 'rtp.job.profiles.admissions-expire-sweep.cron',
    kind: 'JOB_PROGRAMADO',
    name: 'profiles/admissions-expire-sweep (cron)',
    module: 'profiles',
    hosts: ['worker-profiles'],
    file: 'src/worker/jobs/profiles/admissions-expire-sweep.job.ts',
    line: 108,
    how: 'dentro de worker-profiles; condicionada por ADMISSIONS_EXPIRE_SWEEP_ENABLED',
    envVars: ['ADMISSIONS_EXPIRE_SWEEP_CRON', 'ADMISSIONS_EXPIRE_SWEEP_ENABLED'],
    schedule: { type: 'cron', intervalMs: null, cron: '0 * * * *', raw: 'expression' },
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-profiles' },
    wired: true,
    state: 'NO_MEDIBLE',
    cause: 'HOST_UNRESOLVED',
    detail: 'Simulado: la instancia «worker-profiles» no está en el registro de la sonda de vida.',
    level: 'NINGUNO',
    required: null,
    registered: false,
  },
  {
    id: 'rtp.timer.observability.http-sli.http-sli-flush.service',
    kind: 'TEMPORIZADOR',
    name: 'Temporizador de HttpSliFlushService',
    module: 'observability',
    hosts: ['api'],
    file: 'src/observability/http-sli/http-sli-flush.service.ts',
    line: 79,
    how: 'dentro de api; condicionada por OBSERVABILITY_HTTP_SLI_ENABLED',
    envVars: ['OBSERVABILITY_HTTP_SLI_ENABLED'],
    schedule: {
      type: 'interval',
      intervalMs: null,
      cron: null,
      raw: 'this.env.flushSeconds * 1000',
    },
    heartbeat: { mode: 'INHERITED', instanceId: 'api' },
    wired: true,
    state: 'VIVA',
    cause: 'HOST_ALIVE',
    detail: 'Simulado: vive en la API, que responde.',
    level: 'ANFITRION',
    required: true,
  },
  {
    id: 'rtp.cola.handler.audio.generate',
    kind: 'CONSUMIDOR_COLA',
    name: 'Manejador de la cola para "audio.generate"',
    module: 'audio_assets',
    hosts: ['worker-audio-assets'],
    file: 'src/worker/jobs/audio_assets/audio-generation.job.ts',
    line: 54,
    how: 'se registra al arrancar el worker que lo declara',
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-audio-assets' },
    state: 'VIVA',
    cause: 'HOST_ALIVE',
    detail: 'Simulado: vive en worker-audio-assets, que late.',
    level: 'ANFITRION',
    required: true,
    attributes: { mechanism: 'registerQueueJobHandler', jobType: 'audio.generate' },
  },
  {
    id: 'rtp.jobtype.legacy.reindex',
    kind: 'JOB_NOMBRADO',
    name: 'Job "legacy.reindex"',
    module: 'search',
    hosts: [],
    file: 'src/modules/search/search.constants.ts',
    line: 12,
    how: 'se encola desde la API; lo consume el handler registrado para ese jobType',
    heartbeat: { mode: 'NONE', instanceId: null },
    state: 'NO_MEDIBLE',
    cause: 'NO_HEARTBEAT_MECHANISM',
    detail: 'Simulado: esta clase de pieza no emite ni tiene latido.',
    level: 'NINGUNO',
    required: null,
    attributes: { constant: 'LEGACY_REINDEX_JOB_TYPE', jobType: 'legacy.reindex' },
  },
  {
    id: 'rtp.http.post.internal-outbox-relay-run',
    kind: 'ENDPOINT_INTERNO',
    name: 'POST /internal/outbox/relay/run',
    module: 'messaging',
    hosts: ['api'],
    file: 'src/modules/messaging/controllers/messaging-internal.controller.ts',
    line: 78,
    how: 'lo invoca un worker o el pipeline; roles: SYSTEM, MESSAGING_ADMIN',
    heartbeat: { mode: 'INHERITED', instanceId: 'api' },
    wired: true,
    state: 'VIVA',
    cause: 'HOST_ALIVE',
    detail: 'Simulado: vive en la API, que responde.',
    level: 'ANFITRION',
    required: true,
    attributes: { roles: 'SYSTEM, MESSAGING_ADMIN', systemOnly: false },
  },
  {
    id: 'rtp.salud.http.readiness',
    kind: 'SALUD',
    name: 'GET /readiness',
    module: 'app',
    hosts: ['api'],
    file: 'src/app.controller.ts',
    line: 63,
    how: 'pública, sin autenticación',
    heartbeat: { mode: 'INHERITED', instanceId: 'api' },
    wired: true,
    state: 'VIVA',
    cause: 'HOST_ALIVE',
    detail: 'Simulado: vive en la API, que responde.',
    level: 'ANFITRION',
    required: true,
  },
  {
    id: 'rtp.conector.common.storage.s3-file-storage.adapter',
    kind: 'CONECTOR',
    name: 'S3FileStorageAdapter',
    module: 'common',
    hosts: ['api', 'worker-files'],
    file: 'src/common/storage/s3-file-storage.adapter.ts',
    line: 7,
    how: 'se instancia en api, worker-files',
    envVars: ['S3_BUCKET'],
    heartbeat: { mode: 'INHERITED', instanceId: 'api' },
    wired: true,
    state: 'VIVA',
    cause: 'HOST_ALIVE',
    detail: 'Simulado: vive en la API, que responde.',
    level: 'ANFITRION',
    required: true,
    attributes: { protocols: 'aws-s3' },
  },
  {
    id: 'rtp.conector.modules.payments.gateway.payments-gateway.client',
    kind: 'CONECTOR',
    name: 'PaymentsGatewayClient',
    module: 'payments',
    hosts: [],
    file: 'src/modules/payments/gateway/payments-gateway.client.ts',
    line: 1,
    how: 'proveedor sin proceso anfitrión resuelto',
    heartbeat: { mode: 'INHERITED', instanceId: null },
    wired: false,
    state: 'NO_MEDIBLE',
    cause: 'HOST_UNRESOLVED',
    detail: 'Simulado: no se pudo resolver en qué proceso corre (ningún módulo la registra).',
    level: 'NINGUNO',
    required: null,
    attributes: { protocols: 'http' },
  },
  {
    id: 'rtp.job.community.old-ranking',
    kind: 'JOB_PROGRAMADO',
    name: 'community/old-ranking',
    module: '—',
    hosts: [],
    file: 'src/worker/jobs/community/old-ranking.job.ts',
    line: 30,
    how: 'sin datos: no está en el código',
    heartbeat: { mode: 'INHERITED', instanceId: 'worker-community' },
    state: 'HUERFANA',
    cause: 'NOT_IN_CODE',
    detail: 'Simulado: está en el registro de herramientas pero ya no existe en el código.',
    level: 'NINGUNO',
    required: null,
    inCode: false,
  },
];

const HALLAZGOS: readonly RuntimeFinding[] = [
  {
    id: 'SIN_LATIDO_REQUERIDA:rtp.proceso.worker-billing',
    rule: 'SIN_LATIDO_REQUERIDA',
    severity: 'ALTA',
    pieceId: 'rtp.proceso.worker-billing',
    message:
      'Simulado: Worker billing es requerida y no se oye: worker-billing: sin latido desde hace 1380 s (umbral 60 s).',
  },
  {
    id: 'NO_CABLEADA:rtp.conector.modules.payments.gateway.payments-gateway.client',
    rule: 'NO_CABLEADA',
    severity: 'ALTA',
    pieceId: 'rtp.conector.modules.payments.gateway.payments-gateway.client',
    message:
      'Simulado: PaymentsGatewayClient está declarada pero ningún módulo la registra: nunca correrá.',
  },
  {
    id: 'JOB_SIN_CONSUMIDOR:rtp.jobtype.legacy.reindex',
    rule: 'JOB_SIN_CONSUMIDOR',
    severity: 'ALTA',
    pieceId: 'rtp.jobtype.legacy.reindex',
    message:
      'Simulado: El job "legacy.reindex" se puede encolar pero ningún manejador está registrado para consumirlo.',
  },
  {
    id: 'NO_REGISTRADA:rtp.job.profiles.admissions-expire-sweep.cron',
    rule: 'NO_REGISTRADA',
    severity: 'MEDIA',
    pieceId: 'rtp.job.profiles.admissions-expire-sweep.cron',
    message:
      'Simulado: profiles/admissions-expire-sweep (cron) existe en el código y no está registrada.',
  },
  {
    id: 'HUERFANA:rtp.job.community.old-ranking',
    rule: 'HUERFANA',
    severity: 'MEDIA',
    pieceId: 'rtp.job.community.old-ranking',
    message: 'Simulado: community/old-ranking está registrada pero ya no existe en el código.',
  },
  {
    id: 'SIN_LATIDO:rtp.proceso.worker-files',
    rule: 'SIN_LATIDO',
    severity: 'BAJA',
    pieceId: 'rtp.proceso.worker-files',
    message:
      'Simulado: Worker files no se oye (no es requerida en este entorno): worker-files: ningún latido recibido de esta instancia.',
  },
];

const INSTANCIAS: readonly Omit<RuntimeInstance, 'pieceCount' | 'piecesByKind'>[] = [
  {
    id: 'api',
    label: 'API',
    type: 'API',
    required: true,
    state: 'VIVA',
    cause: 'OK',
    causeDetail: 'Simulado: la instancia que respondió esta consulta.',
    lastHeartbeatAt: null,
    ageSeconds: null,
    startedAt: null,
    reportedStatus: 'running',
  },
  {
    id: 'worker-messaging',
    label: 'Mensajería',
    type: 'WORKER',
    required: true,
    state: 'VIVA',
    cause: 'OK',
    causeDetail: 'Simulado: latido fresco hace 5 s',
    lastHeartbeatAt: 'AHORA-5',
    ageSeconds: 5,
    startedAt: 'INICIO',
    reportedStatus: 'running',
  },
  {
    id: 'worker-scheduling',
    label: 'Agenda',
    type: 'WORKER',
    required: true,
    state: 'DEGRADADA',
    cause: 'HEARTBEAT_LATE',
    causeDetail: 'Simulado: último latido hace 42 s, por encima de 30 s',
    lastHeartbeatAt: 'AHORA-42',
    ageSeconds: 42,
    startedAt: 'INICIO',
    reportedStatus: 'running',
  },
  {
    id: 'worker-billing',
    label: 'Facturación',
    type: 'WORKER',
    required: true,
    state: 'CAIDA',
    cause: 'HEARTBEAT_EXPIRED',
    causeDetail: 'Simulado: sin latido desde hace 1380 s (umbral 60 s)',
    lastHeartbeatAt: 'AHORA-1380',
    ageSeconds: 1380,
    startedAt: 'INICIO',
    reportedStatus: 'running',
  },
  {
    id: 'worker-files',
    label: 'Archivos',
    type: 'WORKER',
    required: false,
    state: 'SIN_DATO',
    cause: 'NEVER_SEEN',
    causeDetail: 'Simulado: ningún latido recibido de esta instancia',
    lastHeartbeatAt: null,
    ageSeconds: null,
    startedAt: null,
    reportedStatus: null,
  },
];

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
