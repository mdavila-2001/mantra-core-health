import type { InfraAction, InfraRoleCode, InfrastructureOpsCatalog, OpsConcept } from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { V2_LABEL, V2_RULES } from '../../data-access/infrastructure-ops/bed-status-v2';
import { uuid } from '../mock-store';

/* ============================================================================
    Operación de camas e internación simuladas — franjas F2 y F3.

    Catálogo (F2.2/F3.1), política de roles (§0.3, F2.3 y F3.3 «Permisos») y las
    asignaciones operativas de las cuentas de la maqueta. La política vive acá
    —del lado de la «API»— y la pantalla sólo lee lo que resulta de ella.
    ========================================================================== */

const c = (code: string, display: string): OpsConcept => ({ code, display });

export const AVAILABILITY: readonly OpsConcept[] = [
  c('SPACE_OP_AVAILABLE', 'Disponible'),
  c('SPACE_OP_BLOCKED_CLINICAL', 'Bloqueada (clínico)'),
  c('SPACE_OP_BLOCKED_ADMIN', 'Bloqueada (administrativo)'),
  c('SPACE_OP_MAINTENANCE', 'En mantenimiento'),
  c('SPACE_OP_CLOSED', 'Cerrada'),
];

export const HYGIENE: readonly OpsConcept[] = [
  c('HYG_CLEAN', 'Limpia sin inspeccionar'),
  c('HYG_DIRTY', 'Sucia'),
  c('HYG_CLEANING', 'Limpiando'),
  c('HYG_INSPECTED', 'Limpia e inspeccionada'),
  c('HYG_CONTAMINATED', 'Contaminada'),
];

export const ISOLATION: readonly OpsConcept[] = [
  c('ISO_NONE', 'Sin aislamiento'),
  c('ISO_CONTACT', 'Contacto'),
  c('ISO_DROPLET', 'Gotas'),
  c('ISO_AIRBORNE', 'Aéreo'),
  c('ISO_PROTECTIVE', 'Ambiente protector'),
];

export const OCCUPANCY: readonly OpsConcept[] = [c('OCC_FREE', 'Libre'), c('OCC_RESERVED', 'Reservada'), c('OCC_OCCUPIED', 'Ocupada')];

export const BLOCK_KINDS: readonly OpsConcept[] = [
  c('BLOCK_CLINICAL', 'Bloqueo clínico'),
  c('BLOCK_ADMIN', 'Bloqueo administrativo'),
  c('BLOCK_MAINTENANCE', 'Mantenimiento'),
  c('BLOCK_CLOSURE', 'Cierre'),
];

type K = 'BLOCK_CLINICAL' | 'BLOCK_ADMIN' | 'BLOCK_MAINTENANCE' | 'BLOCK_CLOSURE';
const reason = (code: string, display: string, kinds: readonly K[], requiresText = false) => ({ code, display, kinds, requiresText });

export const BLOCK_REASONS = [
  reason('BLOCK_RSN_STAFF_SHORTAGE', 'Falta de personal', ['BLOCK_CLINICAL', 'BLOCK_ADMIN']),
  reason('BLOCK_RSN_ISOLATION_COHORT', 'Cohorte de aislamiento', ['BLOCK_CLINICAL']),
  reason('BLOCK_RSN_PATIENT_CONDITION', 'Condición del paciente vecino', ['BLOCK_CLINICAL']),
  reason('BLOCK_RSN_EQUIPMENT_FAILURE', 'Falla de equipo', ['BLOCK_MAINTENANCE', 'BLOCK_CLINICAL']),
  reason('BLOCK_RSN_PREVENTIVE_MAINTENANCE', 'Mantenimiento preventivo', ['BLOCK_MAINTENANCE']),
  reason('BLOCK_RSN_INFRASTRUCTURE', 'Obra o infraestructura', ['BLOCK_MAINTENANCE', 'BLOCK_ADMIN', 'BLOCK_CLOSURE']),
  reason('BLOCK_RSN_PEST_CONTROL', 'Control de plagas', ['BLOCK_MAINTENANCE', 'BLOCK_ADMIN']),
  reason('BLOCK_RSN_ADMIN_DECISION', 'Decisión administrativa', ['BLOCK_ADMIN', 'BLOCK_CLOSURE']),
  reason('BLOCK_RSN_OTHER', 'Otro (describa el motivo)', ['BLOCK_CLINICAL', 'BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE'], true),
] as const;

export const CLEANING_TYPES: readonly OpsConcept[] = [
  c('CLEAN_ROUTINE', 'Rutina'),
  c('CLEAN_DISCHARGE', 'Egreso'),
  c('CLEAN_TERMINAL', 'Terminal'),
  c('CLEAN_OR_TURNOVER', 'Recambio de quirófano'),
  c('CLEAN_SPOT', 'Puntual'),
];

export const CLEANING_PRIORITIES: readonly OpsConcept[] = [
  c('CLN_PRIO_ROUTINE', 'Rutina'),
  c('CLN_PRIO_URGENT', 'Urgente'),
  c('CLN_PRIO_STAT', 'Inmediata'),
];

export const CLEANING_STATUS: readonly OpsConcept[] = [
  c('CLN_PENDING', 'Pendiente'),
  c('CLN_IN_PROGRESS', 'En curso'),
  c('CLN_DONE', 'Terminada · falta inspección'),
  c('CLN_INSPECTED', 'Inspeccionada'),
  c('CLN_REJECTED', 'Rechazada'),
  c('CLN_CANCELLED', 'Cancelada'),
];

export const CLEANING_TRIGGERS: readonly OpsConcept[] = [
  c('CLN_TRG_DISCHARGE', 'Egreso'),
  c('CLN_TRG_TRANSFER', 'Traslado'),
  c('CLN_TRG_MANUAL', 'Pedido manual'),
  c('CLN_TRG_ISOLATION_END', 'Fin de aislamiento'),
  c('CLN_TRG_CONTAMINATION', 'Contaminación'),
  c('CLN_TRG_MAINTENANCE_END', 'Fin de mantenimiento'),
  c('CLN_TRG_OR_TURNOVER', 'Recambio de quirófano'),
  c('CLN_TRG_INSPECTION_FAILED', 'Inspección rechazada'),
];

export const AXES: readonly OpsConcept[] = [
  c('AXIS_AVAILABILITY', 'Disponibilidad'),
  c('AXIS_HYGIENE', 'Higiene'),
  c('AXIS_ISOLATION', 'Aislamiento'),
  c('AXIS_OCCUPANCY', 'Ocupación'),
];

export const SOURCES: readonly OpsConcept[] = [
  c('SRC_MANUAL', 'Manual'),
  c('SRC_ADT', 'Internación (ADT)'),
  c('SRC_CLEANING', 'Limpieza'),
  c('SRC_BLOCK', 'Bloqueo'),
  c('SRC_ROOM_EVENT', 'Evento de sala'),
  c('SRC_SYSTEM', 'Sistema'),
];

/* ---- F3 ------------------------------------------------------------------- */

export const LEVELS_OF_CARE: readonly OpsConcept[] = [
  c('LOC_CARE_GENERAL', 'General'),
  c('LOC_CARE_INTERMEDIATE', 'Cuidados intermedios'),
  c('LOC_CARE_ICU', 'Terapia intensiva'),
  c('LOC_CARE_NEONATAL_ICU', 'Terapia intensiva neonatal'),
];

export const ADMISSION_SOURCES: readonly OpsConcept[] = [
  c('ADM_SRC_EMERGENCY', 'Emergencias'),
  c('ADM_SRC_OUTPATIENT', 'Consulta externa'),
  c('ADM_SRC_REFERRAL', 'Referencia'),
  c('ADM_SRC_BIRTH', 'Nacimiento'),
  c('ADM_SRC_TRANSFER_IN', 'Traslado desde otro establecimiento'),
];

export const DISPOSITIONS: readonly OpsConcept[] = [
  c('DISP_HOME', 'Alta a domicilio'),
  c('DISP_TRANSFER', 'Traslado a otro establecimiento'),
  c('DISP_DEATH', 'Fallecimiento'),
  c('DISP_AGAINST_ADVICE', 'Alta voluntaria'),
  c('DISP_OTHER', 'Otro'),
];

export const MOVEMENT_TYPES: readonly OpsConcept[] = [
  c('ADT_ADMIT', 'Ingreso'),
  c('ADT_TRANSFER', 'Traslado'),
  c('ADT_SWAP', 'Intercambio'),
  c('ADT_RESERVE', 'Reserva'),
];

export const LOCATION_STATUS: readonly OpsConcept[] = [
  c('LOCATION_ACTIVE', 'En curso'),
  c('LOCATION_RESERVED', 'Reservada'),
  c('LOCATION_COMPLETED', 'Terminada'),
  c('LOCATION_CANCELLED', 'Cancelada'),
];

export const END_REASONS: readonly OpsConcept[] = [
  c('ADT_END_DISCHARGE', 'Egreso'),
  c('ADT_END_TRANSFER_OUT', 'Traslado'),
  c('ADT_END_SWAP', 'Intercambio'),
  c('ADT_END_RESERVATION_CANCELLED', 'Reserva cancelada'),
  c('ADT_END_TRANSFER_CANCELLED', 'Traslado cancelado'),
  c('ADT_END_RESERVATION_CONVERTED', 'Reserva convertida en ocupación'),
];

export const TRANSFER_REASONS: readonly OpsConcept[] = [
  c('TRF_CLINICAL', 'Indicación clínica'),
  c('TRF_ISOLATION', 'Aislamiento'),
  c('TRF_LEVEL_OF_CARE', 'Cambio de nivel de cuidado'),
  c('TRF_PATIENT_REQUEST', 'Pedido del paciente'),
  c('TRF_BED_MANAGEMENT', 'Gestión de camas'),
];

export const INCIDENT_STATUS: readonly OpsConcept[] = [
  c('PLC_INC_OPEN', 'Abierto'),
  c('PLC_INC_REVIEWED', 'Revisado'),
  c('PLC_INC_CLOSED', 'Cerrado'),
];

const TODOS: ReadonlyMap<string, string> = new Map(
  [
    ...AVAILABILITY, ...HYGIENE, ...ISOLATION, ...OCCUPANCY, ...BLOCK_KINDS, ...BLOCK_REASONS, ...CLEANING_TYPES,
    ...CLEANING_PRIORITIES, ...CLEANING_STATUS, ...CLEANING_TRIGGERS, ...AXES, ...SOURCES, ...LEVELS_OF_CARE,
    ...ADMISSION_SOURCES, ...DISPOSITIONS, ...MOVEMENT_TYPES, ...LOCATION_STATUS, ...END_REASONS, ...TRANSFER_REASONS,
    ...INCIDENT_STATUS,
  ].map((k) => [k.code, k.display]),
);

export function opsConcept(code: string): OpsConcept {
  return { code, display: TODOS.get(code) ?? code };
}

/** Lo que F2 suma a `GET /practice/infrastructure-catalog`. */
export const OPS_CATALOG: InfrastructureOpsCatalog = {
  availability: AVAILABILITY,
  hygiene: HYGIENE,
  isolation: ISOLATION,
  occupancy: OCCUPANCY,
  blockKinds: BLOCK_KINDS,
  blockReasons: BLOCK_REASONS,
  cleaningTypes: CLEANING_TYPES,
  cleaningPriorities: CLEANING_PRIORITIES,
  v2Map: V2_RULES.map((r) => ({ code: r.code, display: V2_LABEL[r.code], rule: r.rule })),
};

/* ---- política (§0.3 · permisos F2 y F3) ---------------------------------- */

const ALL_VIEWERS: readonly InfraRoleCode[] = ['SUPERADMIN', 'ORG_ADMIN', 'NURSE', 'ADMISSION', 'HOUSEKEEPING', 'MAINTENANCE'];
const CLINICAL: readonly InfraRoleCode[] = ['NURSE', 'ADMISSION'];

/** Acción → roles que la tienen. La API decide con esta tabla; la UI la refleja. */
export const INFRA_POLICY: Readonly<Record<InfraAction, readonly InfraRoleCode[]>> = {
  'board.view': ALL_VIEWERS,
  'board.view-patient': CLINICAL,
  'block.clinical': ['NURSE'],
  'block.admin': ['SUPERADMIN', 'ORG_ADMIN'],
  maintenance: ['ORG_ADMIN', 'MAINTENANCE'],
  'hygiene.mark-dirty': ['NURSE', 'HOUSEKEEPING'],
  'hygiene.mark-contaminated': ['NURSE'],
  isolation: ['NURSE'],
  'cleaning.view': ['ORG_ADMIN', 'NURSE', 'ADMISSION', 'HOUSEKEEPING'],
  'cleaning.create': ['NURSE', 'HOUSEKEEPING'],
  'cleaning.assign': ['NURSE', 'HOUSEKEEPING'],
  'cleaning.work': ['NURSE', 'HOUSEKEEPING'],
  'cleaning.inspect': ['NURSE_SUPERVISOR', 'HOUSEKEEPING_SUPERVISOR'],
  'history.view': ALL_VIEWERS,
  'adt.admit': CLINICAL,
  'adt.transfer': CLINICAL,
  'adt.discharge': CLINICAL,
  'adt.override': ['NURSE_SUPERVISOR'],
  'adt.cancel': CLINICAL,
  'incident.review': ['NURSE_SUPERVISOR'],
  'census.view': ['SUPERADMIN', 'ORG_ADMIN', 'NURSE', 'ADMISSION', 'BILLING'],
  'census.close': ['ORG_ADMIN', 'NURSE_SUPERVISOR', 'ADMISSION'],
  'census.adjust': ['ORG_ADMIN', 'NURSE_SUPERVISOR'],
  'indicators.view': ['SUPERADMIN', 'ORG_ADMIN', 'NURSE', 'ADMISSION', 'BILLING'],
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
  censusCloseGraceMinutes: 30,
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
