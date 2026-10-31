/* ============================================================================
    Herramientas que usa la plataforma (`GET /admin/ops/tools`, ops_console).

    Espejo de lo que sirve la API. Dos reglas del servidor que la pantalla no
    puede torcer:
    - `health.state === 'OK'` sólo vale como «responde» cuando `checkType` es
      `LIVE`. Con `CONFIGURATION` quiere decir «las variables están puestas»,
      no «funciona»; con `NOT_APPLICABLE` no hay nada que probar.
    - De las variables de entorno sólo viajan los NOMBRES, nunca un valor.
    ========================================================================== */

export type ToolKind =
  | 'DATABASE'
  | 'CACHE'
  | 'SEARCH'
  | 'STORAGE'
  | 'MESSAGING'
  | 'PAYMENTS'
  | 'AI'
  | 'MAPS'
  | 'ANALYTICS'
  | 'SECURITY'
  | 'OBSERVABILITY'
  | 'OTHER';

export type ToolStatus = 'ACTIVE' | 'PLANNED' | 'DEPRECATED' | 'DISABLED';
export type ToolHealthState = 'OK' | 'FAIL' | 'NOT_PROBED';
export type ToolCheckType = 'LIVE' | 'CONFIGURATION' | 'NOT_APPLICABLE';

export interface ToolHealth {
  readonly state: ToolHealthState;
  readonly checkType: ToolCheckType;
  /** Cuándo se observó; `null` si nunca se sondeó. */
  readonly observedAt: string | null;
  /** Nombres (no valores) de las variables de entorno que faltan. */
  readonly missingEnvVars: readonly string[];
}

export interface OpsTool {
  readonly code: string;
  readonly name: string;
  readonly kind: ToolKind;
  readonly isCritical: boolean;
  readonly status: ToolStatus;
  readonly requiredEnvVars: readonly string[];
  readonly health: ToolHealth;
}

export interface ToolNotMeasured {
  readonly code: string;
  readonly reason: string;
}

export interface OpsToolsOverview {
  readonly evaluatedAt: string;
  readonly items: readonly OpsTool[];
  readonly notMeasured: readonly ToolNotMeasured[];
}
