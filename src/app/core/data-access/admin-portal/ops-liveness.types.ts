/* ============================================================================
    Sonda de vida de instancias (`GET /admin/ops/instances/liveness`,
    módulo ops_console).

    Espejo de lo que sirve la API. La regla de fondo es del servidor y la
    pantalla la respeta: **`VIVA` sólo con evidencia fresca**. Sin evidencia el
    estado es `SIN_DATO`, que no es `CAIDA` ni `VIVA`: es «no lo sé». Un
    `CAIDA` por latido vencido quiere decir «no llegó latido», no «el proceso
    murió» (no se observa el proceso).
    ========================================================================== */

export type LivenessState = 'VIVA' | 'DEGRADADA' | 'CAIDA' | 'SIN_DATO';
export type InstanceType = 'api' | 'worker' | 'database' | 'service';

export interface LivenessThresholds {
  /** Cada cuántos segundos debería llegar un latido de un worker. */
  readonly heartbeatIntervalSeconds: number;
  /** Hasta esta edad (inclusive) el latido cuenta como fresco: `VIVA`. */
  readonly liveSeconds: number;
  /** Hasta esta edad `DEGRADADA`; más allá, `CAIDA`. */
  readonly degradedSeconds: number;
}

export interface LivenessInstance {
  /** Identificador estable (`worker-messaging`, `postgresql`…). */
  readonly id: string;
  readonly type: InstanceType;
  /** Una instancia no requerida no cuenta para el estado general. */
  readonly required: boolean;
  readonly state: LivenessState;
  /** Último latido (workers) o instante de la sonda (bases y servicios). */
  readonly lastHeartbeatAt: string | null;
  /** Segundos desde `lastHeartbeatAt` según el reloj de la API; `null` si nunca se vio. */
  readonly ageSeconds: number | null;
  /** Edad a partir de la cual esta instancia se da por caída (o el tiempo de espera de su sonda). */
  readonly thresholdSeconds: number;
  /**
   * Código de la causa (`HEARTBEAT_LATE`, `NEVER_SEEN`, `STORE_UNAVAILABLE`…),
   * `null` si está viva. El servidor puede sumar códigos: la pantalla muestra
   * el código tal cual cuando no lo conoce.
   */
  readonly cause: string | null;
  /** Texto generado por el servidor, sin mensajes crudos de error. */
  readonly evidence: string;
}

export interface LivenessNotMeasured {
  readonly id: string;
  readonly reason: string;
}

export interface InstancesLiveness {
  /** Reloj de la API: la antigüedad del dato (M34 · S7). */
  readonly evaluatedAt: string;
  readonly thresholds: LivenessThresholds;
  readonly overall: LivenessState;
  readonly instances: readonly LivenessInstance[];
  readonly notMeasured: readonly LivenessNotMeasured[];
}
