/* ============================================================================
    Herramientas de la plataforma (`GET /admin/ops/tools`, módulo ops_console).

    Espejo exacto del contrato de la API (doc 03-herramientas-e-instancias
    §4.2). Es la lista completa, sin paginar: el catálogo de proveedores externos
    e infraestructura con lo que la API sabe de cada uno —si está configurado,
    cómo se le enchufa (`binding`) y, cuando hay sonda, si respondió—.

    Regla de presentación (misma que Atlas): el estado vivo sale SOLO de
    `isHealthy` + `checkType`, nunca de `status` (que es el estado de catálogo).
    `CONFIGURATION` y `NOT_APPLICABLE` no son caídas.
    ========================================================================== */

export type ToolKind =
  | 'DATABASE'
  | 'CACHE'
  | 'SEARCH'
  | 'OBJECT_STORAGE'
  | 'MAIL'
  | 'IDENTITY'
  | 'AI'
  | 'FISCAL'
  | 'ANALYTICS'
  | 'MAPS'
  | 'OBSERVABILITY'
  | 'SECURITY'
  | 'EMULATOR';

/** Estado de catálogo: si la herramienta se usa, se planea, se retira o se apagó. */
export type ToolCatalogStatus = 'ACTIVE' | 'PLANNED' | 'DEPRECATED' | 'DISABLED';

/** Cómo está enchufada: proveedor real, un mock, nada, o simulada dentro de la API. */
export type ToolBinding = 'real' | 'mock' | 'none' | 'simulated';

export type ToolCheckType = 'LIVE' | 'CONFIGURATION' | 'NOT_APPLICABLE';

export interface ToolsSummary {
  readonly total: number;
  readonly healthy: number;
  readonly down: number;
  readonly noProbe: number;
  readonly notApplicable: number;
  readonly critical: number;
}

export interface Tool {
  readonly code: string;
  readonly name: string;
  readonly kind: ToolKind;
  readonly provider: string;
  readonly purpose: string;
  readonly isCritical: boolean;
  readonly status: ToolCatalogStatus;
  readonly binding: ToolBinding;
  readonly isConfigured: boolean;
  readonly missingEnvVars: readonly string[];
  readonly requiredEnvVars: readonly string[];
  readonly checkType: ToolCheckType;
  /** `true`/`false` sólo con chequeo en vivo; `null` si no se sondeó. */
  readonly isHealthy: boolean | null;
  /** Qué respondió, cuánto tardó o qué falta; se muestra íntegro. */
  readonly healthMessage: string;
  readonly latencyMs: number | null;
  readonly checkedAt: string | null;
  readonly ownerTeam: string | null;
  readonly failureImpact: string;
  readonly fallback: string;
}

export interface OpsTools {
  readonly modelVersion: 'ops-tools/v1';
  readonly evaluatedAt: string;
  readonly summary: ToolsSummary;
  readonly tools: readonly Tool[];
}
