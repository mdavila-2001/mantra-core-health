import { uuid } from '../mock-store';
import { SITIO_SANLUCAS } from './agenda';
import type { EspacioSim } from './infrastructure.data';

/* ============================================================================
    Semillas del simulador de internación / ADT (franja F3).

    ## Qué agrega al hospital de F1, y por qué

    El árbol de F1 trae seis camas; con eso no hay censo, traslado ni intercambio
    que mostrar. Aquí se **agregan** habitaciones y camas bajo las salas que F1 ya
    sembró (`SALA-3B`, `UTI`, `ED-A-P4`), con códigos nuevos: ni se tocan ni se
    renombran las de F1 (el recuento de la ficha de `HAB-301` sigue en 2 camas).
    Cada una cubre una regla del contrato de compatibilidad:

    | Cama      | Para qué                                                      |
    |-----------|---------------------------------------------------------------|
    | 323-A/B   | Habitación de mujeres (`SEX_FEMALE`): regla SEX forzable      |
    | 324-A     | Local AIIR validado: único destino del aislamiento aéreo      |
    | 325-A/B   | Habitación de adultos: regla AGE para un niño                 |
    | UTI-5/4   | Camas de terapia: regla LEVEL_OF_CARE                         |
    | 421-A/B   | Pediatría (`AGE_PEDIATRIC`)                                   |

    La historia (`HISTORIA`) y las estancias vivas (`VIVAS`) son la fuente del
    censo y de los indicadores: ninguna cifra del censo está escrita, todas se
    calculan de estas estancias con las definiciones de `§F3.3`.
    ========================================================================== */

/** Zona de la sede: Bolivia es UTC−4 todo el año. */
export const OFFSET_SEDE_MIN = -240;

export const SITIO_ADT = SITIO_SANLUCAS.id;

const base = {
  clinicalUnitId: null,
  capacity: null,
  rowVersion: 1,
  description: null,
  floorNumber: null,
  areaM2: null,
  asepsis: null,
  pressure: null,
  airChangesPerHour: null,
  hvacValidatedOn: null,
  sexRestriction: null,
  ageGroup: null,
  bedCategory: null,
  censable: null,
  prepMinutes: null,
  cleanupMinutes: null,
  gln: null,
  validFrom: null,
  validTo: null,
  status: 'SPACE_ACTIVE',
  operational: 'SPACE_OP_AVAILABLE',
} as const;

/** Los ids de F1 se calculan con la semilla `infra-sanlucas-<código>` (minúscula). */
const idF1 = (code: string): string => uuid(`infra-sanlucas-${code}`);

function espacio(code: string, name: string, parentId: string, form: string, fn: string, extra: Partial<EspacioSim> = {}): EspacioSim {
  return {
    ...base,
    id: idF1(code),
    siteId: SITIO_ADT,
    parentId,
    code,
    name,
    form: `LOC_FORM_${form}`,
    function: `SPACE_FN_${fn}`,
    ...extra,
  };
}

const cama = (code: string, parent: string, fn = 'BED_STANDARD', extra: Partial<EspacioSim> = {}): EspacioSim =>
  espacio(code, `Cama ${code}`, idF1(parent), 'BED', fn, {
    bedCategory: fn === 'BED_ICU' ? 'BED_CAT_ICU' : 'BED_CAT_PRIVATE',
    censable: true,
    capacity: 1,
    ...extra,
  });

const ID_SALA_3B = idF1('SALA-3B');
const ID_PISO4 = idF1('ED-A-P4');

/** Los espacios que F3 suma al árbol de F1 (los inserta `sembrarCamasAdt`). */
export const ESPACIOS_ADT: readonly EspacioSim[] = [
  espacio('HAB-323', 'Habitación 323 · mujeres', ID_SALA_3B, 'ROOM', 'INPATIENT_ROOM', { areaM2: 20, sexRestriction: 'SEX_FEMALE', ageGroup: 'AGE_ADULT' }),
  cama('323-A', 'HAB-323'),
  cama('323-B', 'HAB-323'),
  espacio('HAB-324', 'Habitación 324 · aislamiento aéreo', ID_SALA_3B, 'ROOM', 'ISOLATION_AIIR', {
    areaM2: 22, asepsis: 'ASEPSIS_SEMI', pressure: 'PRESSURE_NEGATIVE', airChangesPerHour: 14, hvacValidatedOn: '2026-08-30', ageGroup: 'AGE_ADULT',
  }),
  cama('324-A', 'HAB-324'),
  espacio('HAB-325', 'Habitación 325 · adultos', ID_SALA_3B, 'ROOM', 'INPATIENT_ROOM', { areaM2: 20, sexRestriction: 'SEX_ANY', ageGroup: 'AGE_ADULT' }),
  cama('325-A', 'HAB-325'),
  cama('325-B', 'HAB-325'),
  cama('UTI-5', 'UTI', 'BED_ICU'),
  cama('UTI-6', 'UTI', 'BED_ICU'),
  espacio('SALA-4P', 'Sala 4P · Pediatría', ID_PISO4, 'WARD', 'WARD_GENERIC'),
  espacio('HAB-421', 'Habitación 421 · pediatría', idF1('SALA-4P'), 'ROOM', 'INPATIENT_ROOM', { areaM2: 18, sexRestriction: 'SEX_ANY', ageGroup: 'AGE_PEDIATRIC' }),
  cama('421-A', 'HAB-421'),
  cama('421-B', 'HAB-421'),
].map((e) => {
  // Las salas heredan la unidad en F1 (`clinicalUnitId` del espacio sembrado); aquí se
  // declara la unidad propietaria de cada local nuevo con el código de unidad.
  const unidad = e.code.startsWith('HAB-42') || e.code === 'SALA-4P' ? 'PEDIA' : e.code.startsWith('UTI-') ? null : 'MEDINT';
  return unidad === null || e.form === 'LOC_FORM_BED' ? e : { ...e, clinicalUnitId: uuid(`unit-SANLUCAS-${unidad}`) };
});

export const unidadDe = (code: 'MEDINT' | 'PEDIA'): string => uuid(`unit-SANLUCAS-${code}`);

/* ---- estancias --------------------------------------------------------------- */

export interface EstanciaSemilla {
  readonly clave: string;
  /** Apellido del paciente en `PATIENTS`, o índice del generado. */
  readonly paciente: string | number;
  readonly camas: readonly { readonly cama: string; readonly desde: readonly [number, number]; readonly hasta?: readonly [number, number]; readonly motivoFin?: 'TRANSFER_OUT' | 'DISCHARGE' }[];
  /** `[días atrás, hora local]` del ingreso; si falta, el de la primera cama. */
  readonly nivel: 'LOC_CARE_GENERAL' | 'LOC_CARE_INTERMEDIATE' | 'LOC_CARE_ICU';
  readonly fuente: string;
  readonly motivo: string;
  readonly egreso?: { readonly cuando: readonly [number, number]; readonly disposicion: string };
  readonly esperadoEn?: number;
  readonly aislamiento?: 'ISO_NONE' | 'ISO_CONTACT' | 'ISO_AIRBORNE';
}

/** Estancias que ya terminaron antes de «hoy» (alimentan egresos, días de estancia y rotación). */
export const HISTORIA: readonly EstanciaSemilla[] = [
  { clave: 'H1', paciente: 'Medina', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_OUTPATIENT', motivo: 'Neumonía adquirida en la comunidad', camas: [{ cama: '323-B', desde: [7, 10], hasta: [5, 12], motivoFin: 'DISCHARGE' }], egreso: { cuando: [5, 12], disposicion: 'DISP_HOME' } },
  { clave: 'H2', paciente: 'Solíz', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Colecistitis aguda', camas: [{ cama: '325-B', desde: [6, 9], hasta: [3, 11], motivoFin: 'DISCHARGE' }], egreso: { cuando: [3, 11], disposicion: 'DISP_HOME' } },
  { clave: 'H3', paciente: 'Vaca', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Pancreatitis', camas: [{ cama: '302-A', desde: [7, 8], hasta: [3, 9], motivoFin: 'DISCHARGE' }], egreso: { cuando: [3, 9], disposicion: 'DISP_HOME' } },
  { clave: 'H4', paciente: 13, nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_OUTPATIENT', motivo: 'Observación posquirúrgica', camas: [{ cama: '324-A', desde: [5, 10], hasta: [4, 10], motivoFin: 'DISCHARGE' }], egreso: { cuando: [4, 10], disposicion: 'DISP_HOME' } },
  { clave: 'H5', paciente: 14, nivel: 'LOC_CARE_ICU', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Shock séptico', camas: [{ cama: 'UTI-5', desde: [6, 9], hasta: [2, 14], motivoFin: 'DISCHARGE' }], egreso: { cuando: [2, 14], disposicion: 'DISP_TRANSFER' } },
  { clave: 'H6', paciente: 15, nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Bronquiolitis', camas: [{ cama: '421-A', desde: [4, 11], hasta: [3, 13], motivoFin: 'DISCHARGE' }], egreso: { cuando: [3, 13], disposicion: 'DISP_HOME' } },
  { clave: 'H7', paciente: 16, nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_OUTPATIENT', motivo: 'Procedimiento de un día', camas: [{ cama: '325-B', desde: [2, 9], hasta: [2, 15], motivoFin: 'DISCHARGE' }], egreso: { cuando: [2, 15], disposicion: 'DISP_HOME' } },
  { clave: 'H8', paciente: 17, nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Deshidratación', camas: [{ cama: '301-A', desde: [3, 10], hasta: [1, 9], motivoFin: 'DISCHARGE' }], egreso: { cuando: [1, 9], disposicion: 'DISP_HOME' } },
];

/** Estancias en curso: cada una ocupa su cama hoy (o terminó su tramo anterior en otra). */
export const VIVAS: readonly EstanciaSemilla[] = [
  { clave: 'V1', paciente: 'Mamani', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Insuficiencia cardíaca descompensada', esperadoEn: 2, camas: [{ cama: '301-B', desde: [5, 10] }] },
  { clave: 'V2', paciente: 'Guzmán', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_OUTPATIENT', motivo: 'Cirugía programada de hernia', esperadoEn: 1, camas: [{ cama: '302-A', desde: [3, 14] }] },
  { clave: 'V3', paciente: 'Condori', nivel: 'LOC_CARE_ICU', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Neumonía grave', camas: [{ cama: '301-A', desde: [6, 9], hasta: [4, 16], motivoFin: 'TRANSFER_OUT' }, { cama: 'UTI-1', desde: [4, 16] }] },
  { clave: 'V4', paciente: 'Flores', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_REFERRAL', motivo: 'Pielonefritis', esperadoEn: 3, camas: [{ cama: '323-A', desde: [2, 11] }] },
  { clave: 'V5', paciente: 'Torrez', nivel: 'LOC_CARE_GENERAL', fuente: 'ADM_SRC_EMERGENCY', motivo: 'Apendicitis posoperada', esperadoEn: 1, camas: [{ cama: '325-A', desde: [1, 9] }] },
];

/** Cama con ciclo de higiene ya corrido en el pasado (para la rotación). */
export const SUCIAS_HOY: readonly string[] = ['301-A'];
/** Cama de terapia en mantenimiento desde ayer (hasta mañana): no asignable, no cuenta como disponible. */
export const EN_MANTENIMIENTO = { cama: 'UTI-6', desde: [1, 14] as readonly [number, number], hasta: [-1, 12] as readonly [number, number] };
