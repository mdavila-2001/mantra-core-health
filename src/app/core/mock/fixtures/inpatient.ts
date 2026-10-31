import type { InfraAction, InfraRoleCode, InfrastructureOpsCatalog, OpsConcept } from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { opsLabel } from '../../data-access/infrastructure-ops/ops-labels';
import { uuid } from '../mock-store';

/* ============================================================================
    Operación de camas e internación simuladas — franjas F2 y F3.

    Catálogo (F2.2/F3.1), política de roles (§0.3, F2.3 y F3.3 «Permisos») y las
    asignaciones operativas de las cuentas de la maqueta. La política vive acá
    —del lado de la «API»— y la pantalla sólo lee lo que resulta de ella. Todo
    imita a la API: códigos sin texto en las respuestas, y el catálogo con la
    forma de `opsCatalogGroups` (`practice/domain/ops/ops-catalog.ts`).
    ========================================================================== */

const c = (code: string): OpsConcept => ({ code, display: opsLabel(code) });

export const AVAILABILITY = ['SPACE_OP_AVAILABLE', 'SPACE_OP_BLOCKED_CLINICAL', 'SPACE_OP_BLOCKED_ADMIN', 'SPACE_OP_MAINTENANCE', 'SPACE_OP_CLOSED'] as const;
export const HYGIENE = ['HYG_CLEAN', 'HYG_DIRTY', 'HYG_CLEANING', 'HYG_INSPECTED', 'HYG_CONTAMINATED'] as const;
export const ISOLATION = ['ISO_NONE', 'ISO_CONTACT', 'ISO_DROPLET', 'ISO_AIRBORNE', 'ISO_PROTECTIVE'] as const;
export const OCCUPANCY = ['OCC_FREE', 'OCC_RESERVED', 'OCC_OCCUPIED'] as const;

type K = 'BLOCK_CLINICAL' | 'BLOCK_ADMIN' | 'BLOCK_MAINTENANCE' | 'BLOCK_CLOSURE';
const reason = (code: string, kinds: readonly K[]) => ({ code, display: opsLabel(code), kinds });

/** `BLOCK_REASONS` de la API: los mismos códigos y tipos. */
export const BLOCK_REASONS = [
  reason('BLOCK_RSN_STAFF_SHORTAGE', ['BLOCK_CLINICAL', 'BLOCK_ADMIN']),
  reason('BLOCK_RSN_ISOLATION_COHORT', ['BLOCK_CLINICAL']),
  reason('BLOCK_RSN_PATIENT_CONDITION', ['BLOCK_CLINICAL']),
  reason('BLOCK_RSN_EQUIPMENT_FAILURE', ['BLOCK_CLINICAL', 'BLOCK_ADMIN', 'BLOCK_MAINTENANCE']),
  reason('BLOCK_RSN_PREVENTIVE_MAINTENANCE', ['BLOCK_MAINTENANCE']),
  reason('BLOCK_RSN_INFRASTRUCTURE', ['BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE']),
  reason('BLOCK_RSN_PEST_CONTROL', ['BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE']),
  reason('BLOCK_RSN_ADMIN_DECISION', ['BLOCK_ADMIN', 'BLOCK_CLOSURE']),
  reason('BLOCK_RSN_OTHER', ['BLOCK_CLINICAL', 'BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE']),
] as const;

/** El único motivo que exige texto (`BLOCK_REASON_TEXT_REQUIRED`). */
export const REASON_REQUIRING_TEXT = 'BLOCK_RSN_OTHER';

const CLEANING_TYPES = ['CLEAN_ROUTINE', 'CLEAN_DISCHARGE', 'CLEAN_TERMINAL', 'CLEAN_OR_TURNOVER', 'CLEAN_SPOT'] as const;
const CLEANING_PRIORITIES = ['CLN_PRIO_ROUTINE', 'CLN_PRIO_URGENT', 'CLN_PRIO_STAT'] as const;

/** Lo que F2 suma a `GET /practice/infrastructure-catalog` (`opsCatalogGroups`). */
export const OPS_CATALOG: InfrastructureOpsCatalog = {
  availability: AVAILABILITY.map(c),
  hygiene: HYGIENE.map(c),
  isolation: ISOLATION.map(c),
  occupancy: OCCUPANCY.map(c),
  blockReasons: BLOCK_REASONS,
  cleaningTypes: CLEANING_TYPES.map(c),
  cleaningPriorities: CLEANING_PRIORITIES.map(c),
  v2Map: [
    { order: 1, condition: 'availability != SPACE_OP_AVAILABLE or lifecycle != ACTIVE', v2Code: 'C' },
    { order: 2, condition: 'hygiene = HYG_CONTAMINATED', v2Code: 'K' },
    { order: 3, condition: 'isolation != ISO_NONE', v2Code: 'I' },
    { order: 4, condition: 'occupancy = OCC_OCCUPIED', v2Code: 'O' },
    { order: 5, condition: 'occupancy = OCC_RESERVED', v2Code: 'R' },
    { order: 6, condition: 'hygiene in (HYG_DIRTY, HYG_CLEANING), or HYG_CLEAN with infra.inspection_required, or terminal_cleaning_required', v2Code: 'H' },
    { order: 7, condition: 'otherwise', v2Code: 'U' },
  ],
};

/* ---- política (§0.3 · permisos F2 y F3) ---------------------------------- */

const ALL_VIEWERS: readonly InfraRoleCode[] = ['SUPERADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'NURSE', 'ADMISSION', 'HOUSEKEEPING', 'MAINTENANCE'];

/** Quién ve al paciente en el tablero (`PATIENT_VIEWERS` de `infra-scope.ts`). */
export const PATIENT_VIEWERS: readonly InfraRoleCode[] = ['NURSE', 'NURSE_SUPERVISOR', 'ADMISSION'];

/** Acción → roles: las tablas de `infra-f2.policy.ts` e `infra-f3.policy.ts` de la API. */
export const INFRA_POLICY: Readonly<Record<InfraAction, readonly InfraRoleCode[]>> = {
  'f2.board.read': ALL_VIEWERS,
  'f2.availability.clinical': ['NURSE'],
  'f2.availability.admin': ['SUPERADMIN', 'ORG_ADMIN', 'SITE_ADMIN'],
  'f2.availability.maintenance': ['ORG_ADMIN', 'SITE_ADMIN', 'MAINTENANCE'],
  'f2.hygiene.mark-dirty': ['NURSE', 'HOUSEKEEPING'],
  'f2.hygiene.mark-contaminated': ['NURSE'],
  'f2.isolation.set': ['NURSE'],
  'f2.isolation.cohort-approve': ['INFECTION_CONTROL'],
  'f2.cleaning.read': ['ORG_ADMIN', 'SITE_ADMIN', 'NURSE', 'ADMISSION', 'HOUSEKEEPING'],
  'f2.cleaning.create': ['NURSE', 'HOUSEKEEPING'],
  'f2.cleaning.assign': ['NURSE', 'HOUSEKEEPING'],
  'f2.cleaning.work': ['NURSE', 'HOUSEKEEPING'],
  'f2.cleaning.inspect': ['NURSE_SUPERVISOR', 'HOUSEKEEPING_SUPERVISOR'],
  'f2.cleaning.cancel': ['NURSE', 'HOUSEKEEPING'],
  'f2.events.read': ALL_VIEWERS,
  'f3.adt.place': ['NURSE', 'ADMISSION'],
  'f3.adt.override': ['NURSE_SUPERVISOR'],
  'f3.adt.read': ['SUPERADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'NURSE', 'ADMISSION'],
  'f3.incident.review': ['NURSE_SUPERVISOR', 'INFECTION_CONTROL'],
  'f3.census.read': ['SUPERADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'NURSE', 'ADMISSION', 'BILLING'],
  'f3.census.close': ['ORG_ADMIN', 'SITE_ADMIN', 'NURSE_SUPERVISOR', 'ADMISSION'],
  'f3.census.adjust': ['ORG_ADMIN', 'SITE_ADMIN', 'NURSE_SUPERVISOR'],
  'f3.indicators.read': ['SUPERADMIN', 'ORG_ADMIN', 'SITE_ADMIN', 'NURSE', 'ADMISSION', 'BILLING'],
};

export function actionsOf(roles: readonly InfraRoleCode[]): InfraAction[] {
  return (Object.keys(INFRA_POLICY) as InfraAction[]).filter((a) => INFRA_POLICY[a].some((r) => roles.includes(r)));
}

/* ---- cuentas operativas de la maqueta ------------------------------------- */

/** Las cuentas del hospital: una por rol operativo (`organization_user_assignments`). */
export const INPATIENT_USERS = {
  enfermeria: uuid('user-enfermeria-sanlucas'),
  supervision: uuid('user-supervision-enfermeria-sanlucas'),
  admision: uuid('user-admision-sanlucas'),
  limpieza: uuid('user-limpieza-sanlucas'),
  supervisoraLimpieza: uuid('user-supervisora-limpieza-sanlucas'),
  mantenimiento: uuid('user-mantenimiento-sanlucas'),
} as const;

export interface InfraAssignment {
  readonly userId: string;
  readonly siteId: string;
  readonly roles: readonly InfraRoleCode[];
}

export function seedAssignments(sanLucasSiteId: string): InfraAssignment[] {
  const a = (userId: string, roles: readonly InfraRoleCode[]) => ({ userId, siteId: sanLucasSiteId, roles });
  return [
    a(INPATIENT_USERS.enfermeria, ['NURSE']),
    a(INPATIENT_USERS.supervision, ['NURSE', 'NURSE_SUPERVISOR']),
    a(INPATIENT_USERS.admision, ['ADMISSION']),
    a(INPATIENT_USERS.limpieza, ['HOUSEKEEPING']),
    a(INPATIENT_USERS.supervisoraLimpieza, ['HOUSEKEEPING', 'HOUSEKEEPING_SUPERVISOR']),
    a(INPATIENT_USERS.mantenimiento, ['MAINTENANCE']),
  ];
}

/* ---- configuración por establecimiento (`practice.practice_settings`) ---- */

export const INFRA_SETTINGS = {
  inspectionRequired: true,
  hvacValidationMaxDays: 365,
  swapRequiresCleaning: false,
  adtCancelWindowMinutes: 120,
  censusCloseGraceMinutes: 60,
  staleAfterSeconds: 120,
} as const;

/** Bolivia no tiene horario de verano: el corte de las 00:00 es a las 04:00Z. */
export const SITE_UTC_OFFSET_HOURS = -4;

/** La fecha local (`AAAA-MM-DD`) de la sede en un instante. */
export function siteDate(instant: Date | string | number): string {
  const t = new Date(instant).getTime() + SITE_UTC_OFFSET_HOURS * 3_600_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** El corte del día `date`: 00:00 local del día siguiente. */
export function cutoffOf(date: string): string {
  const t = Date.parse(`${date}T00:00:00Z`) + 86_400_000 - SITE_UTC_OFFSET_HOURS * 3_600_000;
  return new Date(t).toISOString();
}

/** `date` ± `days`. */
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
