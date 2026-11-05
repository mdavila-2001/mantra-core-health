/* ============================================================================
    Observabilidad del sistema (`GET /admin/observability/*`, módulo 70).

    Espejo del contrato que sirve la API (`ObservabilityReadService`). Reglas que
    el tipo hace imposibles de olvidar:
      · `null` ≠ `0`. Una cifra que no se pudo medir es `{ value: null, reason }`
        y la pantalla dice por qué; nunca se dibuja como cero.
      · Cada respuesta trae el sobre común `{ window, freshness, notMeasured,
        generatedAt }`: de ahí salen la frescura y la nota «no medido».
      · Un percentil es una ESTIMACIÓN del histograma (`approximate: true`);
        `atLeast` marca «por lo menos esto» (cayó en el último corte).
      · Un cubo de la serie sin fila es «sin dato», no cero.
    El front no inventa campos: lo que la API no publica (workers, dependencias,
    SLO) llega como `value: null` con su `reason` y se muestra como «no medido».
    ========================================================================== */

export type ObsInterval = 'minute' | 'hour' | 'day';

/** Parámetros de ventana que entiende toda lectura. Fechas ISO 8601; `tz` es una zona IANA. */
export interface ObsWindowQuery {
  readonly from?: string;
  readonly to?: string;
  readonly tz?: string;
  readonly interval?: ObsInterval;
}

export interface ObsPageQuery extends ObsWindowQuery {
  /** Cursor opaco de la página anterior. */
  readonly cursor?: string;
  /** 1–200 (50 por omisión). */
  readonly limit?: number;
}

export interface ObsWindow {
  readonly from: string;
  readonly to: string;
  readonly interval: ObsInterval;
  /** Zona en la que se truncaron los cubos (la que se pidió, o `America/La_Paz`). */
  readonly timezone: string;
}

export interface ObsFreshness {
  /** Último volcado que alguna instancia hizo dentro de la ventana; `null` si no hubo. */
  readonly lastFlushAt: string | null;
  readonly lagSeconds: number | null;
  /** Volcados que se descartaron tras reintentar: la propia medición perdió datos. */
  readonly droppedFlushes: number;
}

export interface NotMeasuredItem {
  readonly metric: string;
  readonly reason: string;
}

/** Sobre común de toda respuesta de lectura. */
export interface ObsEnvelope {
  readonly window: ObsWindow;
  readonly freshness: ObsFreshness;
  readonly notMeasured: readonly NotMeasuredItem[];
  readonly generatedAt: string;
}

/** Una cifra que puede faltar: `value: null` lleva siempre su `reason`. */
export interface Measure<T> {
  readonly value: T | null;
  readonly reason?: string;
}

export interface Percentile {
  readonly value: number | null;
  readonly reason?: string;
  /** El percentil cayó por encima del último corte del histograma: es «por lo menos esto». */
  readonly atLeast?: boolean;
}

export interface LatencyPercentiles {
  readonly p50: Percentile;
  readonly p95: Percentile;
  readonly p99: Percentile;
  readonly avg: number | null;
  readonly max: number | null;
  readonly method: 'histogram-estimate';
  readonly approximate: true;
}

/** Cuando ninguna instancia reportó en la ventana la API no calcula percentiles: sólo `value: null` + `reason`. */
export interface LatencyUnmeasured {
  readonly value: null;
  readonly reason: string;
  readonly method: 'histogram-estimate';
  readonly approximate: true;
}

export type LatencySummary = LatencyPercentiles | LatencyUnmeasured;

export interface StatusClasses {
  readonly '2xx': number;
  readonly '3xx': number;
  readonly '4xx': number;
  readonly '5xx': number;
  readonly other: number;
}

/** Un corte del histograma ACUMULADO: cuántas peticiones tardaron `≤ leMs`; `leMs: null` es el total. */
export interface LatencyBucket {
  readonly leMs: number | null;
  readonly count: number;
}

export interface ErrorGroupCounts {
  readonly new: number;
  readonly open: number;
  readonly regressed: number;
}

export interface ObsSummary extends ObsEnvelope {
  readonly kpis: {
    readonly requests: Measure<number>;
    /** Proporción 0–1 de las peticiones de la ventana. */
    readonly errorRate5xx: Measure<number>;
    readonly errorRate4xx: Measure<number>;
    readonly latencyMs: LatencySummary;
    readonly errorGroups: Measure<ErrorGroupCounts>;
    readonly slowSql: Measure<{ readonly count: number; readonly topHash: string | null }>;
    readonly workers: Measure<unknown>;
    readonly dependencies: Measure<unknown>;
    readonly slo: Measure<unknown>;
  };
  readonly statusClasses: StatusClasses | null;
  readonly latencyBuckets: readonly LatencyBucket[] | null;
}

/* ---- series ---------------------------------------------------------------- */

export type ObsMetric =
  | 'requests'
  | 'errors4xx'
  | 'errors5xx'
  | 'latency_p95'
  | 'latency_p99'
  | 'sql_ms'
  | 'sql_slow'
  | 'error_events';

export interface TimeseriesQuery extends ObsWindowQuery {
  readonly metric: ObsMetric;
  readonly groupBy?: 'none' | 'module' | 'status_class';
}

export interface TimeseriesPoint {
  readonly bucket: string;
  /** `null` = sin dato (muestra insuficiente u otra razón en `reason`). */
  readonly value: number | null;
  readonly reason?: string;
}

export interface TimeseriesSeries {
  readonly key: string;
  readonly points: readonly TimeseriesPoint[];
}

export interface ObsTimeseries extends ObsEnvelope {
  readonly metric: ObsMetric;
  readonly groupBy: 'none' | 'module' | 'status_class';
  /** Muestra mínima por cubo para publicar un percentil. */
  readonly minSample: number;
  readonly note: string;
  readonly series: readonly TimeseriesSeries[];
}

/* ---- endpoints y módulos ----------------------------------------------------- */

export type EndpointSort = 'requests' | 'failed' | 'p95' | 'p99' | 'errorGroups';

export interface EndpointsQuery extends ObsPageQuery {
  readonly module?: string;
  readonly sort?: EndpointSort;
}

export interface EndpointLatency {
  readonly p50: Percentile;
  readonly p95: Percentile;
  readonly p99: Percentile;
  readonly avg: number | null;
  readonly max: number | null;
}

export interface ObsEndpoint {
  readonly method: string;
  /** Plantilla de la ruta (`/patients/:id`), `UNMATCHED` o `__overflow__`. */
  readonly route: string;
  readonly operationKey: string | null;
  readonly moduleCode: string;
  readonly requests: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
  readonly latencyMs: EndpointLatency;
  readonly errorGroupsOpen: number;
  readonly lastSeenAt: string;
}

export interface ObsEndpointsPage extends ObsEnvelope {
  readonly sort: EndpointSort;
  readonly items: readonly ObsEndpoint[];
  readonly nextCursor: string | null;
  readonly total: number;
}

export interface ObsModule {
  readonly moduleCode: string;
  readonly requests: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
  readonly errorRate: number | null;
  readonly latencyMs: { readonly p95: Percentile };
  readonly errorGroupsOpen: number;
}

export interface ObsModules extends ObsEnvelope {
  readonly items: readonly ObsModule[];
}

/* ---- cobertura --------------------------------------------------------------- */

export interface ObsCoverage extends ObsEnvelope {
  readonly flags: {
    readonly observability: boolean;
    readonly httpSli: boolean;
    readonly otel: boolean;
    readonly diagnostics: boolean;
    readonly actorHash: boolean;
  };
  readonly flush: {
    readonly lastAt: string | null;
    readonly lastRows: number | null;
    readonly lastDurationMs: number | null;
    readonly droppedFlushes: number;
    readonly lastFailureAt: string | null;
    readonly lastFailureType: string | null;
    readonly intervalSeconds: number;
    readonly pendingErrorEvents: number;
    readonly pendingErrorGroups: number;
  };
  readonly sampling: {
    readonly sampledOutErrorEvents: number;
    readonly droppedErrorEvents: number;
    readonly slowRequestSamplesOverCap: number;
    readonly slowRequestMs: number;
  };
  readonly catalog: { readonly operations: number; readonly loadedAt: string | null };
  readonly instances: readonly {
    readonly id: string;
    readonly kind: string;
    readonly name: string;
    readonly status: string;
    readonly buildCommit: string | null;
    readonly buildVersion: string | null;
    readonly startedAt: string | null;
    readonly lastSeenAt: string | null;
  }[];
}

/* ---- errores ------------------------------------------------------------------ */

export type ErrorGroupState = 'NEW' | 'SEEN' | 'RESOLVED' | 'IGNORED';
export type ErrorSource = 'api' | 'worker' | 'web';
export type ErrorGroupSort = 'last_seen' | 'occurrences' | 'first_seen';

export interface ErrorGroupsQuery extends ObsPageQuery {
  readonly state?: ErrorGroupState;
  readonly module?: string;
  readonly code?: string;
  readonly source?: ErrorSource;
  readonly sort?: ErrorGroupSort;
}

export interface SparkPoint {
  readonly bucket: string;
  readonly count: number;
}

export interface ErrorGroup {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly httpStatus: number | null;
  readonly code: string;
  readonly reason: string | null;
  readonly exceptionType: string | null;
  readonly moduleCode: string;
  readonly operationKey: string | null;
  readonly method: string | null;
  readonly route: string | null;
  readonly state: ErrorGroupState;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly occurrencesTotal: number;
  readonly occurrences24h: number;
  /** `null` si no se mide (sin secreto de hash) o la muestra es menor al mínimo; `affectedActors24hReason` dice cuál. */
  readonly affectedActors24h: number | null;
  readonly affectedActors24hReason: string | null;
  readonly sparkline: readonly SparkPoint[];
  readonly lastRequestId: string | null;
  /** Versión de la fila: el cambio de estado la envía como `expectedVersion`. */
  readonly rowVersion: number;
  readonly regressedAt: string | null;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
}

export interface ErrorGroupsPage extends ObsEnvelope {
  readonly sort: ErrorGroupSort;
  readonly items: readonly ErrorGroup[];
  readonly nextCursor: string | null;
  readonly note: string;
}

export interface ErrorRecentEvent {
  readonly id: string;
  readonly occurredAt: string | null;
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly httpStatus: number | null;
  readonly instanceId: string;
  readonly durationMs: number | null;
}

export interface ErrorGroupDetail extends ObsEnvelope, ErrorGroup {
  readonly sampleMessage: string | null;
  readonly sampleFrames: readonly string[];
  readonly series: readonly { readonly bucket: string | null; readonly count: number }[];
  readonly byModule: readonly { readonly moduleCode: string; readonly events: number }[];
  readonly recentEvents: readonly ErrorRecentEvent[];
}

export interface ChangeErrorGroupState {
  readonly state: ErrorGroupState;
  /** Motivo: obligatorio (≥ 3 caracteres) al resolver o ignorar. */
  readonly note?: string;
  /** `rowVersion` que el cliente leyó; si cambió la API responde 409 `CONCURRENCY_CONFLICT`. */
  readonly expectedVersion: number;
}

export interface ErrorEventsQuery extends ObsPageQuery {
  readonly groupId?: string;
  readonly requestId?: string;
}

export interface ErrorEvent {
  readonly id: string;
  readonly occurredAt: string | null;
  readonly groupId: string;
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly instanceId: string;
  readonly httpStatus: number | null;
  readonly code: string;
  readonly reason: string | null;
  readonly exceptionType: string | null;
  readonly moduleCode: string;
  readonly operationKey: string | null;
  readonly method: string | null;
  readonly route: string | null;
  readonly durationMs: number | null;
}

export interface ErrorEventsPage extends ObsEnvelope {
  readonly items: readonly ErrorEvent[];
  readonly nextCursor: string | null;
}

/** Lo que se guardó de UNA petición: sus errores y, si fue lenta o falló, su muestra con el SQL. */
export interface RequestTrace {
  readonly requestId: string;
  /** `false` ⇒ no hay registro: sólo se guardan errores y muestras lentas. */
  readonly found: boolean;
  readonly errors: readonly (Omit<ErrorEvent, 'traceId' | 'requestId'> & {
    readonly sqlstate: string | null;
    readonly constraint: string | null;
    readonly table: string | null;
    readonly column: string | null;
    readonly violations: unknown;
    readonly messageRedacted: string | null;
    readonly frames: readonly string[];
  })[];
  readonly slowSample: SlowSample | null;
  readonly traceId: string | null;
  readonly hint: string | null;
}

/* ---- SQL ----------------------------------------------------------------------- */

export type SqlSort = 'total_ms' | 'p95' | 'executions' | 'slow';

export interface SqlStatementsQuery extends ObsPageQuery {
  readonly sort?: SqlSort;
  readonly module?: string;
}

export interface SqlLatency {
  readonly p50: Percentile;
  readonly p95: Percentile;
  readonly p99: Percentile;
  readonly avg: number | null;
  readonly max: number | null;
  readonly method: 'histogram-estimate';
  readonly approximate: true;
}

export interface SqlStatement {
  /** Huella de 12 caracteres hexadecimales de la sentencia normalizada (o `__overflow__`). */
  readonly queryHash: string;
  readonly statementClass: string;
  readonly primaryTable: string | null;
  readonly executions: number;
  readonly totalMs: number;
  readonly latencyMs: SqlLatency;
  readonly slowCount: number;
  readonly failedCount: number;
  readonly modules: readonly string[];
}

export interface SqlStatementsPage extends ObsEnvelope {
  readonly sort: SqlSort;
  readonly items: readonly SqlStatement[];
  readonly nextCursor: string | null;
  readonly total: number;
}

export interface SqlStatementDetail extends ObsEnvelope {
  readonly queryHash: string;
  readonly statementClass: string;
  /** SQL normalizado (sin parámetros); `null` si no se guardó. */
  readonly normalizedSql: string | null;
  readonly primaryTable: string | null;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly slowEver: boolean;
  readonly executions: number;
  readonly totalMs: number;
  readonly slowCount: number;
  readonly failedCount: number;
  readonly latencyMs: SqlLatency;
  readonly series: readonly {
    readonly bucket: string;
    readonly executions: number;
    readonly totalMs: number;
    readonly slowCount: number;
    readonly p95: Percentile;
  }[];
  readonly operations: readonly {
    readonly operationKey: string;
    readonly moduleCode: string;
    readonly executions: number;
    readonly totalMs: number;
    readonly slowCount: number;
  }[];
  readonly slowSamples: readonly {
    readonly requestId: string;
    readonly occurredAt: string | null;
    readonly durationMs: number;
    readonly operationKey: string | null;
    readonly httpStatus: number;
  }[];
}

export interface SlowSample {
  readonly id: string;
  readonly time?: string | null;
  readonly occurredAt?: string | null;
  readonly requestId?: string;
  readonly traceId?: string | null;
  readonly instanceId?: string;
  readonly method: string;
  readonly route: string;
  readonly operationKey: string | null;
  readonly moduleCode: string;
  readonly httpStatus: number;
  readonly durationMs: number;
  readonly sqlCount: number | null;
  readonly sqlTotalMs: number | null;
  readonly sqlTop: readonly unknown[];
  readonly sampledBecause: string;
}

export interface SlowRequestsPage extends ObsEnvelope {
  readonly items: readonly (SlowSample & { readonly requestId: string; readonly occurredAt: string | null })[];
  readonly nextCursor: string | null;
}
