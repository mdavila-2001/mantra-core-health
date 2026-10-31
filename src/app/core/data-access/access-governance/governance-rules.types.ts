/* Ver `access-governance.types.ts` (barril) para el contexto: formas tomadas del código de la API. */
import type { PatientRestrictionFlag, SupportCondition } from './conditions.types';

/* ---- reglas de la organización (L1) y ajustes ------------------------------------ */

export const GOVERNANCE_RULE_KINDS = ['DENY_PERMISSION', 'CEILING', 'REQUIRE_CONDITION', 'FIELD_FLOOR'] as const;
export type GovernanceRuleKind = (typeof GOVERNANCE_RULE_KINDS)[number];
export const GOVERNANCE_RULE_KIND_LABELS: Readonly<Record<GovernanceRuleKind, string>> = {
  DENY_PERMISSION: 'Nadie puede',
  CEILING: 'Techo por rol',
  REQUIRE_CONDITION: 'Exigir una condición',
  FIELD_FLOOR: 'Limitar lo que se ve',
};
export type FieldFloorVisibility = 'PARTIAL' | 'REDACT' | 'NULLIFY';

export interface GovernanceRule {
  readonly id: string;
  readonly kind: GovernanceRuleKind;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly roleTemplateCode?: string;
  /** `billing.*`, `agenda.appointment.cancel`: el comodín solo se admite en reglas. */
  readonly permissionPattern: string;
  readonly message?: string;
  readonly condition?: SupportCondition;
  readonly maxVisibility?: FieldFloorVisibility;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rowVersion: number;
}

export interface GovernanceRuleList {
  readonly items: readonly GovernanceRule[];
  readonly count: number;
}

export interface GovernanceRuleQuery {
  readonly kind?: GovernanceRuleKind;
  readonly status?: 'ACTIVE' | 'REVOKED';
}

export interface NewGovernanceRule {
  readonly kind: GovernanceRuleKind;
  readonly roleTemplateCode?: string;
  readonly permissionPattern: string;
  readonly message?: string;
  readonly condition?: SupportCondition;
  readonly appliesTo?: string;
  readonly maxVisibility?: FieldFloorVisibility;
  readonly validFrom?: string;
  readonly validTo?: string;
}

export interface GovernanceRuleChange {
  /** La `rowVersion` que quien edita vio: si cambió, 409 `ROW_VERSION_CONFLICT`. */
  readonly expectedRowVersion: number;
  readonly message?: string;
  readonly condition?: SupportCondition;
  readonly maxVisibility?: FieldFloorVisibility;
  readonly validFrom?: string;
  readonly validTo?: string;
}

/** Ajustes de gobierno (`practice_settings['support.governance']`): son datos, no código. */
export interface GovernanceSettings {
  readonly onboardingRequired: boolean;
  readonly onboardingRequiredSince: string | null;
  readonly inactivityDays: number;
  readonly unusedDays: number;
  readonly autoSuspendInactiveDays: number | null;
  readonly reviewCadenceMonths: 6 | 12;
  readonly maxSodExceptionDays: number;
  readonly creepThreshold: number;
  readonly fourEyesActionTtlMinutes: number;
  readonly suspensionReviewAfterDays: number;
}

export type GovernanceSettingsChange = Partial<GovernanceSettings>;

export interface GovernanceSettingsResponse {
  readonly settings: GovernanceSettings;
  /** `true` si la organización aún no guardó ajustes propios. */
  readonly isDefault: boolean;
  readonly updatedAt?: string;
}

/* ---- normalizar permisos antiguos a átomos ---------------------------------------- */

export interface NormalizeLegacyRequest {
  /** Por omisión `true`. */
  readonly dryRun?: boolean;
  readonly engagementIds?: readonly string[];
  /** Obligatorio con `dryRun: false` si el plan endurece algo (422 `NORMALIZE_TIGHTENING_NOT_ACKNOWLEDGED`). */
  readonly acknowledgeTightening?: boolean;
}

export interface NormalizeObligation {
  readonly atom: string;
  readonly requiresReason: boolean;
  readonly requiresStepUp: boolean;
  readonly approval?: string | null;
  readonly message: string;
}

export interface NormalizeGrantPlan {
  readonly grantId: string;
  readonly aliases: readonly string[];
  readonly atomsBefore: readonly string[];
  readonly atomsAfter: readonly string[];
  readonly atomsAdded: readonly string[];
  readonly newObligations: readonly NormalizeObligation[];
}

export interface NormalizeEngagementPlan {
  readonly engagementId: string;
  readonly userId: string;
  readonly templateCode?: string;
  readonly grants: readonly NormalizeGrantPlan[];
  readonly tightening: readonly { readonly engagementId: string; readonly atom: string; readonly message: string }[];
}

export interface NormalizeLegacyResponse {
  readonly dryRun: boolean;
  readonly batchId?: string;
  readonly engagements: readonly NormalizeEngagementPlan[];
  readonly totals: Readonly<Record<string, number>>;
  readonly requiresAcknowledgement: boolean;
}

export interface RevertNormalizeResponse {
  readonly batchId: string;
  readonly restoredAliasRows: number;
  readonly removedAtomRows: number;
}

/* ---- separación de funciones (SoD) ------------------------------------------------ */

export type SodScope = 'PERSON' | 'PERSON_OVERLAP' | 'TRANSACTION';
export type SodAction = 'BLOCK' | 'REQUIRE_APPROVAL' | 'WARN';
export const SOD_ACTION_LABELS: Readonly<Record<SodAction, string>> = { BLOCK: 'Bloquear', REQUIRE_APPROVAL: 'Pedir aprobación', WARN: 'Avisar' };
export const SOD_SCOPE_LABELS: Readonly<Record<SodScope, string>> = { PERSON: 'En la misma persona', PERSON_OVERLAP: 'Con el mismo doctor o servicio', TRANSACTION: 'En la misma operación' };

export interface SodRule {
  /** Ausente en las reglas de plataforma (viven en el código). */
  readonly id?: string;
  readonly code: string;
  readonly name: string;
  readonly atomsA: readonly string[];
  readonly atomsB: readonly string[];
  readonly scope: SodScope;
  readonly action: SodAction;
  /** Una regla dura no admite excepción. */
  readonly isHard: boolean;
  readonly maxExceptionDays?: number | null;
  readonly rationale?: string;
  readonly baseRuleCode?: string;
  /** `true` = regla de plataforma (solo lectura). */
  readonly platform: boolean;
  readonly rowVersion?: number;
}

export interface SodRuleList {
  readonly items: readonly SodRule[];
  readonly count: number;
}

export interface NewSodRule {
  readonly code: string;
  readonly name: string;
  readonly baseRuleCode?: string;
  readonly atomsA: readonly string[];
  readonly atomsB: readonly string[];
  readonly scope: SodScope;
  readonly action: SodAction;
  readonly isHard?: boolean;
  readonly maxExceptionDays?: number;
  readonly rationale?: string;
}

export interface SodRuleChange {
  readonly expectedRowVersion: number;
  readonly name?: string;
  readonly atomsA?: readonly string[];
  readonly atomsB?: readonly string[];
  readonly scope?: SodScope;
  readonly action?: SodAction;
  readonly isHard?: boolean;
  readonly maxExceptionDays?: number;
  readonly rationale?: string;
}

export interface SodFinding {
  readonly engagementId: string;
  readonly userId: string;
  readonly ruleCode: string;
  readonly ruleName: string;
  readonly action: SodAction;
  readonly outcome: string;
  readonly atomsA: readonly string[];
  readonly atomsB: readonly string[];
  readonly exceptionId?: string;
  readonly exceptionValidTo?: string;
  readonly admitsException: boolean;
  readonly message: string;
}

export interface SodFindingList {
  readonly items: readonly SodFinding[];
  readonly count: number;
}

export type SodExceptionStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'REJECTED' | string;

export interface SodException {
  readonly id: string;
  readonly ruleCode: string;
  readonly engagementId: string;
  readonly justification: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly status: SodExceptionStatus;
  readonly revokedAt?: string;
}

export interface SodExceptionList {
  readonly items: readonly SodException[];
  readonly count: number;
}

export interface NewSodException {
  readonly engagementId: string;
  readonly ruleCode: string;
  /** Mínimo 40 caracteres. */
  readonly justification: string;
  readonly validTo: string;
}

/** El cuatro ojos recién creado (`202`). */
export interface FourEyesRequested {
  readonly approvalId: string;
  readonly status: string;
  readonly expiresAt: string;
  readonly approverKind: string;
}

/* ---- banderas de pacientes restringidos ------------------------------------------- */

export interface RestrictionFlagInput {
  readonly flag: PatientRestrictionFlag;
  readonly reason: string;
  readonly validTo?: string;
}

export interface RestrictionFlag {
  readonly flag: PatientRestrictionFlag;
  readonly reason: string;
  readonly validFrom: string;
  readonly validTo?: string;
}

export interface PatientRestrictionFlags {
  readonly patientProfileId: string;
  readonly flags: readonly RestrictionFlag[];
}

export const RESTRICTION_FLAG_LABELS: Readonly<Record<PatientRestrictionFlag, string>> = {
  VIP: 'Paciente VIP',
  CONFIDENTIAL: 'Confidencial',
  STAFF_RELATIVE: 'Familiar del personal',
  PROTECTED: 'Protegido',
};

