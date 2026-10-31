import type { V2Code } from './infrastructure-ops.types';

/* ============================================================================
    Mapa de conceptos de F2/F3: código de la API → etiqueta en castellano.

    La API manda códigos (`SPACE_OP_MAINTENANCE`, `LOC_FORM_BED`, `ACTIVE`,
    `CLN_PENDING`, `LOC_CARE_ICU`…) y ningún texto; la pantalla los traduce
    acá. Un código que no está en el mapa se muestra tal cual: es un aviso
    visible de que la API agregó un concepto, no un hueco silencioso.
    ========================================================================== */

const LABELS: Readonly<Record<string, string>> = {
  // ciclo de vida de la celda (`lifecycleStateOf`)
  PLANNED: 'Planificada',
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  RETIRED: 'Dada de baja',
  // formas
  LOC_FORM_SITE: 'Sede',
  LOC_FORM_BUILDING: 'Edificio',
  LOC_FORM_WING: 'Ala',
  LOC_FORM_LEVEL: 'Piso',
  LOC_FORM_WARD: 'Sala',
  LOC_FORM_AREA: 'Área',
  LOC_FORM_CORRIDOR: 'Pasillo',
  LOC_FORM_ROOM: 'Habitación',
  LOC_FORM_BED: 'Cama',
  LOC_FORM_VIRTUAL: 'Virtual',
  // disponibilidad
  SPACE_OP_AVAILABLE: 'Disponible',
  SPACE_OP_BLOCKED_CLINICAL: 'Bloqueada (clínico)',
  SPACE_OP_BLOCKED_ADMIN: 'Bloqueada (administrativo)',
  SPACE_OP_MAINTENANCE: 'En mantenimiento',
  SPACE_OP_CLOSED: 'Cerrada',
  // higiene
  HYG_CLEAN: 'Limpia sin inspeccionar',
  HYG_DIRTY: 'Sucia',
  HYG_CLEANING: 'Limpiando',
  HYG_INSPECTED: 'Limpia e inspeccionada',
  HYG_CONTAMINATED: 'Contaminada',
  // aislamiento
  ISO_NONE: 'Sin aislamiento',
  ISO_CONTACT: 'Contacto',
  ISO_DROPLET: 'Gotas',
  ISO_AIRBORNE: 'Aéreo',
  ISO_PROTECTIVE: 'Ambiente protector',
  // ocupación
  OCC_FREE: 'Libre',
  OCC_RESERVED: 'Reservada',
  OCC_OCCUPIED: 'Ocupada',
  // bloqueos
  BLOCK_CLINICAL: 'Bloqueo clínico',
  BLOCK_ADMIN: 'Bloqueo administrativo',
  BLOCK_MAINTENANCE: 'Mantenimiento',
  BLOCK_CLOSURE: 'Cierre',
  BLOCK_RSN_STAFF_SHORTAGE: 'Falta de personal',
  BLOCK_RSN_ISOLATION_COHORT: 'Cohorte de aislamiento',
  BLOCK_RSN_PATIENT_CONDITION: 'Condición del paciente vecino',
  BLOCK_RSN_EQUIPMENT_FAILURE: 'Falla de equipo',
  BLOCK_RSN_PREVENTIVE_MAINTENANCE: 'Mantenimiento preventivo',
  BLOCK_RSN_INFRASTRUCTURE: 'Obra o infraestructura',
  BLOCK_RSN_PEST_CONTROL: 'Control de plagas',
  BLOCK_RSN_ADMIN_DECISION: 'Decisión administrativa',
  BLOCK_RSN_OTHER: 'Otro (describa el motivo)',
  // limpieza
  CLEAN_ROUTINE: 'Rutina',
  CLEAN_DISCHARGE: 'Egreso',
  CLEAN_TERMINAL: 'Terminal',
  CLEAN_OR_TURNOVER: 'Recambio de quirófano',
  CLEAN_SPOT: 'Puntual',
  CLN_PRIO_ROUTINE: 'Rutina',
  CLN_PRIO_URGENT: 'Urgente',
  CLN_PRIO_STAT: 'Inmediata',
  CLN_PENDING: 'Pendiente',
  CLN_IN_PROGRESS: 'En curso',
  CLN_DONE: 'Terminada',
  CLN_INSPECTED: 'Inspeccionada',
  CLN_REJECTED: 'Rechazada',
  CLN_CANCELLED: 'Cancelada',
  CLN_TRG_DISCHARGE: 'Egreso',
  CLN_TRG_TRANSFER: 'Traslado',
  CLN_TRG_MANUAL: 'Pedido manual',
  CLN_TRG_ISOLATION_END: 'Fin de aislamiento',
  CLN_TRG_CONTAMINATION: 'Contaminación',
  CLN_TRG_MAINTENANCE_END: 'Fin de mantenimiento',
  CLN_TRG_OR_TURNOVER: 'Recambio de quirófano',
  CLN_TRG_INSPECTION_FAILED: 'Inspección rechazada',
  // A20
  AVAILABILITY: 'Disponibilidad',
  HYGIENE: 'Higiene',
  ISOLATION: 'Aislamiento',
  OCCUPANCY: 'Ocupación',
  MANUAL: 'Manual',
  ADT: 'Internación (ADT)',
  CLEANING: 'Limpieza',
  BLOCK: 'Bloqueo',
  ROOM_EVENT: 'Evento de sala',
  SYSTEM: 'Sistema',
  // F3 · internación
  LOC_CARE_GENERAL: 'Cuidado general',
  LOC_CARE_INTERMEDIATE: 'Cuidados intermedios',
  LOC_CARE_ICU: 'Terapia intensiva',
  LOC_CARE_NEONATAL_ICU: 'Terapia intensiva neonatal',
  ADM_SRC_EMERGENCY: 'Emergencias',
  ADM_SRC_OUTPATIENT: 'Consulta externa',
  ADM_SRC_REFERRAL: 'Referencia',
  ADM_SRC_BIRTH: 'Nacimiento',
  ADM_SRC_TRANSFER_IN: 'Traslado desde otro establecimiento',
  DISP_HOME: 'Alta a domicilio',
  DISP_TRANSFER: 'Traslado a otro establecimiento',
  DISP_DEATH: 'Fallecimiento',
  DISP_AGAINST_ADVICE: 'Alta voluntaria',
  DISP_OTHER: 'Otro',
  ADT_ADMIT: 'Ingreso',
  ADT_TRANSFER: 'Traslado',
  ADT_SWAP: 'Intercambio',
  ADT_RESERVE: 'Reserva',
  LOCATION_ACTIVE: 'En curso',
  LOCATION_RESERVED: 'Reservada',
  LOCATION_COMPLETED: 'Terminada',
  LOCATION_CANCELLED: 'Cancelada',
  ADT_END_DISCHARGE: 'Egreso',
  ADT_END_TRANSFER_OUT: 'Traslado',
  ADT_END_SWAP: 'Intercambio',
  ADT_END_RESERVATION_CANCELLED: 'Reserva cancelada',
  ADT_END_TRANSFER_CANCELLED: 'Traslado cancelado',
  ADT_END_RESERVATION_CONVERTED: 'Reserva convertida en ocupación',
  ENCOUNTER_IN_PROGRESS: 'En curso',
  ENCOUNTER_FINISHED: 'Egresada',
  ENCOUNTER_ARRIVED: 'Llegada',
  PLC_INC_OPEN: 'Abierto',
  PLC_INC_REVIEWED: 'Revisado',
  PLC_INC_CLOSED: 'Cerrado',
  OPEN: 'Abierto · vista previa',
  CLOSED: 'Cerrado',
};

/** La etiqueta de un código de la API; sin código, «sin dato». */
export function opsLabel(code: string | null | undefined): string {
  if (code === null || code === undefined || code === '') return 'sin dato';
  return LABELS[code] ?? code;
}

/** La leyenda del tablero (F2.2), en el orden en que la API evalúa. */
export const V2_LEGEND: readonly { readonly code: V2Code; readonly rule: string }[] = [
  { code: 'C', rule: 'Bloqueada, en mantenimiento, cerrada o con ciclo de vida distinto de activo' },
  { code: 'K', rule: 'Contaminada: exige limpieza terminal antes de volver a usarse' },
  { code: 'I', rule: 'Con precaución de aislamiento' },
  { code: 'O', rule: 'Con paciente' },
  { code: 'R', rule: 'Guardada para un ingreso (extensión local urn:mantra:bed-status)' },
  { code: 'H', rule: 'Sucia, limpiando, limpia sin inspeccionar o con limpieza terminal pendiente' },
  { code: 'U', rule: 'Libre, limpia e inspeccionada: se puede asignar' },
];

/** El texto de cada letra: el badge lo dice con palabras, nunca sólo con color. */
export const V2_LABEL: Readonly<Record<V2Code, string>> = {
  C: 'No disponible',
  K: 'Contaminada',
  I: 'Aislamiento',
  O: 'Ocupada',
  R: 'Reservada',
  H: 'Limpieza pendiente',
  U: 'Libre',
};

const SEX_LABEL: Readonly<Record<string, string>> = { M: 'masculino', F: 'femenino', O: 'otro' };
const SEX_SHORT: Readonly<Record<string, string>> = { M: 'M', F: 'F', O: 'O' };

/** Sexo del paciente del tablero (`M`/`F`/`O`) en palabras; sin dato, «sin dato». */
export function sexLabel(code: string | null | undefined, short = false): string {
  if (code === null || code === undefined || code === '') return 'sin dato';
  return (short ? SEX_SHORT[code] : SEX_LABEL[code]) ?? 'sin dato';
}

/** Edad en años; sin fecha de nacimiento, «edad sin dato». */
export function ageLabel(years: number | null | undefined, short = false): string {
  if (years === null || years === undefined || !Number.isFinite(years)) return 'edad sin dato';
  return short ? `${years} a` : `${years} años`;
}
