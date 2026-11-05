import type { ApproverKind } from '../access-governance/conditions.types';

/* ---- permisos atómicos, condiciones y decisión (CONTRATO-GOBIERNO §2-§5) -------------- */

/** Efecto de una concesión: `ALLOW` suma; `DENY` niega siempre y gana a cualquier `ALLOW`. */
export type GrantEffect = 'ALLOW' | 'DENY';

/** De dónde sale lo que una persona puede hacer: un código antiguo (alias) o un átomo escrito como tal. */
export type GrantOrigin = 'LEGACY' | 'ATOM';

/**
 * Resultado de la política (§0.1 punto 4): `PERMIT`, `DENY` o `CHALLENGE` (falta motivo, paso extra o
 * aprobación). `allowed` sigue siendo el booleano de siempre.
 */
export type DecisionEffect = 'PERMIT' | 'DENY' | 'CHALLENGE';

/** Lo que falta para pasar de `CHALLENGE` a `PERMIT`. */
export type ChallengeKind = 'REASON' | 'STEP_UP' | 'STEP_UP_ENROLL' | 'APPROVAL';

/** Obligaciones que una acción trae: motivo, segundo paso y aprobación (`null` = no aplica). */
/** Lo que la acción exige además de estar permitida. La API real manda `{}` cuando no exige nada (las claves faltan, no vienen en `null`). */
export interface DecisionObligations {
  readonly reason?: { readonly minLength: number } | null;
  readonly stepUp?: { readonly maxAgeMinutes: number } | null;
  readonly approval?: { readonly by: ApproverKind; readonly ttlMinutes?: number } | null;
}

/** La decisión de la política sobre una acción, tal como la devuelven `explain` y `simulate`. */
export interface SupportAccessDecisionView {
  readonly effect: DecisionEffect;
  readonly allowed: boolean;
  /** `SupportAccessReason` (`ALLOWED`, `LEAD_TIME`, `APPROVAL_REQUIRED`, …). */
  readonly reason: string;
  readonly atom?: string;
  readonly grantId?: string;
  /** Claves de condición no cumplidas (`time`, `appointment.leadTime`, …). */
  readonly unmet?: readonly string[];
  readonly challenge?: {
    readonly kind: ChallengeKind;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}
