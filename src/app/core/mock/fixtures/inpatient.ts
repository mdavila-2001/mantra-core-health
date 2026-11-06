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

const ADMINS: readonly InfraRoleCode[] = ['ORG_ADMIN', 'SITE_ADMIN'];
const ALL_VIEWERS: readonly InfraRoleCode[] = ['SUPERADMIN', ...ADMINS];

/** Who sees the patient on the board (`PATIENT_VIEWERS` of `infra-scope.ts`). */
export const PATIENT_VIEWERS: readonly InfraRoleCode[] = ADMINS;

/**
 * Action → roles: the tables of `infra-f2.policy.ts` and `infra-f3.policy.ts` of the API.
 * The operative roles (nursing, admission, cleaning, maintenance) were removed on
 * 2026-11-05: the organization account (and the site admin) operates everything.
 */
export const INFRA_POLICY: Readonly<Record<InfraAction, readonly InfraRoleCode[]>> = {
  'f2.board.read': ALL_VIEWERS,
  'f2.availability.clinical': ADMINS,
  'f2.availability.admin': ALL_VIEWERS,
  'f2.availability.maintenance': ADMINS,
  'f2.hygiene.mark-dirty': ADMINS,
  'f2.hygiene.mark-contaminated': ADMINS,
  'f2.isolation.set': ADMINS,
  'f2.isolation.cohort-approve': ['INFECTION_CONTROL'],
  'f2.cleaning.read': ADMINS,
  'f2.cleaning.create': ADMINS,
  'f2.cleaning.assign': ADMINS,
  'f2.cleaning.work': ADMINS,
  'f2.cleaning.inspect': ADMINS,
  'f2.cleaning.cancel': ADMINS,
  'f2.events.read': ALL_VIEWERS,
  'f3.adt.place': ADMINS,
  'f3.adt.override': ADMINS,
  'f3.adt.read': ALL_VIEWERS,
  'f3.incident.review': [...ADMINS, 'INFECTION_CONTROL'],
  'f3.census.read': [...ALL_VIEWERS, 'BILLING'],
  'f3.census.close': ADMINS,
  'f3.census.adjust': ADMINS,
  'f3.indicators.read': [...ALL_VIEWERS, 'BILLING'],
};

export function actionsOf(roles: readonly InfraRoleCode[]): InfraAction[] {
  return (Object.keys(INFRA_POLICY) as InfraAction[]).filter((a) => INFRA_POLICY[a].some((r) => roles.includes(r)));
}

/* ---- cuentas operativas de la maqueta ------------------------------------- */

/** The hospital staff accounts; all are site admins now that operative roles are gone. */
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
    a(INPATIENT_USERS.enfermeria, ['SITE_ADMIN']),
    a(INPATIENT_USERS.supervision, ['SITE_ADMIN']),
    a(INPATIENT_USERS.admision, ['SITE_ADMIN']),
    a(INPATIENT_USERS.limpieza, ['SITE_ADMIN']),
    a(INPATIENT_USERS.supervisoraLimpieza, ['SITE_ADMIN']),
    a(INPATIENT_USERS.mantenimiento, ['SITE_ADMIN']),
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
