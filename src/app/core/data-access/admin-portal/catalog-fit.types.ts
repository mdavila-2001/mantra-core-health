/* ============================================================================
    Tipos de la sonda de ajuste de la catalogación.

    Calcan los DTO de la API (`src/modules/data_catalog/presentation/dto/catalog-fit.dto.ts`):
    `GET /admin/catalog/fit` y `POST /admin/catalog/fit/run`. Las fechas viajan
    como texto ISO 8601 y así se conservan: la pantalla las formatea, no las
    reinterpreta.

    Dos reglas del contrato que la pantalla respeta:
    - `null` no es cero. Un `ratio`, `covered` o `denominator` en `null` es «no
      se midió» y se pinta como tal, nunca como 0 % ni como 100 %.
    - `SIN_DATO` y `NO_DECLARADO` no son `OK`: son puntos ciegos, y se muestran.
    ========================================================================== */

export type FitDimension =
  'ROUTES' | 'MODEL' | 'COMPLETENESS' | 'FRESHNESS' | 'MUTABILITY' | 'SENSITIVITY';

export type FitSeverity = 'ALTA' | 'MEDIA' | 'BAJA' | 'INFO';

/** `SIN_DATO`: no se pudo leer la fuente. `NO_DECLARADO`: aún no hay dónde declararlo. `NO_APLICA`: universo vacío. */
export type FitCheckStatus = 'OK' | 'FALLA' | 'SIN_DATO' | 'NO_DECLARADO' | 'NO_APLICA';

export type FitVerdict = 'AJUSTADA' | 'CON_AVISOS' | 'DESAJUSTADA' | 'SIN_DATOS';

export type FitDimensionStatus = 'MEDIDA' | 'SIN_DATO' | 'NO_DECLARADO' | 'NO_APLICA';

export type FitRunStatus = 'EN_CURSO' | 'COMPLETADA' | 'FALLIDA';

export type FitRunTrigger = 'TICK' | 'MANUAL';

/** `ATRASADO`: se sirve, pero es más viejo que el umbral (S7). */
export type FitState = 'SIN_RESULTADO' | 'VIGENTE' | 'ATRASADO';

export interface FitFinding {
  /** Qué está desajustado: una ruta, una tabla, una columna. */
  readonly subject: string;
  readonly detail: string;
}

export interface FitCheckResult {
  /** Id estable (`FIT-RUT-001`): no se reutiliza ni se renombra. */
  readonly id: string;
  readonly dimension: FitDimension;
  readonly title: string;
  /** Severidad si FALLA. */
  readonly severity: FitSeverity;
  readonly status: FitCheckStatus;
  /** Ítems que cumplen; `null` si no se midió (nunca 0). */
  readonly covered: number | null;
  readonly denominator: number | null;
  readonly summary: string;
  readonly reason: string | null;
  readonly remediation: string;
  readonly evidence: Readonly<Record<string, string | number | boolean | null>>;
  readonly findings: readonly FitFinding[];
  /** Total real de hallazgos; `findings` se recorta. */
  readonly findingsTotal: number;
  readonly findingsTruncated: boolean;
}

export interface FitDimensionScore {
  readonly dimension: FitDimension;
  readonly status: FitDimensionStatus;
  readonly covered: number | null;
  readonly denominator: number | null;
  /** `covered / denominator`; `null` sin base. */
  readonly ratio: number | null;
  readonly checksMeasured: number;
  /** Comprobaciones sin dato o sin dónde declararse. */
  readonly checksUnmeasured: number;
  readonly checksFailed: number;
}

export interface FitReport {
  readonly modelVersion: string;
  readonly evaluatedAt: string;
  readonly verdict: FitVerdict;
  readonly dimensions: readonly FitDimensionScore[];
  readonly checks: readonly FitCheckResult[];
  /** Ids de las comprobaciones que no pudieron medir. */
  readonly blindSpots: readonly string[];
  readonly fingerprints: {
    readonly routesInCode: string | null;
    readonly routesInInventory: string | null;
    readonly routesImported: string | null;
  };
  readonly deployment: { readonly commit: string; readonly builtAt: string };
  readonly thresholds: { readonly scanStaleAfterMs: number };
}

export interface FitRunView {
  readonly runId: string;
  readonly status: FitRunStatus;
  readonly trigger: FitRunTrigger;
  readonly requestedAt: string;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  /** Clase del error si la corrida falló. */
  readonly errorCode: string | null;
}

export interface FitHistoryDimension {
  readonly dimension: FitDimension;
  readonly status: string;
  readonly covered: number | null;
  readonly denominator: number | null;
  readonly ratio: number | null;
}

export interface FitHistoryEntry {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly trigger: FitRunTrigger;
  readonly verdict: FitVerdict;
  readonly dimensions: readonly FitHistoryDimension[];
  readonly failedChecks: readonly string[];
  readonly blindSpots: readonly string[];
}

export interface FitRetention {
  readonly kind: 'MEMORIA_DEL_PROCESO';
  readonly ttlSeconds: number;
  readonly historySize: number;
  readonly tickIntervalSeconds: number;
  /** Pasado esto el resultado se sirve como `ATRASADO`. */
  readonly staleAfterSeconds: number;
  readonly note: string;
}

/** Respuesta de `GET /admin/catalog/fit`. */
export interface CatalogFit {
  readonly modelVersion: string;
  readonly state: FitState;
  readonly noResultReason: 'NUNCA_EJECUTADA' | 'EXPIRADO' | null;
  readonly ageSeconds: number | null;
  readonly running: FitRunView | null;
  readonly lastRun: FitRunView | null;
  readonly lastFailure: FitRunView | null;
  readonly report: FitReport | null;
  readonly history: readonly FitHistoryEntry[];
  readonly retention: FitRetention;
}

/** Respuesta de `POST /admin/catalog/fit/run` (202). */
export interface FitRunAccepted {
  readonly runId: string;
  readonly status: FitRunStatus;
  /** `false` si la petición repetía una clave ya aceptada o se unió a la corrida en vuelo. */
  readonly created: boolean;
  readonly acceptedAt: string;
  readonly statusUrl: string;
}
