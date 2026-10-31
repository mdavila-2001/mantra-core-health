/* ============================================================================
    Gobierno de datos del portal administrativo: políticas, su bitácora de
    cambios y el inventario de datos personales.

    Contrato REAL de la API (no un contrato propio de esta pantalla):
    - `GET /admin/governance/policies`, `/policies/:policyType/:id` y
      `/change-log` (módulo `system_ops`, `GovernanceReadController`);
    - `GET /admin/catalog/pii/summary`, `/pii/columns` y `/pii/reconciliation`
      (módulo `data_catalog`, `AdminCatalogController`).

    Lo que cuenta, filtra y clasifica lo decide el servidor. Esta capa sólo
    convierte el transporte (ISO, `null`) a la forma de la vista; nunca recalcula
    un total ni decide si una columna es personal.
    ========================================================================== */

import type { ReviewStatus, Sensitivity } from './data-catalog.types';

/** Las cuatro familias de política que la API lista (una por tabla de `system_ops`). */
export const POLICY_TYPES = ['WRITE', 'RETENTION', 'ANONYMIZATION', 'RESIDENCY'] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const POLICY_SORTS = ['code', 'updatedAt'] as const;
export type PolicySort = (typeof POLICY_SORTS)[number];
export type SortOrder = 'asc' | 'desc';

export interface PolicySummary {
  readonly policyType: PolicyType;
  readonly id: string;
  readonly code: string;
  readonly name: string | null;
  /** Código del concepto de estado (`ACTIVE`…); `null` si la política no lo declara. */
  readonly state: string | null;
  readonly version: number;
  readonly updatedAt?: Date;
}

/** Una página de políticas. La API no cuenta el total ni por tipo: no se inventa. */
export interface PolicyPage {
  readonly items: readonly PolicySummary[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly sort: string;
  readonly order: string;
}

export interface PolicyQuery {
  readonly type?: PolicyType;
  readonly state?: string;
  readonly q?: string;
  readonly sort?: PolicySort;
  readonly order?: SortOrder;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Una tabla o columna a la que se aplica una política (sólo nombres). */
export interface PolicyAppliedToItem {
  readonly schemaName: string;
  readonly tableName: string;
  /** Sólo en las reglas de anonimización, que se aplican a columnas. */
  readonly columnName: string | null;
}

/** A qué se aplica la política. `items` viene recortado: `total` dice cuántos son. */
export interface PolicyAppliedTo {
  readonly total: number;
  readonly items: readonly PolicyAppliedToItem[];
  readonly truncated: boolean;
}

/**
 * Ajustes propios del tipo, con códigos de concepto y nunca ids. De una regla de
 * anonimización sólo llegan los NOMBRES de sus parámetros (`parameterKeys`).
 */
export type PolicySettings = Readonly<Record<string, unknown>>;

export interface PolicyDetail extends PolicySummary {
  readonly createdAt?: Date;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
  readonly settings: PolicySettings;
  readonly appliedTo: PolicyAppliedTo;
}

/** Un cambio de gobierno de la bitácora (sin las fotos antes/después). */
export interface ChangeLogEntry {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
  /** Código del concepto de acción; `UNKNOWN` si la bitácora no lo resuelve. */
  readonly action: string;
  readonly changedByUserId: string;
  readonly reason: string | null;
  readonly recordedAt: Date;
}

export interface ChangeLogPage {
  readonly items: readonly ChangeLogEntry[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: string;
}

/** Sin `from`, la API mira sólo los últimos 30 días: la ficha pide desde el alta de la política. */
export interface ChangeLogQuery {
  readonly targetType?: string;
  readonly targetId?: string;
  readonly changedBy?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/* ---- datos personales (catálogo de datos + registro declarado) ---------- */

/** Desde qué nivel de la escala de sensibilidad se considera «personal» (`minSensitivity`). */
export const PII_MIN_SENSITIVITIES = [
  'PSEUDONYMIZED',
  'PERSONAL',
  'PHI_IDENTIFIER',
  'PHI_SENSITIVE',
  'PHI_SPECIAL',
  'CREDENTIAL',
] as const satisfies readonly Sensitivity[];

export const PII_SORTS = ['name', 'sensitivity'] as const;
export type PiiSort = (typeof PII_SORTS)[number];

/** Una cifra que la API no pudo medir, con el motivo. */
export interface NotMeasured {
  readonly field: string;
  readonly reason: string;
}

export interface PiiLevelCount {
  readonly sensitivity: Sensitivity;
  readonly columns: number;
  readonly approved: number;
  readonly needsReview: number;
  readonly autoDetected: number;
  /** Borrador, rechazada u otro estado sin aprobar. */
  readonly other: number;
}

/** Lo que declara el registro de gobierno (`system_ops`), sin relación con el escaneo. */
export interface PiiDeclaredRegistry {
  readonly entities: number;
  readonly entitiesPersonal: number;
  readonly fields: number;
  readonly fieldsPersonal: number;
}

export interface PiiSummary {
  readonly source: string;
  readonly observedColumns: number;
  readonly classifiedColumns: number;
  readonly personalColumns: number;
  readonly objectsWithPersonalColumns: number;
  readonly bySensitivity: readonly PiiLevelCount[];
  readonly declaredRegistry: PiiDeclaredRegistry;
  readonly notMeasured: readonly NotMeasured[];
}

export interface PiiColumn {
  readonly columnId: string;
  readonly objectId: string;
  readonly schemaName: string;
  readonly objectName: string;
  readonly columnName: string;
  readonly nativeType: string;
  readonly sensitivity: Sensitivity;
  readonly reviewStatus: ReviewStatus;
  readonly origin: 'MANUAL' | 'AUTO_CLASSIFIER';
  /** La ficha está aprobada con su revisión vigente. */
  readonly approved: boolean;
  /** `true/false` si el registro de gobierno declara la columna; `null` si no la declara. */
  readonly registryMarksPersonal: boolean | null;
}

export interface PiiColumnsPage {
  readonly items: readonly PiiColumn[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly sort: string;
}

export interface PiiColumnsQuery {
  readonly schema?: string;
  readonly minSensitivity?: Sensitivity;
  readonly sensitivity?: Sensitivity;
  readonly reviewStatus?: ReviewStatus;
  readonly q?: string;
  readonly sort?: PiiSort;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Las tres discrepancias entre el catálogo y el registro declarado:
 * personal aprobada sin declarar, declarada sin marca PII/PHI y declarada pero no observada.
 */
export const PII_RECONCILIATION_KINDS = [
  'MISSING_IN_REGISTRY',
  'REGISTRY_DISAGREES',
  'ORPHAN_IN_REGISTRY',
] as const;
export type PiiReconciliationKind = (typeof PII_RECONCILIATION_KINDS)[number];

export interface PiiDiscrepancy {
  readonly kind: PiiReconciliationKind;
  readonly schemaName: string;
  readonly objectName: string;
  readonly columnName: string;
  /** `null` en un campo huérfano: el escaneo no lo observa. */
  readonly objectId: string | null;
  readonly columnId: string | null;
  readonly sensitivity: Sensitivity | null;
  readonly reviewStatus: ReviewStatus | null;
  readonly entityRegistryId: string | null;
  readonly fieldRegistryId: string | null;
}

export interface PiiReconciliationSummary {
  readonly approvedPersonalColumns: number;
  readonly declaredFields: number;
  readonly registryEmpty: boolean;
  readonly byKind: Readonly<Record<string, number>>;
  readonly total: number;
}

export interface PiiReconciliationPage {
  readonly summary: PiiReconciliationSummary;
  readonly items: readonly PiiDiscrepancy[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly order: string;
  readonly notMeasured: readonly NotMeasured[];
}

export interface PiiReconciliationQuery {
  readonly kind?: PiiReconciliationKind;
  readonly schema?: string;
  readonly cursor?: string;
  readonly limit?: number;
}
