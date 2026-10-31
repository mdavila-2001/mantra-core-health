import type {
  FunctionProfile,
  InfraConcept,
  InfrastructureCatalog,
  ParentRule,
  TypologyRule,
} from '../../data-access/infrastructure/infrastructure.types';
import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS, PRACTICE_SANLUCAS, SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from './agenda';
import { TENANT_CLINICA, TENANT_CONSULTORIO, TENANT_HOSPITAL } from '../mock-session';
import { uuid } from '../mock-store';

/* ============================================================================
    Infraestructura hospitalaria simulada — franja F1.

    El catálogo replica §2 de `CONTRATO-F0-F1.md` (formas FHIR, funciones con
    su perfil, reglas padre→hijo, tipologías bolivianas). El sembrado es un
    hospital de segundo nivel de Santa Cruz —Hospital San Lucas— armado como lo
    pidió el plan: Edificio A > Pabellón Norte > Piso 3 > Sala de internación >
    Habitación 301 > Camas, bloque quirúrgico, imagenología, laboratorio,
    emergencias, farmacia y depósito.

    **Nada de lo que se cuenta está escrito a mano**: camas, recuentos y
    capacidad real se derivan de estas filas en los manejadores.
    ========================================================================== */

const c = (code: string, display: string): InfraConcept => ({ code, display });

export const FORMAS: readonly InfraConcept[] = [
  c('LOC_FORM_SITE', 'Establecimiento'),
  c('LOC_FORM_BUILDING', 'Edificio'),
  c('LOC_FORM_WING', 'Pabellón / ala'),
  c('LOC_FORM_LEVEL', 'Piso'),
  c('LOC_FORM_WARD', 'Sala de internación'),
  c('LOC_FORM_AREA', 'Área'),
  c('LOC_FORM_CORRIDOR', 'Pasillo'),
  c('LOC_FORM_ROOM', 'Local'),
  c('LOC_FORM_BED', 'Cama / puesto'),
  c('LOC_FORM_VIRTUAL', 'Virtual'),
];

type Bandera =
  | 'schedulable' | 'inpatient' | 'billable' | 'allowOverlap' | 'isolationCapable'
  | 'stockPoint' | 'hostsEquipment' | 'requiresTerminalCleaning' | 'requiresArea' | 'requiresHvac';

function fn(code: string, display: string, forms: readonly string[], banderas: readonly Bandera[] = []): FunctionProfile {
  const tiene = (b: Bandera) => banderas.includes(b);
  return {
    code: `SPACE_FN_${code}`,
    display,
    forms: forms.map((f) => `LOC_FORM_${f}`),
    schedulable: tiene('schedulable'),
    inpatient: tiene('inpatient'),
    billable: tiene('billable'),
    allowOverlap: tiene('allowOverlap'),
    isolationCapable: tiene('isolationCapable'),
    stockPoint: tiene('stockPoint'),
    hostsEquipment: tiene('hostsEquipment'),
    requiresTerminalCleaning: tiene('requiresTerminalCleaning'),
    requiresArea: tiene('requiresArea'),
    requiresHvac: tiene('requiresHvac'),
  };
}

export const FUNCIONES: readonly FunctionProfile[] = [
  fn('CONSULTING_ROOM', 'Consultorio', ['ROOM'], ['schedulable', 'billable', 'requiresArea']),
  fn('INPATIENT_ROOM', 'Habitación de internación', ['ROOM'], ['inpatient', 'requiresArea']),
  fn('OPERATING_ROOM', 'Quirófano', ['ROOM'], ['schedulable', 'billable', 'hostsEquipment', 'requiresTerminalCleaning', 'requiresArea', 'requiresHvac']),
  fn('PROCEDURE_ROOM', 'Sala de procedimientos', ['ROOM'], ['schedulable', 'billable', 'requiresArea', 'requiresHvac']),
  fn('DELIVERY_ROOM', 'Sala de partos', ['ROOM'], ['schedulable', 'inpatient', 'billable', 'requiresTerminalCleaning', 'requiresArea', 'requiresHvac']),
  fn('RECOVERY_PACU', 'Recuperación posanestésica', ['ROOM', 'AREA'], ['requiresArea']),
  fn('ICU_BAY', 'Unidad de terapia intensiva', ['ROOM', 'AREA'], ['inpatient', 'requiresTerminalCleaning', 'requiresArea', 'requiresHvac']),
  fn('EMERGENCY_BOX', 'Box de emergencias', ['ROOM'], ['billable', 'requiresArea']),
  fn('OBSERVATION', 'Observación', ['ROOM', 'AREA'], ['requiresArea']),
  fn('ISOLATION_AIIR', 'Aislamiento respiratorio (AIIR)', ['ROOM'], ['inpatient', 'isolationCapable', 'requiresTerminalCleaning', 'requiresArea', 'requiresHvac']),
  fn('PROTECTIVE_ENV', 'Ambiente protector', ['ROOM'], ['inpatient', 'isolationCapable', 'requiresTerminalCleaning', 'requiresArea', 'requiresHvac']),
  fn('IMAGING_ROOM', 'Sala de imagenología', ['ROOM'], ['schedulable', 'billable', 'hostsEquipment', 'requiresArea']),
  fn('SAMPLE_COLLECTION', 'Toma de muestras', ['ROOM', 'AREA'], ['schedulable', 'requiresArea']),
  fn('LAB_AREA', 'Área analítica de laboratorio', ['ROOM', 'AREA'], ['hostsEquipment', 'requiresArea']),
  fn('PHARMACY', 'Farmacia', ['ROOM', 'AREA'], ['stockPoint', 'requiresArea']),
  fn('STORAGE', 'Depósito / botiquín', ['ROOM', 'AREA'], ['stockPoint']),
  fn('STERILIZATION', 'Central de esterilización', ['ROOM'], ['hostsEquipment', 'requiresArea', 'requiresHvac']),
  fn('WAITING', 'Sala de espera', ['ROOM', 'AREA', 'CORRIDOR']),
  fn('NURSE_STATION', 'Estación de enfermería', ['ROOM', 'AREA'], ['stockPoint']),
  fn('OFFICE_ADMIN', 'Oficina administrativa', ['ROOM']),
  fn('BED_STANDARD', 'Cama de internación', ['BED'], ['inpatient', 'billable', 'requiresTerminalCleaning']),
  fn('BED_ICU', 'Cama de terapia intensiva', ['BED'], ['inpatient', 'billable', 'requiresTerminalCleaning']),
  fn('CRIB', 'Cuna', ['BED'], ['inpatient', 'billable']),
  fn('STRETCHER', 'Camilla / puesto', ['BED']),
  fn('BUILDING_GENERIC', 'Edificio', ['BUILDING']),
  fn('WING_GENERIC', 'Pabellón', ['WING']),
  fn('LEVEL_GENERIC', 'Piso', ['LEVEL']),
  fn('WARD_GENERIC', 'Sala de internación', ['WARD']),
  fn('AREA_GENERIC', 'Área de servicio', ['AREA']),
  fn('GENERIC', 'Espacio genérico', ['ROOM', 'CORRIDOR', 'VIRTUAL']),
];

/** §2 «Reglas padre→hijo». `null` es la raíz del establecimiento. */
const REGLAS: Readonly<Record<string, readonly string[]>> = {
  SITE: ['BUILDING', 'AREA'],
  BUILDING: ['WING', 'LEVEL', 'AREA', 'ROOM'],
  WING: ['LEVEL', 'WARD', 'AREA', 'ROOM'],
  LEVEL: ['WARD', 'AREA', 'ROOM', 'CORRIDOR'],
  WARD: ['ROOM', 'BED'],
  AREA: ['ROOM', 'BED', 'AREA'],
  ROOM: ['BED'],
  CORRIDOR: ['ROOM'],
  '': ['BUILDING', 'AREA', 'ROOM', 'VIRTUAL'],
};

export const REGLAS_PADRE_HIJO: readonly ParentRule[] = Object.entries(REGLAS).flatMap(([padre, hijos]) =>
  hijos.map((h) => ({ parent: padre === '' ? null : `LOC_FORM_${padre}`, child: `LOC_FORM_${h}` })),
);

/*
 * Reglas de tipología: listas blancas (`TYPO_ALLOWED`) para lo que restringe y
 * obligatorias (`TYPO_REQUIRED`) para lo que exige. Norma de origen: normas de
 * caracterización de 1.º y 2.º nivel del Ministerio de Salud (umbral
 * configurable hasta verificar el texto oficial; ver PLAN §7).
 */
const PROHIBIDAS_PUESTO = new Set(['SPACE_FN_OPERATING_ROOM', 'SPACE_FN_ICU_BAY', 'SPACE_FN_INPATIENT_ROOM', 'SPACE_FN_BED_STANDARD', 'SPACE_FN_BED_ICU', 'SPACE_FN_CRIB']);
const PROHIBIDAS_AMBULATORIO = new Set(['SPACE_FN_INPATIENT_ROOM', 'SPACE_FN_BED_STANDARD', 'SPACE_FN_BED_ICU', 'SPACE_FN_CRIB', 'SPACE_FN_OPERATING_ROOM']);

export const REGLAS_DE_TIPOLOGIA: readonly TypologyRule[] = [
  ...FUNCIONES.filter((f) => !PROHIBIDAS_PUESTO.has(f.code)).map((f) => ({ typology: 'TYPOLOGY_HEALTH_POST', function: f.code, rule: 'TYPO_ALLOWED' })),
  ...FUNCIONES.filter((f) => !PROHIBIDAS_AMBULATORIO.has(f.code)).map((f) => ({ typology: 'TYPOLOGY_HC_AMBULATORY', function: f.code, rule: 'TYPO_ALLOWED' })),
  ...['TYPOLOGY_HOSPITAL_L2', 'TYPOLOGY_HOSPITAL_L3'].flatMap((t) =>
    ['SPACE_FN_EMERGENCY_BOX', 'SPACE_FN_INPATIENT_ROOM', 'SPACE_FN_OPERATING_ROOM'].map((f) => ({ typology: t, function: f, rule: 'TYPO_REQUIRED' })),
  ),
];

export const CICLO_DE_VIDA: readonly InfraConcept[] = [
  c('SPACE_PLANNED', 'Planificado'),
  c('SPACE_ACTIVE', 'Activo'),
  c('SPACE_SUSPENDED', 'Suspendido'),
  c('SPACE_RETIRED', 'Retirado'),
];

export const CICLO_DE_UNIDAD: readonly InfraConcept[] = [
  c('UNIT_PLANNED', 'Planificada'),
  c('UNIT_ACTIVE', 'Activa'),
  c('UNIT_SUSPENDED', 'Suspendida'),
  c('UNIT_RETIRED', 'Retirada'),
];

export const DISPONIBILIDAD: readonly InfraConcept[] = [
  c('SPACE_OP_AVAILABLE', 'Disponible'),
  c('SPACE_OP_MAINTENANCE', 'En mantenimiento'),
  c('SPACE_OP_CLOSED', 'Cerrado'),
];

export const CATALOGO_INFRAESTRUCTURA: InfrastructureCatalog = {
  forms: FORMAS,
  functions: FUNCIONES,
  parentRules: REGLAS_PADRE_HIJO,
  typologyRules: REGLAS_DE_TIPOLOGIA,
  lifecycle: CICLO_DE_VIDA,
  attributes: {
    asepsis: [c('ASEPSIS_UNRESTRICTED', 'Zona no restringida'), c('ASEPSIS_SEMI', 'Zona semirrestringida'), c('ASEPSIS_RESTRICTED', 'Zona restringida')],
    pressure: [c('PRESSURE_NEUTRAL', 'Neutra'), c('PRESSURE_POSITIVE', 'Positiva'), c('PRESSURE_NEGATIVE', 'Negativa')],
    sex: [c('SEX_ANY', 'Sin restricción'), c('SEX_FEMALE', 'Sólo mujeres'), c('SEX_MALE', 'Sólo varones')],
    ageGroup: [c('AGE_ANY', 'Todas las edades'), c('AGE_ADULT', 'Adultos'), c('AGE_PEDIATRIC', 'Pediatría'), c('AGE_NEONATAL', 'Neonatología')],
    bedCategory: [c('BED_CAT_PRIVATE', 'Privada'), c('BED_CAT_SHARED', 'Compartida'), c('BED_CAT_ICU', 'Terapia intensiva'), c('BED_CAT_INTERMEDIATE', 'Cuidados intermedios'), c('BED_CAT_NEONATAL', 'Neonatal')],
    unitRole: [c('SPACE_UNIT_ROLE_OWNER', 'Propietaria'), c('SPACE_UNIT_ROLE_SHARED', 'Compartida'), c('SPACE_UNIT_ROLE_LOAN', 'En préstamo')],
  },
  regulatory: {
    subsector: [c('SUBSECTOR_PUBLIC', 'Público'), c('SUBSECTOR_SOCIAL_SECURITY', 'Seguridad social'), c('SUBSECTOR_PRIVATE', 'Privado'), c('SUBSECTOR_PRIVATE_AGREEMENT', 'Privado con convenio'), c('SUBSECTOR_NGO_CHURCH', 'ONG / Iglesia')],
    careLevel: [c('CARE_LEVEL_1', 'Primer nivel'), c('CARE_LEVEL_2', 'Segundo nivel'), c('CARE_LEVEL_3', 'Tercer nivel'), c('CARE_LEVEL_4', 'Cuarto nivel')],
    typology: [
      c('TYPOLOGY_HEALTH_POST', 'Puesto de Salud'),
      c('TYPOLOGY_HC_AMBULATORY', 'Centro de Salud ambulatorio'),
      c('TYPOLOGY_HC_INPATIENT', 'Centro de Salud con internación'),
      c('TYPOLOGY_HC_INTEGRAL', 'Centro de Salud integral'),
      c('TYPOLOGY_HOSPITAL_L2', 'Hospital de segundo nivel'),
      c('TYPOLOGY_HOSPITAL_L3', 'Hospital de tercer nivel'),
      c('TYPOLOGY_INSTITUTE_L4', 'Instituto de cuarto nivel'),
      c('TYPOLOGY_PRIVATE_CLINIC', 'Clínica privada'),
      c('TYPOLOGY_MEDICAL_OFFICE', 'Consultorio médico'),
      c('TYPOLOGY_DIAGNOSTIC_CENTER', 'Centro de diagnóstico'),
      c('TYPOLOGY_LABORATORY', 'Laboratorio'),
    ],
    sedes: [c('SEDES_LPZ', 'SEDES La Paz'), c('SEDES_CBB', 'SEDES Cochabamba'), c('SEDES_SCZ', 'SEDES Santa Cruz'), c('SEDES_ORU', 'SEDES Oruro'), c('SEDES_PTS', 'SEDES Potosí'), c('SEDES_CHQ', 'SEDES Chuquisaca'), c('SEDES_TJA', 'SEDES Tarija'), c('SEDES_BEN', 'SEDES Beni'), c('SEDES_PND', 'SEDES Pando')],
    licenseStatus: [c('LIC_IN_PROCESS', 'En trámite'), c('LIC_VALID', 'Vigente'), c('LIC_EXPIRED', 'Vencida'), c('LIC_SUSPENDED', 'Suspendida'), c('LIC_REVOKED', 'Revocada')],
    capacityKind: [
      c('CAP_BEDS_CENSABLE', 'Camas censables'),
      c('CAP_BEDS_NON_CENSABLE', 'Camas no censables'),
      c('CAP_CONSULTING_ROOMS', 'Consultorios'),
      c('CAP_OPERATING_ROOMS', 'Quirófanos'),
      c('CAP_DELIVERY_ROOMS', 'Salas de partos'),
      c('CAP_EMERGENCY_BAYS', 'Boxes de emergencia'),
      c('CAP_ICU_BEDS', 'Camas de terapia intensiva'),
    ],
  },
};

/** Cómo se **cuenta** cada capacidad real. Dato, no `if` (§2). */
export const CONTEO_DE_CAPACIDAD: Readonly<Record<string, { readonly funciones: readonly string[]; readonly censable?: boolean }>> = {
  CAP_BEDS_CENSABLE: { funciones: ['SPACE_FN_BED_STANDARD', 'SPACE_FN_BED_ICU', 'SPACE_FN_CRIB'], censable: true },
  CAP_BEDS_NON_CENSABLE: { funciones: ['SPACE_FN_BED_STANDARD', 'SPACE_FN_BED_ICU', 'SPACE_FN_CRIB', 'SPACE_FN_STRETCHER'], censable: false },
  CAP_CONSULTING_ROOMS: { funciones: ['SPACE_FN_CONSULTING_ROOM'] },
  CAP_OPERATING_ROOMS: { funciones: ['SPACE_FN_OPERATING_ROOM'] },
  CAP_DELIVERY_ROOMS: { funciones: ['SPACE_FN_DELIVERY_ROOM'] },
  CAP_EMERGENCY_BAYS: { funciones: ['SPACE_FN_EMERGENCY_BOX'] },
  CAP_ICU_BEDS: { funciones: ['SPACE_FN_BED_ICU'] },
};

/** El display de cualquier código del catálogo. */
const TODOS: ReadonlyMap<string, string> = new Map(
  [
    ...FORMAS, ...FUNCIONES, ...CICLO_DE_VIDA, ...CICLO_DE_UNIDAD, ...DISPONIBILIDAD,
    ...Object.values(CATALOGO_INFRAESTRUCTURA.attributes).flat(),
    ...Object.values(CATALOGO_INFRAESTRUCTURA.regulatory).flat(),
    c('UNIT_TYPE_DIRECTION', 'Dirección'), c('UNIT_TYPE_DEPARTMENT', 'Departamento'), c('UNIT_TYPE_SERVICE', 'Servicio'),
  ].map((k) => [k.code, k.display]),
);

export function conceptoDe(code: string): InfraConcept;
export function conceptoDe(code: string | null | undefined): InfraConcept | null;
export function conceptoDe(code: string | null | undefined): InfraConcept | null {
  if (code === null || code === undefined || code === '') return null;
  return { code, display: TODOS.get(code) ?? code };
}

export function existeCodigo(code: string, familia: readonly InfraConcept[]): boolean {
  return familia.some((k) => k.code === code);
}

/* ---- establecimientos ------------------------------------------------------ */

export interface SitioSimulado {
  readonly id: string;
  readonly practiceId: string;
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly code: string;
  readonly name: string;
  readonly timeZone: string;
  readonly snisCode: string | null;
  readonly subsectorCode: string | null;
  readonly careLevelCode: string | null;
  readonly typologyCode: string | null;
  readonly managingEntityName: string | null;
  readonly healthNetworkName: string | null;
  readonly sedesCode: string | null;
  readonly municipalityName: string | null;
  readonly rowVersion: number;
}

export const SITIO_SANLUCAS_NORTE = { id: uuid('site-sanlucas-norte'), code: 'SANLUCAS-N', name: 'Hospital San Lucas · Anexo Norte' };

export const SITIOS_INFRA: readonly SitioSimulado[] = [
  {
    id: SITIO_SANLUCAS.id, practiceId: PRACTICE_SANLUCAS, tenantId: TENANT_HOSPITAL, branchId: uuid('branch-sanlucas-central'),
    code: SITIO_SANLUCAS.code, name: SITIO_SANLUCAS.name, timeZone: 'America/La_Paz',
    snisCode: '701010123', subsectorCode: 'SUBSECTOR_PRIVATE', careLevelCode: 'CARE_LEVEL_2', typologyCode: 'TYPOLOGY_HOSPITAL_L2',
    managingEntityName: 'Hospital San Lucas S.R.L.', healthNetworkName: 'Red de Salud Norte Integrada', sedesCode: 'SEDES_SCZ',
    municipalityName: 'Santa Cruz de la Sierra', rowVersion: 1,
  },
  {
    id: SITIO_SANLUCAS_NORTE.id, practiceId: PRACTICE_SANLUCAS, tenantId: TENANT_HOSPITAL, branchId: uuid('branch-sanlucas-norte'),
    code: SITIO_SANLUCAS_NORTE.code, name: SITIO_SANLUCAS_NORTE.name, timeZone: 'America/La_Paz',
    snisCode: null, subsectorCode: 'SUBSECTOR_PRIVATE', careLevelCode: 'CARE_LEVEL_1', typologyCode: 'TYPOLOGY_HC_AMBULATORY',
    managingEntityName: 'Hospital San Lucas S.R.L.', healthNetworkName: 'Red de Salud Norte Integrada', sedesCode: 'SEDES_SCZ',
    municipalityName: 'Santa Cruz de la Sierra', rowVersion: 1,
  },
  {
    id: SITIO_OLIVOS.id, practiceId: PRACTICE_OLIVOS, tenantId: TENANT_CLINICA, branchId: uuid('branch-olivos-central'),
    code: SITIO_OLIVOS.code, name: SITIO_OLIVOS.name, timeZone: 'America/La_Paz',
    snisCode: '701020456', subsectorCode: 'SUBSECTOR_PRIVATE', careLevelCode: 'CARE_LEVEL_1', typologyCode: 'TYPOLOGY_PRIVATE_CLINIC',
    managingEntityName: 'Clínica Los Olivos S.A.', healthNetworkName: null, sedesCode: 'SEDES_SCZ',
    municipalityName: 'Santa Cruz de la Sierra', rowVersion: 1,
  },
  {
    id: SITIO_CONSULTORIO.id, practiceId: PRACTICE_CONSULTORIO, tenantId: TENANT_CONSULTORIO, branchId: null,
    code: SITIO_CONSULTORIO.code, name: SITIO_CONSULTORIO.name, timeZone: 'America/La_Paz',
    snisCode: null, subsectorCode: 'SUBSECTOR_PRIVATE', careLevelCode: 'CARE_LEVEL_1', typologyCode: 'TYPOLOGY_MEDICAL_OFFICE',
    managingEntityName: null, healthNetworkName: null, sedesCode: 'SEDES_SCZ', municipalityName: 'Santa Cruz de la Sierra', rowVersion: 1,
  },
];

/* ---- espacios -------------------------------------------------------------- */

export interface EspacioSimulado {
  readonly id: string;
  readonly siteId: string;
  readonly tenantId: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly formCode: string;
  readonly functionCode: string;
  readonly statusCode: string;
  readonly operationalStatusCode: string | null;
  readonly clinicalUnitId: string | null;
  readonly capacity: number | null;
  readonly description: string | null;
  readonly floorNumber: number | null;
  readonly areaM2: number | null;
  readonly asepsisCode: string | null;
  readonly pressureCode: string | null;
  readonly airChangesPerHour: number | null;
  readonly hvacValidatedOn: string | null;
  readonly sexRestrictionCode: string | null;
  readonly ageGroupCode: string | null;
  readonly bedCategoryCode: string | null;
  readonly censable: boolean | null;
  readonly prepMinutes: number | null;
  readonly cleanupMinutes: number | null;
  readonly gln: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rowVersion: number;
  /** Simulación de lo que en la API viene de otros módulos (bloqueos de retiro). */
  readonly occupied?: boolean;
  readonly equipment?: number;
  readonly stock?: boolean;
  readonly schedulableResource?: boolean;
  readonly futureBookings?: number;
}

/** Los ids de quirófano que ya usa `procedures.handlers.ts` (`QUIROFANO`). */
export const QUIROFANO_1 = uuid('operating-room-1');
export const QUIROFANO_2 = uuid('operating-room-2');

const ID_FIJO: Readonly<Record<string, string>> = { 'SANLUCAS:QX-01': QUIROFANO_1, 'SANLUCAS:QX-02': QUIROFANO_2 };

export function idDeEspacio(sitio: { readonly code: string }, code: string): string {
  return ID_FIJO[`${sitio.code}:${code}`] ?? uuid(`space-${sitio.code}-${code}`);
}

export function idDeUnidad(sitio: { readonly code: string }, code: string): string {
  return uuid(`unit-${sitio.code}-${code}`);
}

type Semilla = readonly [code: string, name: string, form: string, fn: string, parent: string | null, extra?: Partial<EspacioSimulado> & { unit?: string }];

const SEMILLA_SANLUCAS: readonly Semilla[] = [
  ['BLD-A', 'Edificio A', 'BUILDING', 'BUILDING_GENERIC', null],
  ['A-PN', 'Pabellón Norte', 'WING', 'WING_GENERIC', 'BLD-A'],
  ['A-PN-P3', 'Piso 3', 'LEVEL', 'LEVEL_GENERIC', 'A-PN', { floorNumber: 3 }],
  ['A-PN-P3-SI', 'Sala de internación de medicina interna', 'WARD', 'WARD_GENERIC', 'A-PN-P3', { unit: 'MEDINT', floorNumber: 3 }],
  ['301', 'Habitación 301', 'ROOM', 'INPATIENT_ROOM', 'A-PN-P3-SI', { unit: 'MEDINT', capacity: 2, areaM2: 18.5, floorNumber: 3, sexRestrictionCode: 'SEX_ANY', ageGroupCode: 'AGE_ADULT' }],
  ['301-A', 'Cama 301-A', 'BED', 'BED_STANDARD', '301', { unit: 'MEDINT', bedCategoryCode: 'BED_CAT_SHARED', censable: true, occupied: true }],
  ['301-B', 'Cama 301-B', 'BED', 'BED_STANDARD', '301', { unit: 'MEDINT', bedCategoryCode: 'BED_CAT_SHARED', censable: true }],
  ['302', 'Habitación 302', 'ROOM', 'INPATIENT_ROOM', 'A-PN-P3-SI', { unit: 'MEDINT', capacity: 2, areaM2: 18.5, floorNumber: 3, sexRestrictionCode: 'SEX_FEMALE', ageGroupCode: 'AGE_ADULT' }],
  ['302-A', 'Cama 302-A', 'BED', 'BED_STANDARD', '302', { unit: 'MEDINT', bedCategoryCode: 'BED_CAT_SHARED', censable: true }],
  ['302-B', 'Cama 302-B', 'BED', 'BED_STANDARD', '302', { unit: 'MEDINT', bedCategoryCode: 'BED_CAT_SHARED', censable: true, statusCode: 'SPACE_SUSPENDED', operationalStatusCode: 'SPACE_OP_MAINTENANCE' }],
  ['303', 'Aislamiento 303', 'ROOM', 'ISOLATION_AIIR', 'A-PN-P3-SI', { unit: 'MEDINT', capacity: 1, areaM2: 16, floorNumber: 3, asepsisCode: 'ASEPSIS_SEMI', pressureCode: 'PRESSURE_NEGATIVE', airChangesPerHour: 12, hvacValidatedOn: '2026-06-14' }],
  ['303-A', 'Cama 303-A', 'BED', 'BED_STANDARD', '303', { unit: 'MEDINT', bedCategoryCode: 'BED_CAT_PRIVATE', censable: true }],
  ['304', 'Habitación 304', 'ROOM', 'INPATIENT_ROOM', 'A-PN-P3-SI', { unit: 'MEDINT', capacity: 2, areaM2: 20, floorNumber: 3, statusCode: 'SPACE_PLANNED', operationalStatusCode: null }],
  ['A-PN-P3-ENF', 'Estación de enfermería del piso 3', 'ROOM', 'NURSE_STATION', 'A-PN-P3', { unit: 'MEDINT', floorNumber: 3 }],
  ['A-PN-P3-BOT', 'Botiquín del piso 3', 'ROOM', 'STORAGE', 'A-PN-P3', { unit: 'FAR', floorNumber: 3, stock: true }],
  ['A-PN-P2', 'Piso 2', 'LEVEL', 'LEVEL_GENERIC', 'A-PN', { floorNumber: 2 }],
  ['BQ', 'Bloque quirúrgico', 'AREA', 'AREA_GENERIC', 'A-PN-P2', { unit: 'QX', floorNumber: 2, asepsisCode: 'ASEPSIS_RESTRICTED' }],
  ['QX-01', 'Quirófano 1', 'ROOM', 'OPERATING_ROOM', 'BQ', { unit: 'QX', areaM2: 42, floorNumber: 2, asepsisCode: 'ASEPSIS_RESTRICTED', pressureCode: 'PRESSURE_POSITIVE', airChangesPerHour: 20, hvacValidatedOn: '2026-03-02', prepMinutes: 20, cleanupMinutes: 30, equipment: 3, schedulableResource: true }],
  ['QX-02', 'Quirófano 2', 'ROOM', 'OPERATING_ROOM', 'BQ', { unit: 'QX', areaM2: 38, floorNumber: 2, asepsisCode: 'ASEPSIS_RESTRICTED', pressureCode: 'PRESSURE_POSITIVE', airChangesPerHour: 20, hvacValidatedOn: '2026-03-02', prepMinutes: 20, cleanupMinutes: 30, equipment: 2, schedulableResource: true }],
  ['QX-REC', 'Recuperación posanestésica', 'ROOM', 'RECOVERY_PACU', 'BQ', { unit: 'QX', areaM2: 30, floorNumber: 2 }],
  ['REC-1', 'Puesto de recuperación 1', 'BED', 'STRETCHER', 'QX-REC', { unit: 'QX', censable: false }],
  ['REC-2', 'Puesto de recuperación 2', 'BED', 'STRETCHER', 'QX-REC', { unit: 'QX', censable: false }],
  ['QX-EST', 'Central de esterilización', 'ROOM', 'STERILIZATION', 'BQ', { unit: 'QX', areaM2: 24, floorNumber: 2, asepsisCode: 'ASEPSIS_SEMI', pressureCode: 'PRESSURE_POSITIVE', airChangesPerHour: 10, hvacValidatedOn: '2026-03-02', equipment: 2 }],
  ['A-PB', 'Planta baja', 'LEVEL', 'LEVEL_GENERIC', 'BLD-A', { floorNumber: 0 }],
  ['IMG', 'Imagenología', 'AREA', 'AREA_GENERIC', 'A-PB', { unit: 'IMG', floorNumber: 0 }],
  ['IMG-TC', 'Sala de tomografía', 'ROOM', 'IMAGING_ROOM', 'IMG', { unit: 'IMG', areaM2: 35, floorNumber: 0, equipment: 1, schedulableResource: true, futureBookings: 4, description: 'Tomógrafo multicorte de 64 cortes. Blindaje plomado verificado.' }],
  ['IMG-RX', 'Sala de rayos X', 'ROOM', 'IMAGING_ROOM', 'IMG', { unit: 'IMG', areaM2: 25, floorNumber: 0, equipment: 1 }],
  ['LAB', 'Laboratorio clínico', 'AREA', 'AREA_GENERIC', 'A-PB', { unit: 'LAB', floorNumber: 0 }],
  ['LAB-TM1', 'Toma de muestras 1', 'ROOM', 'SAMPLE_COLLECTION', 'LAB', { unit: 'LAB', areaM2: 9, floorNumber: 0 }],
  ['LAB-TM2', 'Toma de muestras 2', 'ROOM', 'SAMPLE_COLLECTION', 'LAB', { unit: 'LAB', areaM2: 9, floorNumber: 0 }],
  ['LAB-AN', 'Área analítica', 'ROOM', 'LAB_AREA', 'LAB', { unit: 'LAB', areaM2: 40, floorNumber: 0, equipment: 5 }],
  ['EMG', 'Emergencias', 'AREA', 'AREA_GENERIC', 'A-PB', { unit: 'URG', floorNumber: 0 }],
  ['EMG-B1', 'Box de emergencias 1', 'ROOM', 'EMERGENCY_BOX', 'EMG', { unit: 'URG', areaM2: 12, floorNumber: 0 }],
  ['EMG-B2', 'Box de emergencias 2', 'ROOM', 'EMERGENCY_BOX', 'EMG', { unit: 'URG', areaM2: 12, floorNumber: 0 }],
  ['EMG-B3', 'Box de emergencias 3', 'ROOM', 'EMERGENCY_BOX', 'EMG', { unit: 'URG', areaM2: 12, floorNumber: 0 }],
  ['CE', 'Consulta externa', 'AREA', 'AREA_GENERIC', 'A-PB', { unit: 'CE', floorNumber: 0 }],
  ['CE-01', 'Consultorio 1', 'ROOM', 'CONSULTING_ROOM', 'CE', { unit: 'CE', areaM2: 14, floorNumber: 0, schedulableResource: true, futureBookings: 6 }],
  ['CE-02', 'Consultorio 2', 'ROOM', 'CONSULTING_ROOM', 'CE', { unit: 'CE', areaM2: 14, floorNumber: 0 }],
  ['CE-03', 'Consultorio 3', 'ROOM', 'CONSULTING_ROOM', 'CE', { unit: 'CE', areaM2: 14, floorNumber: 0 }],
  ['FAR', 'Farmacia central', 'ROOM', 'PHARMACY', 'A-PB', { unit: 'FAR', areaM2: 30, floorNumber: 0, stock: true }],
  ['DEP', 'Depósito general', 'ROOM', 'STORAGE', 'A-PB', { unit: 'FAR', areaM2: 45, floorNumber: 0, stock: true }],
  ['ESP', 'Sala de espera', 'ROOM', 'WAITING', 'A-PB', { floorNumber: 0 }],
];

const SEMILLA_NORTE: readonly Semilla[] = [
  ['BLD-N', 'Edificio Norte', 'BUILDING', 'BUILDING_GENERIC', null],
  ['CN-01', 'Consultorio Norte 1', 'ROOM', 'CONSULTING_ROOM', 'BLD-N', { unit: 'CEN', areaM2: 12 }],
  ['CN-02', 'Consultorio Norte 2', 'ROOM', 'CONSULTING_ROOM', 'BLD-N', { unit: 'CEN', areaM2: 12 }],
];

const SEMILLA_OLIVOS: readonly Semilla[] = [
  ['BLD-OL', 'Edificio principal', 'BUILDING', 'BUILDING_GENERIC', null],
  ['OL-PB', 'Planta baja', 'LEVEL', 'LEVEL_GENERIC', 'BLD-OL', { floorNumber: 0 }],
  ['OL-C1', 'Consultorio 1', 'ROOM', 'CONSULTING_ROOM', 'OL-PB', { unit: 'CARDIO', areaM2: 13, schedulableResource: true }],
  ['OL-C2', 'Consultorio 2', 'ROOM', 'CONSULTING_ROOM', 'OL-PB', { unit: 'MEDINT', areaM2: 13 }],
  ['OL-C3', 'Consultorio 3', 'ROOM', 'CONSULTING_ROOM', 'OL-PB', { unit: 'PEDIA', areaM2: 13, operationalStatusCode: 'SPACE_OP_MAINTENANCE' }],
  ['OL-PROC', 'Sala de procedimientos', 'ROOM', 'PROCEDURE_ROOM', 'OL-PB', { unit: 'CARDIO', areaM2: 20 }],
];

const SEMILLA_CONSULTORIO: readonly Semilla[] = [
  ['ROJAS-C', 'Consultorio', 'ROOM', 'CONSULTING_ROOM', null, { areaM2: 15, schedulableResource: true }],
];

export interface UnidadSimulada {
  readonly id: string;
  readonly siteId: string;
  readonly tenantId: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly typeCode: string;
  readonly statusCode: string;
  readonly description: string | null;
  readonly responsibleUserId: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly rowVersion: number;
}

type SemillaDeUnidad = readonly [code: string, name: string, type: string, parent: string | null];

const UNIDADES: Readonly<Record<string, readonly SemillaDeUnidad[]>> = {
  SANLUCAS: [
    ['DIR', 'Dirección médica', 'UNIT_TYPE_DIRECTION', null],
    ['MEDINT', 'Internación de medicina interna', 'UNIT_TYPE_SERVICE', 'DIR'],
    ['QX', 'Bloque quirúrgico', 'UNIT_TYPE_SERVICE', 'DIR'],
    ['IMG', 'Imagenología', 'UNIT_TYPE_SERVICE', 'DIR'],
    ['LAB', 'Laboratorio clínico', 'UNIT_TYPE_SERVICE', 'DIR'],
    ['FAR', 'Farmacia', 'UNIT_TYPE_SERVICE', 'DIR'],
    ['URG', 'Emergencias', 'UNIT_TYPE_SERVICE', 'DIR'],
    ['CE', 'Consulta externa', 'UNIT_TYPE_DEPARTMENT', 'DIR'],
  ],
  'SANLUCAS-N': [['CEN', 'Consulta externa Norte', 'UNIT_TYPE_DEPARTMENT', null]],
  'OLIVOS-C': [
    ['CARDIO', 'Cardiología', 'UNIT_TYPE_SERVICE', null],
    ['MEDINT', 'Medicina interna', 'UNIT_TYPE_SERVICE', null],
    ['PEDIA', 'Pediatría', 'UNIT_TYPE_SERVICE', null],
  ],
  ROJAS: [],
};

const SEMILLAS: Readonly<Record<string, readonly Semilla[]>> = {
  SANLUCAS: SEMILLA_SANLUCAS,
  'SANLUCAS-N': SEMILLA_NORTE,
  'OLIVOS-C': SEMILLA_OLIVOS,
  ROJAS: SEMILLA_CONSULTORIO,
};

const CREADO = '2025-02-10T12:00:00.000Z';

export function semillaDeEspacios(): EspacioSimulado[] {
  return SITIOS_INFRA.flatMap((sitio) =>
    (SEMILLAS[sitio.code] ?? []).map(([code, name, form, funcion, padre, extra = {}]) => {
      const { unit, ...resto } = extra;
      return {
        id: idDeEspacio(sitio, code),
        siteId: sitio.id,
        tenantId: sitio.tenantId,
        parentId: padre === null ? null : idDeEspacio(sitio, padre),
        code,
        name,
        formCode: `LOC_FORM_${form}`,
        functionCode: `SPACE_FN_${funcion}`,
        statusCode: 'SPACE_ACTIVE',
        operationalStatusCode: form === 'BED' || form === 'ROOM' ? 'SPACE_OP_AVAILABLE' : null,
        clinicalUnitId: unit === undefined ? null : idDeUnidad(sitio, unit),
        capacity: null,
        description: null,
        floorNumber: null,
        areaM2: null,
        asepsisCode: null,
        pressureCode: null,
        airChangesPerHour: null,
        hvacValidatedOn: null,
        sexRestrictionCode: null,
        ageGroupCode: null,
        bedCategoryCode: null,
        censable: null,
        prepMinutes: null,
        cleanupMinutes: null,
        gln: null,
        validFrom: CREADO,
        validTo: null,
        createdAt: CREADO,
        updatedAt: CREADO,
        rowVersion: 1,
        ...resto,
      };
    }),
  );
}

export function semillaDeUnidades(): UnidadSimulada[] {
  return SITIOS_INFRA.flatMap((sitio) =>
    (UNIDADES[sitio.code] ?? []).map(([code, name, type, padre]) => ({
      id: idDeUnidad(sitio, code),
      siteId: sitio.id,
      tenantId: sitio.tenantId,
      parentId: padre === null ? null : idDeUnidad(sitio, padre),
      code,
      name,
      typeCode: type,
      statusCode: 'UNIT_ACTIVE',
      description: null,
      responsibleUserId: null,
      validFrom: CREADO,
      validTo: null,
      rowVersion: 1,
    })),
  );
}

export interface LicenciaSimulada {
  readonly id: string;
  readonly siteId: string;
  readonly tenantId: string;
  readonly authorityName: string;
  readonly resolutionNumber: string;
  readonly issuedOn: string;
  readonly expiresOn: string | null;
  readonly statusCode: string;
  readonly clinicalUnitId: string | null;
  readonly healthcareServiceId: string | null;
  readonly documentFileId: string | null;
  readonly notes: string | null;
  readonly rowVersion: number;
}

export interface CapacidadDeclaradaSimulada {
  readonly id: string;
  readonly siteId: string;
  readonly tenantId: string;
  readonly kindCode: string;
  readonly quantity: number;
  readonly asOf: string;
  readonly resolutionNumber: string | null;
}

const SANLUCAS = SITIOS_INFRA[0]!;
const OLIVOS = SITIOS_INFRA[2]!;

export function semillaDeLicencias(diaIso: (dias: number) => string): LicenciaSimulada[] {
  return [
    { id: uuid('lic-sanlucas-func'), siteId: SANLUCAS.id, tenantId: SANLUCAS.tenantId, authorityName: 'SEDES Santa Cruz', resolutionNumber: 'RA-SEDES-SCZ 0412/2024', issuedOn: diaIso(-400), expiresOn: diaIso(330), statusCode: 'LIC_VALID', clinicalUnitId: null, healthcareServiceId: null, documentFileId: uuid('file-licencia'), notes: 'Habilitación de funcionamiento de segundo nivel.', rowVersion: 1 },
    { id: uuid('lic-sanlucas-lab'), siteId: SANLUCAS.id, tenantId: SANLUCAS.tenantId, authorityName: 'CODELAB / SEDES Santa Cruz', resolutionNumber: 'CODELAB-SCZ 118/2023', issuedOn: diaIso(-750), expiresOn: diaIso(-20), statusCode: 'LIC_VALID', clinicalUnitId: idDeUnidad(SANLUCAS, 'LAB'), healthcareServiceId: null, documentFileId: null, notes: 'Alcance: laboratorio clínico.', rowVersion: 1 },
    { id: uuid('lic-sanlucas-far'), siteId: SANLUCAS.id, tenantId: SANLUCAS.tenantId, authorityName: 'AGEMED', resolutionNumber: 'Trámite 2026-FAR-0931', issuedOn: diaIso(-30), expiresOn: null, statusCode: 'LIC_IN_PROCESS', clinicalUnitId: idDeUnidad(SANLUCAS, 'FAR'), healthcareServiceId: null, documentFileId: null, notes: null, rowVersion: 1 },
    { id: uuid('lic-olivos-func'), siteId: OLIVOS.id, tenantId: OLIVOS.tenantId, authorityName: 'SEDES Santa Cruz', resolutionNumber: 'RA-SEDES-SCZ 0233/2025', issuedOn: diaIso(-200), expiresOn: diaIso(530), statusCode: 'LIC_VALID', clinicalUnitId: null, healthcareServiceId: null, documentFileId: null, notes: null, rowVersion: 1 },
  ];
}

export function semillaDeCapacidad(): CapacidadDeclaradaSimulada[] {
  const declarar = (kind: string, quantity: number) => ({
    id: uuid(`cap-sanlucas-${kind}`),
    siteId: SANLUCAS.id,
    tenantId: SANLUCAS.tenantId,
    kindCode: kind,
    quantity,
    asOf: '2024-09-23',
    resolutionNumber: 'RA-SEDES-SCZ 0412/2024',
  });
  return [
    declarar('CAP_BEDS_CENSABLE', 10),
    declarar('CAP_BEDS_NON_CENSABLE', 2),
    declarar('CAP_OPERATING_ROOMS', 2),
    declarar('CAP_DELIVERY_ROOMS', 1),
    declarar('CAP_EMERGENCY_BAYS', 3),
    declarar('CAP_CONSULTING_ROOMS', 4),
  ];
}
