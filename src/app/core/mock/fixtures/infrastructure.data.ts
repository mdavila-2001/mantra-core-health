import type {
  FunctionProfile,
  InfraConcept,
  InfrastructureCatalog,
  ParentRule,
  RetireBlocker,
  TypologyRule,
} from '../../data-access/infrastructure/infrastructure.types';
import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS, PRACTICE_SANLUCAS, SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from './agenda';
import { isoDia, uuid } from '../mock-store';

/* ============================================================================
    Datos del backend simulado de infraestructura (franja F1).

    El catálogo sigue el §2 de `CONTRATO-F0-F1.md` —formas, funciones con su
    perfil, reglas padre→hijo, reglas de tipología, conceptos regulatorios de
    Bolivia— y las semillas ponen un hospital armado de verdad: edificio →
    piso → sala → habitación → cama, con quirófanos cuyos ids son **los mismos**
    que usa `procedures.handlers.ts` para sus cirugías (`operating-room-1/2`).

    Las cifras que la pantalla muestra (camas, quirófanos activos) NO están
    escritas acá: las deriva el manejador de lo que hay en el árbol.

    Los códigos SNIS son marcadores de maqueta, sin formato oficial: el formato
    real no se pudo verificar (ver README de la franja, «Pendientes heredados»).
    ========================================================================== */

export const c = (code: string, display: string): InfraConcept => ({ code, display });

/* ---- conceptos ----------------------------------------------------------- */

const FORMAS: readonly InfraConcept[] = [
  c('LOC_FORM_SITE', 'Predio'),
  c('LOC_FORM_BUILDING', 'Edificio'),
  c('LOC_FORM_WING', 'Pabellón / ala'),
  c('LOC_FORM_LEVEL', 'Piso'),
  c('LOC_FORM_WARD', 'Sala de internación'),
  c('LOC_FORM_AREA', 'Área'),
  c('LOC_FORM_CORRIDOR', 'Pasillo'),
  c('LOC_FORM_ROOM', 'Local'),
  c('LOC_FORM_BED', 'Cama'),
  c('LOC_FORM_VIRTUAL', 'Sala virtual'),
];

const R = 'LOC_FORM_ROOM';
const A = 'LOC_FORM_AREA';
const B = 'LOC_FORM_BED';

/** [código, rótulo, formas, banderas]. S agendable · I internable · B facturable · O solape · X aislamiento · T stock · E equipos · C limpieza terminal · A exige área · H exige HVAC. */
const FUNCIONES: readonly (readonly [string, string, readonly string[], string])[] = [
  ['CONSULTING_ROOM', 'Consultorio', [R], 'SE'],
  ['INPATIENT_ROOM', 'Habitación de internación', [R], 'IBC'],
  ['OPERATING_ROOM', 'Quirófano', [R], 'SECAH'],
  ['PROCEDURE_ROOM', 'Sala de procedimientos', [R], 'SEC'],
  ['DELIVERY_ROOM', 'Sala de partos', [R], 'SECAH'],
  ['RECOVERY_PACU', 'Recuperación posanestésica', [R, A], 'IC'],
  ['ICU_BAY', 'Puesto de terapia intensiva', [R, A], 'IBCE'],
  ['EMERGENCY_BOX', 'Box de emergencias', [R], 'SE'],
  ['OBSERVATION', 'Observación', [R, A], 'I'],
  ['ISOLATION_AIIR', 'Aislamiento aéreo (AIIR)', [R], 'IXCAH'],
  ['PROTECTIVE_ENV', 'Ambiente protector', [R], 'ICH'],
  ['IMAGING_ROOM', 'Sala de imagen', [R], 'SEA'],
  ['SAMPLE_COLLECTION', 'Toma de muestras', [R], 'S'],
  ['LAB_AREA', 'Área de laboratorio', [A, R], 'E'],
  ['PHARMACY', 'Farmacia', [A, R], 'T'],
  ['STORAGE', 'Depósito', [R, A], 'T'],
  ['STERILIZATION', 'Esterilización', [R, A], 'E'],
  ['WAITING', 'Sala de espera', [A, R], ''],
  ['NURSE_STATION', 'Estación de enfermería', [A, R], ''],
  ['OFFICE_ADMIN', 'Oficina administrativa', [R], ''],
  ['BED_STANDARD', 'Cama estándar', [B], 'IBC'],
  ['BED_ICU', 'Cama de terapia intensiva', [B], 'IBCE'],
  ['CRIB', 'Cuna', [B], 'IB'],
  ['STRETCHER', 'Camilla', [B], 'S'],
  ['BUILDING_GENERIC', 'Edificio', ['LOC_FORM_BUILDING', 'LOC_FORM_SITE'], ''],
  ['WING_GENERIC', 'Pabellón', ['LOC_FORM_WING'], ''],
  ['LEVEL_GENERIC', 'Piso', ['LOC_FORM_LEVEL'], ''],
  ['WARD_GENERIC', 'Sala de internación', ['LOC_FORM_WARD'], 'I'],
  ['AREA_GENERIC', 'Área', [A, 'LOC_FORM_CORRIDOR', 'LOC_FORM_VIRTUAL'], ''],
];

const PERFILES: readonly FunctionProfile[] = FUNCIONES.map(([code, display, forms, flags]) => ({
  code: `SPACE_FN_${code}`,
  display,
  forms,
  schedulable: flags.includes('S'),
  inpatient: flags.includes('I'),
  billable: flags.includes('B'),
  allowOverlap: flags.includes('O'),
  isolationCapable: flags.includes('X'),
  stockPoint: flags.includes('T'),
  hostsEquipment: flags.includes('E'),
  requiresTerminalCleaning: flags.includes('C'),
  requiresArea: flags.includes('A'),
  requiresHvac: flags.includes('H'),
}));

const REGLAS_PADRE: readonly [string | null, readonly string[]][] = [
  [null, ['BUILDING', 'AREA', 'ROOM', 'VIRTUAL']],
  ['SITE', ['BUILDING', 'AREA']],
  ['BUILDING', ['WING', 'LEVEL', 'AREA', 'ROOM']],
  ['WING', ['LEVEL', 'WARD', 'AREA', 'ROOM']],
  ['LEVEL', ['WARD', 'AREA', 'ROOM', 'CORRIDOR']],
  ['WARD', ['ROOM', 'BED']],
  ['AREA', ['ROOM', 'BED', 'AREA']],
  ['ROOM', ['BED']],
  ['CORRIDOR', ['ROOM']],
];

const REGLAS_DE_FORMA: readonly ParentRule[] = REGLAS_PADRE.flatMap(([padre, hijos]) =>
  hijos.map((hijo) => ({
    parent: padre === null ? null : `LOC_FORM_${padre}`,
    child: `LOC_FORM_${hijo}`,
  })),
);

const GENERICAS = ['BUILDING_GENERIC', 'WING_GENERIC', 'LEVEL_GENERIC', 'WARD_GENERIC', 'AREA_GENERIC'];
const AMBULATORIAS = [
  'CONSULTING_ROOM', 'PROCEDURE_ROOM', 'SAMPLE_COLLECTION', 'PHARMACY', 'STORAGE', 'WAITING',
  'NURSE_STATION', 'OFFICE_ADMIN', 'OBSERVATION', 'STERILIZATION', 'STRETCHER', ...GENERICAS,
];
const REQUERIDAS_HOSPITAL = ['EMERGENCY_BOX', 'INPATIENT_ROOM', 'OPERATING_ROOM'];

/**
 * Reglas de tipología sembradas con la norma de origen en el comentario (INV-18):
 * Puesto de Salud y Centro de Salud ambulatorio no admiten quirófano, UTI ni
 * internación; Hospital 2.º/3.º nivel **exige** box de emergencias, habitación de
 * internación y quirófano. Una tipología sin filas no restringe nada.
 */
const REGLAS_DE_TIPOLOGIA: readonly TypologyRule[] = [
  ...AMBULATORIAS.map((f): TypologyRule => ({ typology: 'TYPOLOGY_HEALTH_POST', function: `SPACE_FN_${f}`, rule: 'TYPO_ALLOWED' })),
  ...[...AMBULATORIAS, 'IMAGING_ROOM', 'LAB_AREA'].map(
    (f): TypologyRule => ({ typology: 'TYPOLOGY_HC_AMBULATORY', function: `SPACE_FN_${f}`, rule: 'TYPO_ALLOWED' }),
  ),
  ...['TYPOLOGY_HOSPITAL_L2', 'TYPOLOGY_HOSPITAL_L3'].flatMap((tipologia) =>
    FUNCIONES.map(([f]): TypologyRule => ({
      typology: tipologia,
      function: `SPACE_FN_${f}`,
      rule: REQUERIDAS_HOSPITAL.includes(f) ? 'TYPO_REQUIRED' : 'TYPO_ALLOWED',
    })),
  ),
];

export const CATALOGO: InfrastructureCatalog = {
  forms: FORMAS,
  functions: PERFILES,
  parentRules: REGLAS_DE_FORMA,
  typologyRules: REGLAS_DE_TIPOLOGIA,
  lifecycle: [
    c('SPACE_PLANNED', 'Planificado'),
    c('SPACE_ACTIVE', 'Activo'),
    c('SPACE_SUSPENDED', 'Suspendido'),
    c('SPACE_RETIRED', 'Clausurado'),
  ],
  attributes: {
    asepsis: [c('ASEPSIS_UNRESTRICTED', 'Sin restricción'), c('ASEPSIS_SEMI', 'Semirrestringida'), c('ASEPSIS_RESTRICTED', 'Restringida')],
    pressure: [c('PRESSURE_NEUTRAL', 'Neutra'), c('PRESSURE_POSITIVE', 'Positiva'), c('PRESSURE_NEGATIVE', 'Negativa')],
    sex: [c('SEX_ANY', 'Cualquiera'), c('SEX_FEMALE', 'Mujeres'), c('SEX_MALE', 'Hombres')],
    ageGroup: [c('AGE_ANY', 'Cualquiera'), c('AGE_ADULT', 'Adultos'), c('AGE_PEDIATRIC', 'Pediátrico'), c('AGE_NEONATAL', 'Neonatal')],
    bedCategory: [
      c('BED_CAT_PRIVATE', 'Privada'), c('BED_CAT_SHARED', 'Compartida'), c('BED_CAT_ICU', 'Terapia intensiva'),
      c('BED_CAT_INTERMEDIATE', 'Intermedia'), c('BED_CAT_NEONATAL', 'Neonatal'),
    ],
    unitRole: [c('SPACE_UNIT_ROLE_OWNER', 'Propietaria'), c('SPACE_UNIT_ROLE_SHARED', 'Compartida'), c('SPACE_UNIT_ROLE_LOAN', 'En préstamo')],
  },
  regulatory: {
    subsector: [
      c('SUBSECTOR_PUBLIC', 'Público'), c('SUBSECTOR_SOCIAL_SECURITY', 'Seguridad social de corto plazo'),
      c('SUBSECTOR_PRIVATE', 'Privado'), c('SUBSECTOR_PRIVATE_AGREEMENT', 'Privado en convenio'),
      c('SUBSECTOR_NGO_CHURCH', 'ONG / iglesia'),
    ],
    careLevel: [c('CARE_LEVEL_1', 'Primer nivel'), c('CARE_LEVEL_2', 'Segundo nivel'), c('CARE_LEVEL_3', 'Tercer nivel'), c('CARE_LEVEL_4', 'Cuarto nivel')],
    typology: [
      c('TYPOLOGY_HEALTH_POST', 'Puesto de Salud'), c('TYPOLOGY_HC_AMBULATORY', 'Centro de Salud ambulatorio'),
      c('TYPOLOGY_HC_INPATIENT', 'Centro de Salud con internación'), c('TYPOLOGY_HC_INTEGRAL', 'Centro de Salud integral'),
      c('TYPOLOGY_HOSPITAL_L2', 'Hospital de segundo nivel'), c('TYPOLOGY_HOSPITAL_L3', 'Hospital de tercer nivel'),
      c('TYPOLOGY_INSTITUTE_L4', 'Instituto de cuarto nivel'), c('TYPOLOGY_PRIVATE_CLINIC', 'Clínica privada'),
      c('TYPOLOGY_MEDICAL_OFFICE', 'Consultorio médico'), c('TYPOLOGY_DIAGNOSTIC_CENTER', 'Centro de diagnóstico'),
      c('TYPOLOGY_LABORATORY', 'Laboratorio'),
    ],
    sedes: [
      c('SEDES_LPZ', 'La Paz'), c('SEDES_CBB', 'Cochabamba'), c('SEDES_SCZ', 'Santa Cruz'), c('SEDES_ORU', 'Oruro'),
      c('SEDES_PTS', 'Potosí'), c('SEDES_CHQ', 'Chuquisaca'), c('SEDES_TJA', 'Tarija'), c('SEDES_BEN', 'Beni'), c('SEDES_PND', 'Pando'),
    ],
    licenseStatus: [
      c('LIC_IN_PROCESS', 'En trámite'), c('LIC_VALID', 'Vigente'), c('LIC_EXPIRED', 'Vencida'),
      c('LIC_SUSPENDED', 'Suspendida'), c('LIC_REVOKED', 'Revocada'),
    ],
    capacityKind: [
      c('CAP_BEDS_CENSABLE', 'Camas censables'), c('CAP_BEDS_NON_CENSABLE', 'Camas no censables'),
      c('CAP_CONSULTING_ROOMS', 'Consultorios'), c('CAP_OPERATING_ROOMS', 'Quirófanos'),
      c('CAP_DELIVERY_ROOMS', 'Salas de partos'), c('CAP_EMERGENCY_BAYS', 'Boxes de emergencia'), c('CAP_ICU_BEDS', 'Camas de terapia intensiva'),
    ],
  },
};

/* ---- establecimientos ---------------------------------------------------- */

export interface EstablecimientoSim {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  /** `'otro'` = existe, pero es de otro tenant: se responde 404 igual que si no existiera. */
  readonly tenant: 'propio' | 'otro';
}

export const SITIO_NORTE = { id: uuid('site-sanlucas-norte'), code: 'SANLUCAS-N', name: 'Hospital San Lucas · Anexo Norte' };
export const SITIO_OTRO_TENANT = uuid('site-otro-tenant');
export const ESPACIO_OTRO_TENANT = uuid('space-otro-tenant');

export const ESTABLECIMIENTOS: readonly EstablecimientoSim[] = [
  { ...SITIO_SANLUCAS, practiceId: PRACTICE_SANLUCAS, tenant: 'propio' },
  { ...SITIO_NORTE, practiceId: PRACTICE_SANLUCAS, tenant: 'propio' },
  { ...SITIO_OLIVOS, practiceId: PRACTICE_OLIVOS, tenant: 'propio' },
  { ...SITIO_CONSULTORIO, practiceId: PRACTICE_CONSULTORIO, tenant: 'propio' },
  { id: SITIO_OTRO_TENANT, practiceId: uuid('practice-otro'), code: 'OTRO', name: 'Centro de otra organización', tenant: 'otro' },
].map((s): EstablecimientoSim => ({ id: s.id, practiceId: s.practiceId, code: s.code, name: s.name, tenant: s.tenant as EstablecimientoSim['tenant'] }));

export interface RegulatorioSim {
  readonly id: string;
  snisCode: string | null;
  snisVerified: boolean;
  subsector: string | null;
  careLevel: string | null;
  typology: string | null;
  managingEntityName: string | null;
  healthNetworkName: string | null;
  sedes: string | null;
  municipalityName: string | null;
  rowVersion: number;
}

export const REGULATORIOS: readonly RegulatorioSim[] = [
  { id: SITIO_SANLUCAS.id, snisCode: 'DEMO-SNIS-0001', snisVerified: true, subsector: 'SUBSECTOR_PRIVATE', careLevel: 'CARE_LEVEL_3', typology: 'TYPOLOGY_HOSPITAL_L3', managingEntityName: 'Hospital San Lucas S.R.L.', healthNetworkName: 'Red Santa Cruz Norte', sedes: 'SEDES_SCZ', municipalityName: 'Santa Cruz de la Sierra', rowVersion: 3 },
  { id: SITIO_NORTE.id, snisCode: null, snisVerified: false, subsector: 'SUBSECTOR_PRIVATE', careLevel: 'CARE_LEVEL_1', typology: 'TYPOLOGY_HC_AMBULATORY', managingEntityName: 'Hospital San Lucas S.R.L.', healthNetworkName: 'Red Santa Cruz Norte', sedes: 'SEDES_SCZ', municipalityName: 'Warnes', rowVersion: 1 },
  { id: SITIO_OLIVOS.id, snisCode: 'DEMO-SNIS-0002', snisVerified: false, subsector: 'SUBSECTOR_PRIVATE', careLevel: 'CARE_LEVEL_2', typology: 'TYPOLOGY_PRIVATE_CLINIC', managingEntityName: 'Clínica Los Olivos S.A.', healthNetworkName: null, sedes: 'SEDES_SCZ', municipalityName: 'Santa Cruz de la Sierra', rowVersion: 2 },
  { id: SITIO_CONSULTORIO.id, snisCode: null, snisVerified: false, subsector: 'SUBSECTOR_PRIVATE', careLevel: 'CARE_LEVEL_1', typology: 'TYPOLOGY_MEDICAL_OFFICE', managingEntityName: null, healthNetworkName: null, sedes: 'SEDES_SCZ', municipalityName: 'Santa Cruz de la Sierra', rowVersion: 1 },
];

/* ---- espacios sembrados -------------------------------------------------- */

export interface EspacioSim {
  readonly id: string;
  readonly siteId: string;
  parentId: string | null;
  code: string;
  name: string;
  form: string;
  function: string;
  status: string;
  operational: string | null;
  clinicalUnitId: string | null;
  capacity: number | null;
  rowVersion: number;
  description: string | null;
  floorNumber: number | null;
  areaM2: number | null;
  asepsis: string | null;
  pressure: string | null;
  airChangesPerHour: number | null;
  hvacValidatedOn: string | null;
  sexRestriction: string | null;
  ageGroup: string | null;
  bedCategory: string | null;
  censable: boolean | null;
  prepMinutes: number | null;
  cleanupMinutes: number | null;
  gln: string | null;
  validFrom: string | null;
  validTo: string | null;
}

/** Unidades del hospital: los mismos ids que la consola (`practice.handlers.ts`). */
const unidad = (practica: string, code: string): string => uuid(`unit-${practica}-${code}`);

interface Semilla {
  readonly code: string;
  readonly name: string;
  readonly parent?: string;
  readonly form: string;
  readonly fn: string;
  readonly status?: string;
  readonly unit?: string;
  readonly id?: string;
  readonly extra?: Partial<EspacioSim>;
}

function sembrar(siteCode: string, siteId: string, lista: readonly Semilla[]): EspacioSim[] {
  const idDe = (code: string): string => lista.find((s) => s.code === code)?.id ?? uuid(`infra-${siteCode}-${code}`);
  return lista.map((s) => ({
    id: idDe(s.code),
    siteId,
    parentId: s.parent === undefined ? null : idDe(s.parent),
    code: s.code,
    name: s.name,
    form: `LOC_FORM_${s.form}`,
    function: `SPACE_FN_${s.fn}`,
    status: s.status ?? 'SPACE_ACTIVE',
    operational: s.status === undefined || s.status === 'SPACE_ACTIVE' ? 'SPACE_OP_AVAILABLE' : null,
    clinicalUnitId: s.unit ?? null,
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
    validFrom: isoDia(-700),
    validTo: s.status === 'SPACE_RETIRED' ? isoDia(-20) : null,
    ...s.extra,
  }));
}

const cama = (code: string, parent: string, extra: Partial<EspacioSim> = {}): Semilla => ({
  code,
  name: `Cama ${code}`,
  parent,
  form: 'BED',
  fn: 'BED_STANDARD',
  extra: { bedCategory: 'BED_CAT_PRIVATE', censable: true, capacity: 1, ...extra },
});

const SL = 'SANLUCAS';
export const Q1_ID = uuid('operating-room-1');
export const Q2_ID = uuid('operating-room-2');

const MEDINT = unidad(SL, 'MEDINT');
const URG = unidad(SL, 'URG');
const QX = unidad(SL, 'QX');
const GINE = unidad(SL, 'GINE');
const PEDIA = unidad(SL, 'PEDIA');
const CARDIO = unidad(SL, 'CARDIO');

const HVAC = { areaM2: 42, asepsis: 'ASEPSIS_RESTRICTED', pressure: 'PRESSURE_POSITIVE', airChangesPerHour: 20, hvacValidatedOn: isoDia(-120) } as const;

const SAN_LUCAS: readonly Semilla[] = [
  { code: 'ED-A', name: 'Edificio A · Hospitalización', form: 'BUILDING', fn: 'BUILDING_GENERIC' },
  { code: 'ED-A-P1', name: 'Piso 1 · Emergencias y consulta', parent: 'ED-A', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 1 } },
  { code: 'EMER-BOX-1', name: 'Box de emergencias 1', parent: 'ED-A-P1', form: 'ROOM', fn: 'EMERGENCY_BOX', unit: URG },
  { code: 'EMER-BOX-2', name: 'Box de emergencias 2', parent: 'ED-A-P1', form: 'ROOM', fn: 'EMERGENCY_BOX', unit: URG },
  { code: 'CONS-101', name: 'Consultorio 101', parent: 'ED-A-P1', form: 'ROOM', fn: 'CONSULTING_ROOM', unit: CARDIO, extra: { areaM2: 14 } },
  { code: 'CONS-102', name: 'Consultorio 102', parent: 'ED-A-P1', form: 'ROOM', fn: 'CONSULTING_ROOM', unit: PEDIA },
  { code: 'ED-A-P2', name: 'Piso 2 · Bloque quirúrgico', parent: 'ED-A', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 2 } },
  { code: 'QX-1', name: 'Quirófano 1', parent: 'ED-A-P2', form: 'ROOM', fn: 'OPERATING_ROOM', unit: QX, id: Q1_ID, extra: { ...HVAC, prepMinutes: 20, cleanupMinutes: 30 } },
  { code: 'QX-2', name: 'Quirófano 2', parent: 'ED-A-P2', form: 'ROOM', fn: 'OPERATING_ROOM', unit: QX, id: Q2_ID, extra: { ...HVAC, areaM2: 38, prepMinutes: 20, cleanupMinutes: 30 } },
  { code: 'QX-3', name: 'Quirófano 3 · en obra', parent: 'ED-A-P2', form: 'ROOM', fn: 'OPERATING_ROOM', unit: QX, status: 'SPACE_PLANNED' },
  { code: 'ED-A-P3', name: 'Piso 3 · Internación', parent: 'ED-A', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 3 } },
  { code: 'SALA-3B', name: 'Sala 3B · Medicina interna', parent: 'ED-A-P3', form: 'WARD', fn: 'WARD_GENERIC', unit: MEDINT },
  { code: 'HAB-301', name: 'Habitación 301', parent: 'SALA-3B', form: 'ROOM', fn: 'INPATIENT_ROOM', unit: MEDINT, extra: { areaM2: 18, sexRestriction: 'SEX_ANY', ageGroup: 'AGE_ADULT' } },
  cama('301-A', 'HAB-301'),
  cama('301-B', 'HAB-301'),
  { code: 'HAB-302', name: 'Habitación 302', parent: 'SALA-3B', form: 'ROOM', fn: 'INPATIENT_ROOM', unit: MEDINT, extra: { areaM2: 18 } },
  cama('302-A', 'HAB-302'),
  cama('302-B', 'HAB-302', { censable: false }),
  { code: 'HAB-399', name: 'Habitación 399 (clausurada)', parent: 'SALA-3B', form: 'ROOM', fn: 'INPATIENT_ROOM', status: 'SPACE_RETIRED' },
  // F2 — más camas para que el tablero de operación tenga qué mostrar: una habitación
  // compartida, dos locales de aislamiento aéreo (uno con la validación de climatización
  // vigente y otro con la validación vencida), pediatría y maternidad.
  { code: 'HAB-303', name: 'Habitación 303', parent: 'SALA-3B', form: 'ROOM', fn: 'INPATIENT_ROOM', unit: MEDINT, extra: { areaM2: 18 } },
  cama('303-A', 'HAB-303'),
  cama('303-B', 'HAB-303'),
  { code: 'AIS-1', name: 'Aislamiento aéreo 1', parent: 'SALA-3B', form: 'ROOM', fn: 'ISOLATION_AIIR', unit: MEDINT, extra: { areaM2: 20, asepsis: 'ASEPSIS_RESTRICTED', pressure: 'PRESSURE_NEGATIVE', airChangesPerHour: 14, hvacValidatedOn: isoDia(-40) } },
  cama('AIS-1A', 'AIS-1'),
  { code: 'AIS-2', name: 'Aislamiento aéreo 2', parent: 'SALA-3B', form: 'ROOM', fn: 'ISOLATION_AIIR', unit: MEDINT, extra: { areaM2: 20, asepsis: 'ASEPSIS_RESTRICTED', pressure: 'PRESSURE_NEGATIVE', airChangesPerHour: 14, hvacValidatedOn: isoDia(-400) } },
  cama('AIS-2A', 'AIS-2'),
  { code: 'SALA-3P', name: 'Sala 3P · Pediatría', parent: 'ED-A-P3', form: 'WARD', fn: 'WARD_GENERIC', unit: PEDIA },
  { code: 'HAB-311', name: 'Habitación 311', parent: 'SALA-3P', form: 'ROOM', fn: 'INPATIENT_ROOM', unit: PEDIA, extra: { areaM2: 16, ageGroup: 'AGE_PEDIATRIC' } },
  cama('311-A', 'HAB-311', { ageGroup: 'AGE_PEDIATRIC' }),
  cama('311-B', 'HAB-311', { ageGroup: 'AGE_PEDIATRIC' }),
  { code: 'HAB-312', name: 'Habitación 312', parent: 'SALA-3P', form: 'ROOM', fn: 'INPATIENT_ROOM', unit: PEDIA, extra: { areaM2: 12, ageGroup: 'AGE_PEDIATRIC' } },
  cama('312-A', 'HAB-312', { ageGroup: 'AGE_PEDIATRIC' }),
  { code: 'ED-A-P4', name: 'Piso 4 · Maternidad', parent: 'ED-A', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 4 } },
  { code: 'PARTO-1', name: 'Sala de partos 1', parent: 'ED-A-P4', form: 'ROOM', fn: 'DELIVERY_ROOM', unit: GINE, extra: { ...HVAC, areaM2: 30 } },
  { code: 'UTI', name: 'Terapia intensiva', parent: 'ED-A', form: 'AREA', fn: 'AREA_GENERIC', unit: MEDINT },
  { code: 'UTI-1', name: 'Cama UTI 1', parent: 'UTI', form: 'BED', fn: 'BED_ICU', extra: { bedCategory: 'BED_CAT_ICU', censable: true, capacity: 1 } },
  { code: 'UTI-2', name: 'Cama UTI 2', parent: 'UTI', form: 'BED', fn: 'BED_ICU', status: 'SPACE_SUSPENDED', extra: { bedCategory: 'BED_CAT_ICU', censable: true, capacity: 1 } },
  { code: 'UTI-3', name: 'Cama UTI 3', parent: 'UTI', form: 'BED', fn: 'BED_ICU', extra: { bedCategory: 'BED_CAT_ICU', censable: true, capacity: 1 } },
  { code: 'UTI-4', name: 'Cama UTI 4', parent: 'UTI', form: 'BED', fn: 'BED_ICU', extra: { bedCategory: 'BED_CAT_ICU', censable: true, capacity: 1 } },
  { code: 'HAB-401', name: 'Habitación 401', parent: 'ED-A-P4', form: 'ROOM', fn: 'INPATIENT_ROOM', unit: GINE, extra: { areaM2: 18, sexRestriction: 'SEX_FEMALE' } },
  cama('401-A', 'HAB-401'),
  cama('401-B', 'HAB-401'),
  { code: 'ED-B', name: 'Edificio B · Consultorios externos', form: 'BUILDING', fn: 'BUILDING_GENERIC' },
  { code: 'ED-B-P1', name: 'Planta baja', parent: 'ED-B', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 0 } },
  { code: 'CONS-B01', name: 'Consultorio B01', parent: 'ED-B-P1', form: 'ROOM', fn: 'CONSULTING_ROOM', unit: CARDIO },
  { code: 'IMG-1', name: 'Sala de tomografía', parent: 'ED-B-P1', form: 'ROOM', fn: 'IMAGING_ROOM', extra: { areaM2: 36 } },
];

const NORTE: readonly Semilla[] = [
  { code: 'N-ED', name: 'Edificio Norte', form: 'BUILDING', fn: 'BUILDING_GENERIC' },
  { code: 'N-C1', name: 'Consultorio Norte 1', parent: 'N-ED', form: 'ROOM', fn: 'CONSULTING_ROOM' },
  { code: 'N-C2', name: 'Consultorio Norte 2', parent: 'N-ED', form: 'ROOM', fn: 'CONSULTING_ROOM' },
  { code: 'N-MUE', name: 'Toma de muestras', parent: 'N-ED', form: 'ROOM', fn: 'SAMPLE_COLLECTION' },
];

const OLIVOS: readonly Semilla[] = [
  { code: 'OL-ED', name: 'Edificio principal', form: 'BUILDING', fn: 'BUILDING_GENERIC' },
  { code: 'OL-P1', name: 'Planta baja', parent: 'OL-ED', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 0 } },
  { code: 'OL-C1', name: 'Consultorio 1', parent: 'OL-P1', form: 'ROOM', fn: 'CONSULTING_ROOM', unit: unidad('OLIVOS', 'CARDIO') },
  { code: 'OL-C2', name: 'Consultorio 2', parent: 'OL-P1', form: 'ROOM', fn: 'CONSULTING_ROOM', unit: unidad('OLIVOS', 'MEDINT') },
  { code: 'OL-C3', name: 'Consultorio 3', parent: 'OL-P1', form: 'ROOM', fn: 'CONSULTING_ROOM', unit: unidad('OLIVOS', 'PEDIA') },
  { code: 'OL-P2', name: 'Primer piso', parent: 'OL-ED', form: 'LEVEL', fn: 'LEVEL_GENERIC', extra: { floorNumber: 1 } },
  { code: 'OL-PROC', name: 'Sala de procedimientos', parent: 'OL-P2', form: 'ROOM', fn: 'PROCEDURE_ROOM' },
];

/** El consultorio de la Dra. Rojas arranca **sin** estructura: es el estado S3. */
export const ESPACIOS_SEMILLA: readonly EspacioSim[] = [
  ...sembrar('sanlucas', SITIO_SANLUCAS.id, SAN_LUCAS),
  ...sembrar('norte', SITIO_NORTE.id, NORTE),
  ...sembrar('olivos', SITIO_OLIVOS.id, OLIVOS),
];

/** Unidades por establecimiento, con los ids de la consola de organización. */
export const UNIDADES_SEMILLA: readonly { id: string; siteId: string; parentId: null; code: string; name: string; status: string; rowVersion: number }[] = [
  ...['CARDIO:Cardiología', 'MEDINT:Medicina interna', 'PEDIA:Pediatría', 'URG:Urgencias', 'QX:Quirófanos', 'GINE:Maternidad'].map((x) => {
    const [code, name] = x.split(':');
    return { id: unidad(SL, code), siteId: SITIO_SANLUCAS.id, parentId: null, code, name, status: 'UNIT_ACTIVE', rowVersion: 1 };
  }),
  ...['CARDIO:Cardiología', 'MEDINT:Medicina interna', 'PEDIA:Pediatría'].map((x) => {
    const [code, name] = x.split(':');
    return { id: unidad('OLIVOS', code), siteId: SITIO_OLIVOS.id, parentId: null as null, code, name, status: 'UNIT_ACTIVE', rowVersion: 1 };
  }),
];

/**
 * Lo que bloquea una clausura y vive en **otros módulos** (cirugías, internación):
 * el simulador no los modela, los fija por espacio. Los ids de cirugía son los de
 * `procedures.handlers.ts` (`surgical-case-4/5/6`), que están programados a futuro
 * o en curso en el quirófano 1 y 2.
 */
export const BLOQUEOS_EXTERNOS: Readonly<Record<string, readonly RetireBlocker[]>> = {
  [Q1_ID]: [
    { kind: 'FUTURE_PROCEDURE', count: 2, sampleIds: [uuid('surgical-case-4'), uuid('surgical-case-6')], nextAction: 'Reprogramar o cancelar las cirugías del quirófano en Intervenciones.' },
  ],
  [Q2_ID]: [
    { kind: 'FUTURE_PROCEDURE', count: 1, sampleIds: [uuid('surgical-case-5')], nextAction: 'Reprogramar o cancelar la cirugía del quirófano en Intervenciones.' },
  ],
  [uuid('infra-sanlucas-301-B')]: [
    { kind: 'ACTIVE_ENCOUNTER', count: 1, sampleIds: [uuid('encounter-301-B')], nextAction: 'Trasladar al paciente o registrar su egreso en Internación.' },
  ],
};

/* ---- habilitaciones y capacidad declarada -------------------------------- */

export interface HabilitacionSim {
  readonly id: string;
  readonly siteId: string;
  authorityName: string;
  resolutionNumber: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  /** Lo guardado; «vencida» se calcula al leer, no se guarda. */
  statusCode: string;
  clinicalUnitId: string | null;
  notes: string | null;
  rowVersion: number;
}

export const HABILITACIONES_SEMILLA: readonly HabilitacionSim[] = [
  { id: uuid('lic-sl-1'), siteId: SITIO_SANLUCAS.id, authorityName: 'SEDES Santa Cruz', resolutionNumber: 'RA-0457/2025', issuedOn: isoDia(-400), expiresOn: isoDia(330), statusCode: 'LIC_VALID', clinicalUnitId: null, notes: 'Habilitación del establecimiento.', rowVersion: 1 },
  { id: uuid('lic-sl-2'), siteId: SITIO_SANLUCAS.id, authorityName: 'SEDES Santa Cruz', resolutionNumber: 'RA-0112/2024', issuedOn: isoDia(-900), expiresOn: isoDia(-1), statusCode: 'LIC_VALID', clinicalUnitId: unidad(SL, 'QX'), notes: 'Bloque quirúrgico: venció ayer; se guardó como vigente.', rowVersion: 2 },
  { id: uuid('lic-sl-3'), siteId: SITIO_SANLUCAS.id, authorityName: 'CODELAB', resolutionNumber: null, issuedOn: null, expiresOn: null, statusCode: 'LIC_IN_PROCESS', clinicalUnitId: null, notes: 'Laboratorio: trámite iniciado.', rowVersion: 1 },
  { id: uuid('lic-ol-1'), siteId: SITIO_OLIVOS.id, authorityName: 'SEDES Santa Cruz', resolutionNumber: 'RA-0091/2025', issuedOn: isoDia(-200), expiresOn: isoDia(165), statusCode: 'LIC_VALID', clinicalUnitId: null, notes: null, rowVersion: 1 },
];

export interface CapacidadDeclaradaSim {
  readonly id: string;
  readonly siteId: string;
  readonly kindCode: string;
  readonly quantity: number;
  readonly asOf: string;
  readonly resolutionNumber: string | null;
}

export const CAPACIDADES_SEMILLA: readonly CapacidadDeclaradaSim[] = [
  { id: uuid('cap-sl-1'), siteId: SITIO_SANLUCAS.id, kindCode: 'CAP_BEDS_CENSABLE', quantity: 10, asOf: isoDia(-300), resolutionNumber: 'RA-0457/2025' },
  { id: uuid('cap-sl-2'), siteId: SITIO_SANLUCAS.id, kindCode: 'CAP_OPERATING_ROOMS', quantity: 2, asOf: isoDia(-300), resolutionNumber: 'RA-0457/2025' },
  { id: uuid('cap-sl-3'), siteId: SITIO_SANLUCAS.id, kindCode: 'CAP_EMERGENCY_BAYS', quantity: 2, asOf: isoDia(-300), resolutionNumber: 'RA-0457/2025' },
  { id: uuid('cap-ol-1'), siteId: SITIO_OLIVOS.id, kindCode: 'CAP_CONSULTING_ROOMS', quantity: 4, asOf: isoDia(-100), resolutionNumber: null },
];
