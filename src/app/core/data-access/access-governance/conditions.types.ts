/* ============================================================================
    Tipos del JSON de condiciones ABAC, versión 1 (`condition_json`).

    Espejo de `CONTRATO-GOBIERNO.md` §3.3 y del esquema del backend
    (`delegated_access/domain/support-condition.schema.ts`). **El front no
    interpreta estas condiciones**: la autoridad es la API (`simulate` y `explain`).
    Estos tipos solo sirven para armar el JSON que el editor envía y para leer lo que
    la API devuelve.

    Todas las claves son opcionales y se cruzan (Y). Una clave desconocida la rechaza
    el servidor con 422 `CONDITION_UNKNOWN_KEY`: por eso los tipos son cerrados.
   ========================================================================== */

/** Versión del esquema que este cliente escribe. El servidor rechaza una mayor que la que conoce. */
export const CONDITION_SCHEMA_VERSION = 1 as const;

/** Franja horaria. `days`: 0-6 con 0 = domingo; `from`/`to` en `HH:mm`, intervalo `[from, to)`; `from > to` cruza la medianoche. */
export interface ConditionTimeWindow {
  readonly days: readonly number[];
  readonly from: string;
  readonly to: string;
}

export interface ConditionTime {
  /** Zona IANA; si falta, la de la organización. */
  readonly timeZone?: string;
  /** De 1 a 14 franjas; alcanza con que una contenga el instante. */
  readonly windows: readonly ConditionTimeWindow[];
}

export type ConditionLimitMetric = 'ACTIONS' | 'DISTINCT_PATIENTS';
export type ConditionLimitWindow = 'HOUR' | 'DAY' | 'WEEK';
export type ConditionOnExceed = 'DENY' | 'REQUIRE_APPROVAL';

export interface ConditionLimit {
  readonly metric: ConditionLimitMetric;
  readonly per: ConditionLimitWindow;
  /** De 1 a 10 000. */
  readonly max: number;
  /** `GRANT` (por omisión) o `PERSON`. */
  readonly scope?: 'GRANT' | 'PERSON';
  /** `[a-z0-9-]{1,40}`: varios átomos con el mismo grupo comparten contador. */
  readonly group?: string;
  readonly onExceed?: ConditionOnExceed;
}

export type PatientScope = 'ANY' | 'WITH_APPOINTMENT_WINDOW' | 'CARE_TEAM_OF_COVERED_DOCTOR';
export type PatientRestrictionFlag = 'VIP' | 'CONFIDENTIAL' | 'STAFF_RELATIVE' | 'PROTECTED';
export type PatientCoverageMode = 'INSURED_ONLY' | 'SELF_PAY_ONLY' | 'ANY';

export interface ConditionPatients {
  readonly scope?: PatientScope;
  readonly appointmentWindow?: { readonly daysBefore: number; readonly daysAfter: number; readonly withCoveredDoctor?: boolean };
  readonly age?: { readonly min?: number; readonly max?: number };
  readonly isMinor?: boolean;
  readonly coverage?: { readonly mode: PatientCoverageMode; readonly carrierIds?: readonly string[] };
  readonly flags?: { readonly anyOf: readonly PatientRestrictionFlag[] };
  readonly exclude?: { readonly minors?: boolean; readonly flags?: readonly PatientRestrictionFlag[] };
}

export interface ConditionAppointment {
  readonly window?: { readonly daysBefore: number; readonly daysAfter: number };
  readonly leadTime?: { readonly minHours: number; readonly onViolation: ConditionOnExceed };
  readonly horizon?: { readonly maxDaysAhead: number };
}

/** Canales con los que un mensaje sale. Hoy `CHAT` y `EMAIL`. */
export type ConditionChannel = 'CHAT' | 'EMAIL';

/** Cuánto se ve de un campo: `FULL` completo, `PARTIAL` parcial, `REDACT` tachado, `NULLIFY` oculto. */
export type FieldMask = 'FULL' | 'PARTIAL' | 'REDACT' | 'NULLIFY';

export interface ConditionAmount {
  /** Solo `BOB` en la versión 1. */
  readonly currency: 'BOB';
  readonly perTransactionMax?: number;
  readonly perDayMax?: number;
  readonly maxDiscountPercent?: number;
  readonly onExceed?: ConditionOnExceed;
}

export type ApproverKind = 'DOCTOR' | 'SECOND_APPROVER' | 'SERVICE_HEAD';

export interface ConditionObligations {
  readonly requireReason?: { readonly minLength: number };
  readonly stepUp?: { readonly maxAgeMinutes: number };
  readonly approval?: { readonly by: ApproverKind; readonly ttlMinutes?: number };
}

export interface DelegationCeiling {
  readonly allowAtoms?: readonly string[];
  readonly forbidAtoms?: readonly string[];
  readonly templates?: readonly string[];
  readonly maxValidDays?: number;
}

/** El objeto `condition_json` completo. Una condición real trae de 1 a 4 claves. */
export interface SupportCondition {
  readonly schemaVersion: typeof CONDITION_SCHEMA_VERSION;
  readonly time?: ConditionTime;
  readonly limits?: readonly ConditionLimit[];
  readonly patients?: ConditionPatients;
  readonly appointment?: ConditionAppointment;
  readonly channels?: { readonly allow: readonly ConditionChannel[] };
  readonly fields?: Readonly<Record<string, { readonly mask: FieldMask }>>;
  readonly amount?: ConditionAmount;
  readonly session?: { readonly maxSessionMinutes: number };
  readonly network?: { readonly require: 'ORG_RULES' | 'ANY' };
  readonly device?: { readonly knownOnly: boolean };
  readonly presence?: { readonly doctor: 'ONLINE' };
  readonly obligations?: ConditionObligations;
  readonly delegationCeiling?: DelegationCeiling;
}

/** Las claves cerradas que la API acepta (para el editor y los avisos de «clave desconocida»). */
export const CONDITION_KEYS = [
  'schemaVersion',
  'time',
  'limits',
  'patients',
  'appointment',
  'channels',
  'fields',
  'amount',
  'session',
  'network',
  'device',
  'presence',
  'obligations',
  'delegationCeiling',
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

/** Condiciones por átomo dentro de un mismo permiso (`actionConditions`). */
export type ActionConditions = Readonly<Record<string, SupportCondition>>;

/** Una condición vacía y válida: no restringe nada. */
export function emptyCondition(): SupportCondition {
  return { schemaVersion: CONDITION_SCHEMA_VERSION };
}

/** ¿Trae la condición alguna clave además de `schemaVersion`? */
export function hasConditionContent(condition: SupportCondition | null | undefined): boolean {
  if (condition === null || condition === undefined) return false;
  return Object.keys(condition).some((key) => key !== 'schemaVersion');
}

/** Cuántas claves de restricción trae (el botón de la sección del editor dice «N condiciones»). */
export function conditionCount(condition: SupportCondition | null | undefined): number {
  if (condition === null || condition === undefined) return 0;
  return Object.keys(condition).filter((key) => key !== 'schemaVersion').length;
}
