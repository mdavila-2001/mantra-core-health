/* ============================================================================
    Gobierno de datos del portal administrativo: políticas y campos con datos
    personales (API: `GET /admin/governance/policies`, `/policies/:id` y
    `/pii-fields`, módulo `system_ops`).

    Lo que cuenta, filtra y clasifica lo decide el servidor. Esta capa sólo
    convierte el transporte (ISO, `null`) a la forma de la vista; nunca recalcula
    un total ni decide si un campo es personal.
    ========================================================================== */

/** Una clase de política por tabla de `system_ops`. */
export const POLICY_TYPES = [
  'WRITE',
  'RETENTION',
  'ANONYMIZATION',
  'CLASSIFICATION',
  'RESIDENCY',
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

/** Atributos escalares propios del tipo; `null` = nadie lo declaró. */
export type PolicyAttributes = Readonly<Record<string, string | number | boolean | null>>;

export interface PolicySummary {
  readonly id: string;
  readonly type: PolicyType;
  readonly code: string;
  readonly name: string | null;
  readonly stateCode: string | null;
  readonly stateLabel: string | null;
  readonly attributes: PolicyAttributes;
  readonly updatedAt?: Date;
}

export interface PolicyTypeCount {
  readonly type: PolicyType;
  readonly total: number;
}

/** Una página de políticas. `total` y `byType` son del filtro entero, no de la página. */
export interface PolicyPage {
  readonly items: readonly PolicySummary[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly total: number;
  readonly byType: readonly PolicyTypeCount[];
}

export interface PolicyQuery {
  readonly type?: PolicyType;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/** A qué se aplica una política. `items` viene recortado: `total` dice cuántos son. */
export interface PolicyAppliesTo {
  readonly kind: 'ENTITY' | 'FIELD' | 'TENANT_BINDING';
  readonly total: number;
  readonly items: readonly string[];
  readonly truncated: boolean;
}

export interface PolicyChange {
  readonly id: string;
  readonly action: string | null;
  readonly changedByUserId: string;
  readonly reason: string | null;
  readonly recordedAt: Date;
}

export interface PolicyDetail extends PolicySummary {
  /** Parámetros de la regla o reglas de manejo de la clasificación; `null` si el tipo no los tiene. */
  readonly configuration: unknown;
  readonly appliesTo: readonly PolicyAppliesTo[];
  readonly history: readonly PolicyChange[];
}

/** Niveles que el inventario cuenta como dato personal o secreto. */
export const PII_SENSITIVITIES = [
  'PERSONAL',
  'PHI_IDENTIFIER',
  'PHI_SENSITIVE',
  'PHI_SPECIAL',
  'CREDENTIAL',
] as const;
export type PiiSensitivity = (typeof PII_SENSITIVITIES)[number];

/** De dónde sale la fila: el escaneo del catálogo, el registro de gobierno o los dos. */
export const PII_SOURCES = ['CATALOG', 'REGISTRY', 'BOTH'] as const;
export type PiiSource = (typeof PII_SOURCES)[number];

export interface PiiRegistry {
  readonly isPii: boolean | null;
  readonly isPhi: boolean | null;
  readonly classification: string | null;
  readonly maskingStrategy: string | null;
  readonly anonymizationRule: string | null;
}

export interface PiiField {
  readonly schemaName: string;
  readonly tableName: string;
  readonly columnName: string;
  /** `null` si sólo lo marca el registro de gobierno. */
  readonly sensitivity: string | null;
  readonly reviewStatus: string | null;
  readonly source: PiiSource;
  readonly registry: PiiRegistry | null;
}

export interface PiiSummary {
  readonly fields: number;
  readonly tables: number;
  readonly approved: number;
  readonly withoutProtection: number;
  readonly bySensitivity: Readonly<Record<string, number>>;
  readonly bySource: Readonly<Record<string, number>>;
}

/** Cuántas fuentes hay detrás del inventario: sirve para decir por qué una lista vacía lo está. */
export interface PiiSources {
  readonly catalogColumns: number;
  readonly registryFields: number;
}

export interface PiiPage {
  readonly items: readonly PiiField[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly total: number;
  readonly summary: PiiSummary;
  readonly sources: PiiSources;
}

export interface PiiQuery {
  readonly q?: string;
  readonly schema?: string;
  readonly sensitivity?: PiiSensitivity;
  readonly source?: PiiSource;
  readonly cursor?: string;
  readonly limit?: number;
}
