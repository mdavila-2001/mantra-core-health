/* ============================================================================
    Tráfico HTTP de la API (`/admin/ops/traffic*`, módulo ops_console).

    Espejo de lo que sirve la API. Todo es agregado: no hay usuarios, ni
    direcciones reales, ni identificadores. `route` es la plantilla
    (`/patients/:id`); `UNMATCHED` agrupa lo que no coincidió con ninguna ruta y
    `__overflow__` lo que superó el tope de cardinalidad por minuto.
    ========================================================================== */

export type TrafficInterval = 'hour' | 'day';
export type TrafficEndpointSort = 'requests' | 'failed' | 'p95';

export interface TrafficWindowQuery {
  readonly from?: string;
  readonly to?: string;
}

export interface TrafficQuery extends TrafficWindowQuery {
  readonly interval?: TrafficInterval;
}

export interface TrafficEndpointsQuery extends TrafficWindowQuery {
  readonly limit?: number;
  readonly sort?: TrafficEndpointSort;
}

export interface TrafficWindow {
  readonly from: string;
  readonly to: string;
  readonly interval: TrafficInterval;
  readonly timezone: 'UTC';
}

export interface TrafficLatency {
  readonly avg: number | null;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  /** Percentil estimado desde un histograma, no calculado sobre cada petición. */
  readonly method: 'histogram-estimate';
  /** `true` si algún percentil cayó en el último corte: es «por lo menos esto». */
  readonly approximate: boolean;
}

export interface TrafficActiveUsers {
  readonly sessionsActiveNow: number;
  readonly usersActiveNow: number;
  readonly usersActiveInWindow: number;
  /** Qué significa «activo»; la pantalla lo muestra tal cual. */
  readonly definition: string;
}

export interface TrafficMeasured {
  readonly requests: number;
  readonly succeeded: number;
  readonly failed: { readonly client4xx: number; readonly server5xx: number };
  /** `null` si no hubo peticiones (0/0): nunca se muestra como 0 %. */
  readonly successRatio: number | null;
  readonly latencyMs: TrafficLatency;
  readonly activeUsers: TrafficActiveUsers;
  /** Último minuto volcado; `null` si la ventana no tiene datos. */
  readonly lastDataAt: string | null;
}

export interface TrafficBucket {
  readonly bucket: string;
  readonly requests: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
  readonly p95Ms: number | null;
}

export interface TrafficNotMeasured {
  readonly metric: string;
  readonly reason: string;
}

export interface TrafficOverview {
  readonly window: TrafficWindow;
  readonly measured: TrafficMeasured;
  readonly series: readonly TrafficBucket[];
  readonly notMeasured: readonly TrafficNotMeasured[];
}

export interface TrafficEndpoint {
  readonly method: string;
  readonly route: string;
  /** `null` cuando la plantilla no figura en el contrato (p. ej. `UNMATCHED`). */
  readonly operationId: string | null;
  readonly requests: number;
  readonly succeeded: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
  readonly latencyMs: {
    readonly avg: number | null;
    readonly p95: number | null;
    readonly max: number | null;
  };
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface TrafficEndpointsPage {
  readonly window: TrafficWindow;
  readonly sort: TrafficEndpointSort;
  readonly items: readonly TrafficEndpoint[];
  readonly truncated: boolean;
  readonly note: string;
}
