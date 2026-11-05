import type { MockRouter } from '../mock-router';
import type {
  Instance,
  InstanceLiveness,
  InstanceState,
} from '../../data-access/admin-portal/ops-liveness.types';

/* ============================================================================
    Backend SIMULADO de la sonda de vida (`GET /admin/ops/instances/liveness`).

    Devuelve el contrato exacto de la API (doc 04-sonda-de-vida §2.4) con
    datos sintéticos y fijos: dos corridas dan lo mismo salvo las fechas, que se
    calculan contra el reloj para que la antigüedad se vea verosímil. Cubre los
    cuatro estados (VIVA, DEGRADADA, CAÍDA, SIN DATO), las cuatro fuentes de
    evidencia y un `overall` CRÍTICO, para que la pantalla muestre su banner.

    Cada `causeDetail` empieza por «Simulado:» para que nadie confunda esto con
    una medición real.
    ========================================================================== */

const UMBRALES = {
  workerHeartbeatIntervalSeconds: 15,
  degradedAfterSeconds: 30,
  downAfterSeconds: 60,
  dependencyLatencyDegradedMs: 1000,
  dependencyProbeTimeoutMs: 3000,
  clockToleranceSeconds: 5,
} as const;

interface Semilla {
  readonly id: string;
  readonly label: string;
  readonly type: Instance['type'];
  readonly required: boolean;
  readonly state: InstanceState;
  /** `null` = nunca latió. */
  readonly ageSeconds: number | null;
  readonly thresholdSeconds: number | null;
  readonly cause: Instance['cause'];
  readonly causeDetail: string;
  readonly source: Instance['evidence']['source'];
  readonly reportedStatus: Instance['evidence']['reportedStatus'];
  readonly startedHoursAgo: number | null;
  readonly latencyMs: number | null;
}

const SEMILLAS: readonly Semilla[] = [
  { id: 'api', label: 'API', type: 'API', required: true, state: 'VIVA', ageSeconds: 0, thresholdSeconds: 60, cause: 'OK', causeDetail: 'Simulado: la API es quien evalúa; está respondiendo.', source: 'self', reportedStatus: 'running', startedHoursAgo: 31, latencyMs: null },
  { id: 'postgresql', label: 'PostgreSQL', type: 'DATABASE', required: true, state: 'VIVA', ageSeconds: 0, thresholdSeconds: null, cause: 'OK', causeDetail: 'Simulado: SELECT 1 respondió en 4 ms.', source: 'probe', reportedStatus: null, startedHoursAgo: null, latencyMs: 4 },
  { id: 'mongodb', label: 'MongoDB', type: 'DATABASE', required: true, state: 'VIVA', ageSeconds: 0, thresholdSeconds: null, cause: 'OK', causeDetail: 'Simulado: ping respondió en 6 ms.', source: 'probe', reportedStatus: null, startedHoursAgo: null, latencyMs: 6 },
  { id: 'redis', label: 'Redis', type: 'DATABASE', required: true, state: 'VIVA', ageSeconds: 0, thresholdSeconds: null, cause: 'OK', causeDetail: 'Simulado: PING respondió en 1 ms.', source: 'probe', reportedStatus: null, startedHoursAgo: null, latencyMs: 1 },
  { id: 'opensearch', label: 'OpenSearch', type: 'SERVICE', required: true, state: 'DEGRADADA', ageSeconds: 0, thresholdSeconds: null, cause: 'PROBE_SLOW', causeDetail: 'Simulado: el clúster respondió en 1 850 ms; el umbral es 1 000 ms.', source: 'probe', reportedStatus: null, startedHoursAgo: null, latencyMs: 1850 },
  { id: 'minio', label: 'MinIO (archivos)', type: 'SERVICE', required: true, state: 'VIVA', ageSeconds: 0, thresholdSeconds: null, cause: 'OK', causeDetail: 'Simulado: /minio/health/live respondió en 12 ms.', source: 'probe', reportedStatus: null, startedHoursAgo: null, latencyMs: 12 },
  { id: 'clamav', label: 'ClamAV (antivirus)', type: 'SERVICE', required: false, state: 'SIN_DATO', ageSeconds: null, thresholdSeconds: null, cause: 'NOT_PROBED', causeDetail: 'Simulado: el antivirus no se sondea desde la API en este entorno.', source: 'none', reportedStatus: null, startedHoursAgo: null, latencyMs: null },
  { id: 'mock-provider-server', label: 'Emulador de proveedores', type: 'SERVICE', required: false, state: 'SIN_DATO', ageSeconds: null, thresholdSeconds: null, cause: 'NOT_PROBED', causeDetail: 'Simulado: sólo existe en desarrollo; no se vigila.', source: 'none', reportedStatus: null, startedHoursAgo: null, latencyMs: null },
  { id: 'worker-messaging', label: 'Mensajería', type: 'WORKER', required: true, state: 'VIVA', ageSeconds: 5, thresholdSeconds: 60, cause: 'OK', causeDetail: 'Simulado: último latido hace 5 s.', source: 'heartbeat', reportedStatus: 'running', startedHoursAgo: 31, latencyMs: null },
  { id: 'worker-scheduling', label: 'Agenda', type: 'WORKER', required: true, state: 'VIVA', ageSeconds: 9, thresholdSeconds: 60, cause: 'OK', causeDetail: 'Simulado: último latido hace 9 s.', source: 'heartbeat', reportedStatus: 'running', startedHoursAgo: 31, latencyMs: null },
  { id: 'worker-billing', label: 'Facturación', type: 'WORKER', required: true, state: 'DEGRADADA', ageSeconds: 42, thresholdSeconds: 60, cause: 'HEARTBEAT_LATE', causeDetail: 'Simulado: el latido llegó hace 42 s; se esperaba cada 15 s.', source: 'heartbeat', reportedStatus: 'running', startedHoursAgo: 2, latencyMs: null },
  { id: 'worker-notifications', label: 'Notificaciones', type: 'WORKER', required: true, state: 'CAIDA', ageSeconds: 1380, thresholdSeconds: 60, cause: 'HEARTBEAT_EXPIRED', causeDetail: 'Simulado: el último latido llegó hace 23 min; el umbral es 60 s.', source: 'heartbeat', reportedStatus: 'running', startedHoursAgo: 31, latencyMs: null },
  { id: 'worker-reporting', label: 'Reportería', type: 'WORKER', required: true, state: 'VIVA', ageSeconds: 3, thresholdSeconds: 60, cause: 'OK', causeDetail: 'Simulado: último latido hace 3 s.', source: 'heartbeat', reportedStatus: 'running', startedHoursAgo: 31, latencyMs: null },
  { id: 'worker-insurance', label: 'Seguros', type: 'WORKER', required: true, state: 'DEGRADADA', ageSeconds: 7, thresholdSeconds: 60, cause: 'CIRCUIT_OPEN', causeDetail: 'Simulado: late, pero cortó el trabajo tras 5 fallas seguidas contra la aseguradora.', source: 'heartbeat', reportedStatus: 'running', startedHoursAgo: 31, latencyMs: null },
  { id: 'worker-files', label: 'Archivos (opcional)', type: 'WORKER', required: false, state: 'SIN_DATO', ageSeconds: null, thresholdSeconds: null, cause: 'NEVER_SEEN', causeDetail: 'Simulado: worker opcional; nunca envió un latido en este entorno.', source: 'none', reportedStatus: null, startedHoursAgo: null, latencyMs: null },
  { id: 'worker-analytics', label: 'Analítica', type: 'WORKER', required: true, state: 'VIVA', ageSeconds: 11, thresholdSeconds: 60, cause: 'DRAINING', causeDetail: 'Simulado: está terminando lo pendiente antes de reiniciarse.', source: 'heartbeat', reportedStatus: 'draining', startedHoursAgo: 0, latencyMs: null },
];

const NO_MEDIDO = ['replicasOfApi', 'storageObjectStore', 'malwareScanner', 'providerEmulator', 'processInternals'] as const;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** La respuesta entera, evaluada «ahora»: las fechas se mueven, los estados no. */
export function sondaDeVidaSimulada(ahora = Date.now()): InstanceLiveness {
  const instances: Instance[] = SEMILLAS.map((s) => ({
    id: s.id,
    label: s.label,
    type: s.type,
    required: s.required,
    state: s.state,
    lastHeartbeatAt: s.ageSeconds === null ? null : iso(ahora - s.ageSeconds * 1000),
    ageSeconds: s.ageSeconds,
    thresholdSeconds: s.thresholdSeconds,
    cause: s.cause,
    causeDetail: s.causeDetail,
    evidence: {
      source: s.source,
      reportedStatus: s.reportedStatus,
      startedAt: s.startedHoursAgo === null ? null : iso(ahora - s.startedHoursAgo * 3_600_000 - 17 * 60_000),
      latencyMs: s.latencyMs,
    },
  }));
  const contar = (estado: InstanceState) => instances.filter((i) => i.state === estado).length;
  const summary = { VIVA: contar('VIVA'), DEGRADADA: contar('DEGRADADA'), CAIDA: contar('CAIDA'), SIN_DATO: contar('SIN_DATO'), total: instances.length };
  const caidaObligatoria = instances.some((i) => i.required && i.state === 'CAIDA');
  const degradada = instances.some((i) => i.state === 'DEGRADADA');
  return {
    modelVersion: 'instance-liveness/v1',
    evaluatedAt: iso(ahora),
    overall: caidaObligatoria ? 'CRITICO' : degradada ? 'ATENCION' : 'OK',
    summary,
    heartbeatStore: { status: 'up', reason: null },
    thresholds: UMBRALES,
    instances,
    notMeasured: [...NO_MEDIDO],
  };
}

export function registrarSondaDeVida(router: MockRouter): void {
  router.get('/admin/ops/instances/liveness', () => sondaDeVidaSimulada());
}
