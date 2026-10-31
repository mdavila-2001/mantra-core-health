/* ============================================================================
    Sonda de vida de las instancias (`GET /admin/ops/instances/liveness`,
    módulo ops_console).

    Espejo exacto del contrato de la API (doc 04-sonda-de-vida §2.4). La API
    responde 200 siempre que ella misma conteste, incluso con Redis caído: en
    ese caso `heartbeatStore.status` es `down` y las instancias que dependen del
    latido quedan en `SIN_DATO` con causa `STORE_UNAVAILABLE`. El estado lo
    decide el servidor; el front sólo lo pinta.
    ========================================================================== */

export type InstanceState = 'VIVA' | 'DEGRADADA' | 'CAIDA' | 'SIN_DATO';
export type InstanceOverall = 'OK' | 'ATENCION' | 'CRITICO' | 'SIN_DATO';
export type InstanceType = 'API' | 'WORKER' | 'DATABASE' | 'SERVICE';

export type InstanceCause =
  | 'OK'
  | 'HEARTBEAT_LATE'
  | 'HEARTBEAT_EXPIRED'
  | 'NEVER_SEEN'
  | 'STORE_UNAVAILABLE'
  | 'CLOCK_INCONSISTENT'
  | 'RECORD_CORRUPT'
  | 'TICK_STUCK'
  | 'CIRCUIT_OPEN'
  | 'DRAINING'
  | 'PROBE_FAILED'
  | 'PROBE_TIMEOUT'
  | 'PROBE_SLOW'
  | 'NOT_PROBED';

export type InstanceEvidenceSource = 'heartbeat' | 'probe' | 'self' | 'none';
export type InstanceReportedStatus = 'running' | 'draining' | 'starting' | 'stopped';

export interface InstanceSummary {
  readonly VIVA: number;
  readonly DEGRADADA: number;
  readonly CAIDA: number;
  readonly SIN_DATO: number;
  readonly total: number;
}

export interface HeartbeatStore {
  readonly status: 'up' | 'down';
  /** `STORE_UNAVAILABLE` cuando está `down`; `null` cuando está `up`. */
  readonly reason: string | null;
}

export interface LivenessThresholds {
  readonly workerHeartbeatIntervalSeconds: number;
  /** Hasta acá el latido se considera fresco. */
  readonly degradedAfterSeconds: number;
  /** Por encima de esto la instancia está CAÍDA; entre ambos, DEGRADADA. */
  readonly downAfterSeconds: number;
  readonly dependencyLatencyDegradedMs: number;
  readonly dependencyProbeTimeoutMs: number;
  readonly clockToleranceSeconds: number;
}

export interface InstanceEvidence {
  readonly source: InstanceEvidenceSource;
  readonly reportedStatus: InstanceReportedStatus | null;
  /** Un cambio de `startedAt` entre dos lecturas es un reinicio observado. */
  readonly startedAt: string | null;
  readonly latencyMs: number | null;
}

export interface Instance {
  /** `worker-<dominio>` para los workers; `api`, `postgresql`, `redis`… para la infraestructura. */
  readonly id: string;
  readonly label: string;
  readonly type: InstanceType;
  /** `false` = opcional (opt-in) o sin sonda. */
  readonly required: boolean;
  readonly state: InstanceState;
  readonly lastHeartbeatAt: string | null;
  /** `evaluatedAt - receivedAt`, entero; `null` si nunca hubo latido. */
  readonly ageSeconds: number | null;
  /** El umbral que decide CAÍDA para este tipo; `null` en SIN_DATO sin latido. */
  readonly thresholdSeconds: number | null;
  readonly cause: InstanceCause;
  /** Texto corto generado por el servidor, sin mensajes crudos de error. */
  readonly causeDetail: string;
  readonly evidence: InstanceEvidence;
}

export interface InstanceLiveness {
  readonly modelVersion: 'instance-liveness/v1';
  /** Reloj de la API en el momento de evaluar. */
  readonly evaluatedAt: string;
  readonly overall: InstanceOverall;
  readonly summary: InstanceSummary;
  readonly heartbeatStore: HeartbeatStore;
  readonly thresholds: LivenessThresholds;
  readonly instances: readonly Instance[];
  /** Lo que la sonda no cubre: se declara, nunca se pinta como «viva». */
  readonly notMeasured: readonly string[];
}
