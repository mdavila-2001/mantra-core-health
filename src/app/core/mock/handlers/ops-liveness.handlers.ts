import type { MockRouter } from '../mock-router';
import type {
  InstancesLiveness,
  LivenessInstance,
  LivenessState,
} from '../../data-access/admin-portal/ops-liveness.types';

/* ============================================================================
    Backend simulado de la sonda de vida (`GET /admin/ops/instances/liveness`).

    **DATOS SINTÉTICOS.** Nada de acá se midió: es un conjunto fijo y declarado
    como simulado —cada `evidence` empieza con «SIMULADO»— que cubre los cuatro
    estados (VIVA, DEGRADADA, CAIDA, SIN_DATO) para ver la pantalla en `mockup`.
    No sustituye a la sonda real: lo que falta verificar contra la API es el
    contrato publicado y la medición de verdad.

    Reproduce las reglas del servidor:
    - La edad es `evaluatedAt − lastHeartbeatAt` y cae en el estado que dicen
      los umbrales (≤ live → VIVA; ≤ degraded → DEGRADADA; más → CAIDA).
    - Sin latido nunca es VIVA ni CAIDA: es SIN_DATO (`NEVER_SEEN`).
    - `overall` sale de las instancias **requeridas** y VIVA sólo si todas lo
      están (ver {@link estadoGeneral}).
    ========================================================================== */

const UMBRALES = { heartbeatIntervalSeconds: 15, liveSeconds: 30, degradedSeconds: 60 } as const;

/** Instancias fijas: `ageSeconds` es relativo al instante de la consulta. */
const BASE: readonly Omit<LivenessInstance, 'lastHeartbeatAt'>[] = [
  {
    id: 'api',
    type: 'api',
    required: true,
    state: 'VIVA',
    ageSeconds: 0,
    thresholdSeconds: 60,
    cause: null,
    evidence:
      'SIMULADO · Es la instancia que respondió esta consulta: prueba que esa réplica atiende, no que haya otras.',
  },
  {
    id: 'postgresql',
    type: 'database',
    required: true,
    state: 'VIVA',
    ageSeconds: 1,
    thresholdSeconds: 3,
    cause: null,
    evidence: 'SIMULADO · Sonda en la petición: respondió en 12 ms.',
  },
  {
    id: 'mongodb',
    type: 'database',
    required: true,
    state: 'VIVA',
    ageSeconds: 1,
    thresholdSeconds: 3,
    cause: null,
    evidence: 'SIMULADO · Sonda en la petición: respondió en 18 ms.',
  },
  {
    id: 'redis',
    type: 'database',
    required: true,
    state: 'VIVA',
    ageSeconds: 1,
    thresholdSeconds: 3,
    cause: null,
    evidence: 'SIMULADO · Sonda en la petición: respondió en 4 ms.',
  },
  {
    id: 'opensearch',
    type: 'database',
    required: true,
    state: 'DEGRADADA',
    ageSeconds: 2,
    thresholdSeconds: 3,
    cause: 'PROBE_SLOW',
    evidence: 'SIMULADO · Respondió, pero en 1 450 ms (el límite para darla por sana es 1 000 ms).',
  },
  {
    id: 'worker-messaging',
    type: 'worker',
    required: true,
    state: 'VIVA',
    ageSeconds: 8,
    thresholdSeconds: 60,
    cause: null,
    evidence: 'SIMULADO · Último latido hace 8 s, dentro del límite de 30 s.',
  },
  {
    id: 'worker-scheduling',
    type: 'worker',
    required: true,
    state: 'DEGRADADA',
    ageSeconds: 41,
    thresholdSeconds: 60,
    cause: 'HEARTBEAT_LATE',
    evidence: 'SIMULADO · Último latido hace 41 s: pasó el límite de 30 s pero no el de 60 s.',
  },
  {
    id: 'worker-workflow',
    type: 'worker',
    required: true,
    state: 'CAIDA',
    ageSeconds: 214,
    thresholdSeconds: 60,
    cause: 'HEARTBEAT_EXPIRED',
    evidence:
      'SIMULADO · Sin latido desde hace 214 s. Significa que no llegó latido, no que el proceso haya muerto.',
  },
  {
    id: 'worker-read-models',
    type: 'worker',
    required: true,
    state: 'SIN_DATO',
    ageSeconds: null,
    thresholdSeconds: 60,
    cause: 'NEVER_SEEN',
    evidence:
      'SIMULADO · Nunca se recibió un latido de esta instancia: no se sabe si vive. No se da por caída.',
  },
  {
    id: 'worker-files',
    type: 'worker',
    required: false,
    state: 'SIN_DATO',
    ageSeconds: null,
    thresholdSeconds: 60,
    cause: 'NEVER_SEEN',
    evidence:
      'SIMULADO · Worker opcional (se enciende a pedido): sin latido y sin efecto sobre el estado general.',
  },
];

const NO_MEDIDO = [
  {
    id: 'minio',
    reason:
      'SIMULADO · El almacenamiento de objetos no se sondea todavía: no hay evidencia ni a favor ni en contra.',
  },
  { id: 'clamav', reason: 'SIMULADO · El antivirus no se sondea todavía.' },
  {
    id: 'replicasOfApi',
    reason: 'SIMULADO · Sólo se ve la réplica que contestó; no se cuentan las demás.',
  },
];

/**
 * El estado general que declara la API. Es función pura y se prueba sola:
 * - alguna requerida CAIDA → CAIDA;
 * - si no, alguna requerida DEGRADADA → DEGRADADA;
 * - ninguna requerida con evidencia (o ninguna requerida) → SIN_DATO;
 * - VIVA mezclada con SIN_DATO → DEGRADADA;
 * - VIVA sólo si **todas** las requeridas están VIVA.
 */
export function estadoGeneral(
  instancias: readonly Pick<LivenessInstance, 'required' | 'state'>[],
): LivenessState {
  const requeridas = instancias.filter((i) => i.required);
  if (requeridas.some((i) => i.state === 'CAIDA')) return 'CAIDA';
  if (requeridas.some((i) => i.state === 'DEGRADADA')) return 'DEGRADADA';
  if (requeridas.every((i) => i.state === 'SIN_DATO')) return 'SIN_DATO';
  if (requeridas.some((i) => i.state === 'SIN_DATO')) return 'DEGRADADA';
  return 'VIVA';
}

/** La respuesta de la sonda simulada para el instante `ahora`. */
export function vidaSimulada(ahora: Date): InstancesLiveness {
  const instances = BASE.map((i) => ({
    ...i,
    lastHeartbeatAt:
      i.ageSeconds === null ? null : new Date(ahora.getTime() - i.ageSeconds * 1000).toISOString(),
  }));
  return {
    evaluatedAt: ahora.toISOString(),
    thresholds: UMBRALES,
    overall: estadoGeneral(instances),
    instances,
    notMeasured: NO_MEDIDO,
  };
}

export function registrarVidaDeInstancias(router: MockRouter): void {
  router.get('/admin/ops/instances/liveness', () => vidaSimulada(new Date()));
}
