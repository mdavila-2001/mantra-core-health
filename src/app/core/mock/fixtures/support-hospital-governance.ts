import type {
  Anomaly,
  Campaign,
  GovernanceRule,
  GovernanceSettings,
  LifecycleCaseDetail,
  RestrictionFlag,
  ReviewEvidence,
  ReviewItem,
  SodException,
  SodRule,
  SupportApproval,
} from '../../data-access/access-governance/access-governance.types';
import type { SupportCondition } from '../../data-access/access-governance/conditions.types';
import { LEGACY_ALIAS_ATOMS } from '../../data-access/support-access/support-atoms';
import {
  SUPPORT_ACTION_CODES,
  type SupportActionCode,
} from '../../data-access/support-access/support-access.types';
import { IDS, TENANT_HOSPITAL_PILOTO } from '../mock-session';
import { Coleccion, iso, uuid } from '../mock-store';
import { AJUSTES_DE_GOBIERNO_DEL_PILOTO } from './support-hospital-governance.data';
import type { FilaPermiso, FilaVinculo } from './support-hospital.types';

/* ============================================================================
    El **Hospital Piloto extendido** del gobierno de accesos (CONTRATO-GOBIERNO §10): seis personas
    nuevas, siete pacientes ficticios, permisos con átomos y condiciones, reglas de la
    organización, una campaña vencida, un cuatro ojos pendiente, anomalías y casos de ciclo de vida.

    Todo sintético. Los ids salen de `uuid(semilla)` y apuntan a los mismos doctores y ubicaciones
    que `support-hospital.ts` **sin importarlo** (así no hay ciclo), como `support-hospital-review.ts`.
    Las fechas son relativas a «hoy» (`iso(días)`): el piloto siempre se ve «de hoy». El estado que las
    pantallas cambian vive en `Coleccion`es con `.reiniciar()` para las pruebas.
   ========================================================================== */

const T = TENANT_HOSPITAL_PILOTO;
const doc = (clave: string): string => uuid(`hp-doc-${clave}`);
const loc = (clave: string): string => uuid(`hp-loc-${clave}`);
const svc = (clave: string): string => uuid(`hp-svc-${clave}`);

/* ---- las personas ---------------------------------------------------------------------------------- */

export interface PersonaDeGobierno {
  readonly clave: string;
  readonly nombre: string;
  readonly userId: string;
  readonly engagementId: string;
}

function persona(
  clave: string,
  nombre: string,
  userId: string = uuid(`user-${clave}`),
): PersonaDeGobierno {
  return { clave, nombre, userId, engagementId: uuid(`hp-eng-${clave}`) };
}

/** Las once personas con vínculo en el piloto que el gobierno de accesos recorre (las cinco de antes y las seis nuevas). */
export const GENTE = {
  ana: {
    clave: 'ana',
    nombre: 'Ana Gutiérrez',
    userId: IDS.ana.userId,
    engagementId: uuid('hp-eng-ana'),
  },
  lucia: {
    clave: 'lucia',
    nombre: 'Lucía Paz',
    userId: IDS.lucia.userId,
    engagementId: uuid('hp-eng-lucia'),
  },
  marcos: {
    clave: 'marcos',
    nombre: 'Marcos Ribera',
    userId: IDS.marcos.userId,
    engagementId: uuid('hp-eng-marcos'),
  },
  sofia: persona('sofia', 'Sofía Camacho', uuid('user-sofia-camacho')),
  ricardo: persona('ricardo', 'Ricardo Terceros', uuid('user-ricardo-terceros')),
  mario: persona('mario', 'Mario Salvatierra', uuid('user-mario-salvatierra')),
  nora: persona('nora', 'Nora Villarroel', uuid('user-nora-villarroel')),
  pablo: persona('pablo', 'Pablo Mamani', uuid('user-pablo-mamani')),
  gonzalo: persona('gonzalo', 'Gonzalo Pinto', uuid('user-gonzalo-pinto')),
} as const satisfies Record<string, PersonaDeGobierno>;

export type ClaveDePersona = keyof typeof GENTE;

/** El administrador de seguridad de la sesión simulada (la cuenta del hospital) y el segundo administrador. */
export const ADMIN_PRINCIPAL = {
  userId: IDS.hospitalPiloto.userId,
  nombre: 'Hospital Piloto Mantra',
} as const;
export const ADMIN_SEGUNDO = {
  userId: GENTE.gonzalo.userId,
  nombre: GENTE.gonzalo.nombre,
} as const;

/** Nombre de quien tiene ese `userId` entre las personas del piloto, los doctores con cuenta y los administradores. */
const NOMBRES: ReadonlyMap<string, string> = new Map<string, string>([
  ...Object.values(GENTE).map((p): [string, string] => [p.userId, p.nombre]),
  [IDS.perez.userId, 'Dr. Andrés Pérez'],
  [IDS.suarez.userId, 'Dr. Martín Suárez'],
  [ADMIN_PRINCIPAL.userId, ADMIN_PRINCIPAL.nombre],
]);
export const nombreDeUsuario = (userId: string | undefined): string | undefined =>
  userId === undefined ? undefined : NOMBRES.get(userId);

/* ---- vínculos y permisos nuevos --------------------------------------------------------------------- */

function vinculoNuevo(
  p: PersonaDeGobierno,
  roleTemplate: FilaVinculo['roleTemplate'],
  diasDesdeAlta: number,
  extras: Partial<FilaVinculo> = {},
): FilaVinculo {
  return {
    id: p.engagementId,
    tenantId: T,
    ownerKind: 'ORGANIZATION',
    userId: p.userId,
    personName: p.nombre,
    personEmail: `${p.clave}@alovida.mock`,
    roleTemplate,
    status: 'ACTIVE',
    origin: 'INVITATION',
    validFrom: iso(-diasDesdeAlta),
    recertifyEveryMonths: 12,
    nextRecertificationAt: iso(365 - diasDesdeAlta),
    ...extras,
  };
}

/** Los vínculos que suma el gobierno de accesos al piloto (se agregan a `vinculos`). */
export const VINCULOS_DE_GOBIERNO: readonly FilaVinculo[] = [
  vinculoNuevo(GENTE.sofia, 'ORG_MANAGEMENT', 120),
  vinculoNuevo(GENTE.ricardo, 'ORG_MANAGEMENT', 150),
  vinculoNuevo(GENTE.mario, 'BILLING_CASHIER', 200),
  vinculoNuevo(GENTE.nora, 'NURSING', 1),
  vinculoNuevo(GENTE.pablo, 'CALL_CENTER', 300),
];

/** El preajuste «Jefe de servicio» (§6.4): lo que se puede dar dentro de su techo. */
export const ATOMOS_DE_JEFE_DE_SERVICIO: readonly string[] = [
  'agenda.appointment.view',
  'team.members.view',
  'team.grants.assign',
  'team.grants.revoke',
  'team.requests.decide',
  'team.invitations.create',
  'team.engagement.recertify',
  'team.engagement.suspend',
  'team.engagement.reactivate',
  'team.engagement.end',
  'team.handover.execute',
  'team.campaigns.review',
  'audit.activity.view_team',
  'audit.decisions.explain',
];

export const TECHO_POR_OMISION = {
  allowAtoms: ['agenda.*', 'patients.search.exact', 'patients.profile.view_basic', 'messages.*'],
  forbidAtoms: [],
  templates: ['SECRETARY', 'NURSING', 'FRONT_DESK', 'CALL_CENTER', 'MEDICAL_ASSISTANT'],
  maxValidDays: 180,
} as const;

const cond = (partes: Omit<SupportCondition, 'schemaVersion'>): SupportCondition => ({
  schemaVersion: 1,
  ...partes,
});

const ATOMOS_DE_SECRETARIA_V2: readonly string[] = [
  'agenda.appointment.view',
  'agenda.appointment.view.patient_name',
  'agenda.appointment.view.reason',
  'agenda.appointment.create',
  'agenda.appointment.reschedule',
  'agenda.appointment.cancel',
  'agenda.appointment.confirm',
  'agenda.appointment.check_in',
  'patients.search.exact',
  'patients.profile.view_basic',
];

/** Los alias antiguos que un conjunto de átomos cubre por completo (`actions` sigue trayendo los 15 códigos). */
const aliasCubiertos = (atoms: readonly string[]): readonly SupportActionCode[] =>
  SUPPORT_ACTION_CODES.filter((c) => LEGACY_ALIAS_ATOMS[c]!.every((a) => atoms.includes(a)));

function grant(
  clave: string,
  p: PersonaDeGobierno,
  objetivo: Omit<FilaPermiso, 'id' | 'engagementId' | 'expansionMode' | 'actions' | 'status'>,
  extras: Partial<FilaPermiso> = {},
): FilaPermiso {
  const atoms = extras.atoms;
  return {
    id: uuid(`hp-grant-${clave}`),
    engagementId: p.engagementId,
    expansionMode: 'DYNAMIC',
    actions:
      extras.actions ??
      (atoms === undefined || extras.effect === 'DENY' ? [] : aliasCubiertos(atoms)),
    status: 'ACTIVE',
    ...objetivo,
    ...extras,
  };
}

/** Los permisos escritos con átomos y condiciones (se agregan a `permisos`). */
export const PERMISOS_DE_GOBIERNO: readonly FilaPermiso[] = [
  grant(
    'sofia-ecografia',
    GENTE.sofia,
    { targetKind: 'SERVICE', healthcareServiceId: svc('ecografia') },
    {
      atoms: ATOMOS_DE_JEFE_DE_SERVICIO,
      reasonText: 'Jefatura del servicio',
      condition: cond({
        time: {
          timeZone: 'America/La_Paz',
          windows: [{ days: [1, 2, 3, 4, 5, 6], from: '07:00', to: '20:00' }],
        },
        delegationCeiling: TECHO_POR_OMISION,
      }),
    },
  ),
  grant(
    'ricardo-a-p1',
    GENTE.ricardo,
    { targetKind: 'LOCATION', careSpaceId: loc('a-p1') },
    {
      atoms: ATOMOS_DE_JEFE_DE_SERVICIO,
      reasonText: 'Jefatura del piso 1',
      condition: cond({ delegationCeiling: TECHO_POR_OMISION }),
    },
  ),
  grant(
    'ricardo-a-p1-caja',
    GENTE.ricardo,
    { targetKind: 'LOCATION', careSpaceId: loc('a-p1') },
    {
      atoms: ['billing.payment.collect'],
      reasonText: 'Cobra en el piso 1 (con excepción de separación de funciones)',
    },
  ),
  grant(
    'mario-perez',
    GENTE.mario,
    { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('perez') },
    {
      atoms: ['billing.invoice.view', 'billing.payment.collect', 'billing.receipt.issue'],
      condition: cond({
        amount: { currency: 'BOB', perTransactionMax: 2000, onExceed: 'REQUIRE_APPROVAL' },
        network: { require: 'ORG_RULES' },
      }),
    },
  ),
  grant(
    'mario-rojas',
    GENTE.mario,
    { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('rojas') },
    { atoms: ['billing.invoice.view', 'billing.payment.collect'] },
  ),
  grant(
    'nora-mendez',
    GENTE.nora,
    { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('mendez') },
    {
      atoms: [
        'agenda.appointment.view',
        'agenda.appointment.view.patient_name',
        'agenda.appointment.view.reason',
        'patients.search.exact',
        'patients.profile.view_basic',
      ],
      condition: cond({
        patients: {
          scope: 'WITH_APPOINTMENT_WINDOW',
          appointmentWindow: { daysBefore: 0, daysAfter: 0, withCoveredDoctor: true },
        },
        fields: { 'agenda.appointment.view.reason': { mask: 'PARTIAL' } },
      }),
    },
  ),
  grant(
    'pablo-perez',
    GENTE.pablo,
    { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('perez') },
    { actions: ['schedule.view', 'schedule.create', 'schedule.cancel', 'schedule.confirm'] },
  ),
  grant(
    'pablo-mendez',
    GENTE.pablo,
    { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('mendez') },
    { actions: ['schedule.view', 'schedule.create', 'schedule.cancel', 'schedule.confirm'] },
  ),
  // La prohibición expresa de Ana sobre los motivos de la Dra. Rojas cuando el paciente es confidencial.
  grant(
    'ana-rojas-deny',
    GENTE.ana,
    { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('rojas') },
    {
      effect: 'DENY',
      atoms: ['agenda.appointment.view.reason'],
      condition: cond({ patients: { flags: { anyOf: ['CONFIDENTIAL'] } } }),
      reasonText: 'Pacientes confidenciales de la Dra. Rojas',
    },
  ),
];

/** Lo que el piloto agrega a los permisos que ya existían: `support-hospital.ts` lo sobrepone por id al construir `permisos` (Ana-Rojas y Marcos-Suárez-Norte pasan a átomos con condiciones). */
export const ATOMOS_SOBRE_PERMISOS_EXISTENTES: ReadonlyMap<string, Partial<FilaPermiso>> = new Map<
  string,
  Partial<FilaPermiso>
>([
  [
    uuid('hp-grant-ana-rojas'),
    {
      atoms: ATOMOS_DE_SECRETARIA_V2,
      condition: cond({
        time: {
          timeZone: 'America/La_Paz',
          windows: [{ days: [1, 2, 3, 4, 5], from: '07:30', to: '18:30' }],
        },
        network: { require: 'ORG_RULES' },
        patients: { exclude: { flags: ['VIP', 'CONFIDENTIAL'] } },
      }),
      actionConditions: {
        'agenda.appointment.cancel': cond({
          appointment: { leadTime: { minHours: 24, onViolation: 'REQUIRE_APPROVAL' } },
          limits: [{ metric: 'ACTIONS', per: 'DAY', max: 20, scope: 'GRANT', onExceed: 'DENY' }],
        }),
        'agenda.appointment.view.reason': cond({
          fields: { 'agenda.appointment.view.reason': { mask: 'PARTIAL' } },
          appointment: { window: { daysBefore: 1, daysAfter: 14 } },
        }),
      },
    },
  ],
  [
    uuid('hp-grant-marcos-suarez-norte'),
    {
      atoms: [
        'agenda.appointment.view',
        'agenda.appointment.create',
        'agenda.appointment.cancel',
        'patients.search.exact',
        'patients.profile.view_basic',
      ],
      actionConditions: {
        'agenda.appointment.cancel': cond({
          appointment: { leadTime: { minHours: 24, onViolation: 'REQUIRE_APPROVAL' } },
          limits: [{ metric: 'ACTIONS', per: 'DAY', max: 20, scope: 'GRANT', onExceed: 'DENY' }],
        }),
      },
    },
  ],
]);

/* ---- metadatos de gobierno por vínculo ---------------------------------------------------------------- */

export interface FilaMetaDeVinculo {
  /** El id del vínculo. */
  readonly id: string;
  readonly supervisorUserId?: string;
  /** Días sin uso (`null` = nunca usó). */
  readonly diasSinUso: number | null;
  readonly identidadVerificada: boolean;
  readonly compromisoDeConfidencialidad: boolean;
  readonly ingresoCompleto: boolean;
  readonly fueraDeTecho: boolean;
  /** Puntaje de privilegios «hoy» y su línea base (deriva = hoy − base). */
  readonly puntaje: number;
  readonly lineaBase: number;
}

export const metaDeVinculo = new Coleccion<FilaMetaDeVinculo>([
  {
    id: GENTE.ana.engagementId,
    supervisorUserId: IDS.perez.userId,
    diasSinUso: 0,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 41,
    lineaBase: 41,
  },
  {
    id: GENTE.lucia.engagementId,
    supervisorUserId: GENTE.ricardo.userId,
    diasSinUso: 1,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 18,
    lineaBase: 18,
  },
  {
    id: GENTE.marcos.engagementId,
    supervisorUserId: GENTE.sofia.userId,
    diasSinUso: 0,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 22,
    lineaBase: 20,
  },
  {
    id: GENTE.sofia.engagementId,
    supervisorUserId: ADMIN_PRINCIPAL.userId,
    diasSinUso: 0,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 56,
    lineaBase: 56,
  },
  {
    id: GENTE.ricardo.engagementId,
    supervisorUserId: ADMIN_PRINCIPAL.userId,
    diasSinUso: 2,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 61,
    lineaBase: 56,
  },
  {
    id: GENTE.mario.engagementId,
    supervisorUserId: ADMIN_PRINCIPAL.userId,
    diasSinUso: 0,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 15,
    lineaBase: 15,
  },
  // Nora: sin dueño, ingreso abierto (falta asignar quién la supervisa).
  {
    id: GENTE.nora.engagementId,
    diasSinUso: 0,
    identidadVerificada: true,
    compromisoDeConfidencialidad: false,
    ingresoCompleto: false,
    fueraDeTecho: false,
    puntaje: 24,
    lineaBase: 24,
  },
  // Pablo: se va; sin uso hace 70 días.
  {
    id: GENTE.pablo.engagementId,
    supervisorUserId: GENTE.sofia.userId,
    diasSinUso: 70,
    identidadVerificada: true,
    compromisoDeConfidencialidad: true,
    ingresoCompleto: true,
    fueraDeTecho: false,
    puntaje: 12,
    lineaBase: 12,
  },
]).persistirEn('mock.gobierno.meta');

/* ---- pacientes ficticios y banderas -------------------------------------------------------------------- */

export interface PacienteDeGobierno {
  readonly clave: string;
  readonly nombre: string;
  readonly patientProfileId: string;
  readonly descripcion: string;
  readonly bandera?: 'VIP' | 'CONFIDENTIAL' | 'STAFF_RELATIVE';
}

const paciente = (
  clave: string,
  nombre: string,
  descripcion: string,
  bandera?: PacienteDeGobierno['bandera'],
): PacienteDeGobierno => ({
  clave,
  nombre,
  patientProfileId: uuid(`demo-gov-patient-${clave}`),
  descripcion,
  ...(bandera === undefined ? {} : { bandera }),
});

/** Los siete pacientes ficticios de §10.2 (sin cuenta). */
export const PACIENTES_DE_GOBIERNO: readonly PacienteDeGobierno[] = [
  paciente('carmen-ortuno', 'Carmen Ortuño', '45 años, asegurada'),
  paciente('luis-choque', 'Luis Choque', '72 años, sin seguro'),
  paciente('mateo-rivera', 'Mateo Rivera', '8 años (menor), asegurado'),
  paciente('reservado-01', 'Paciente Reservado 01', 'Adulto', 'VIP'),
  paciente('reservado-02', 'Paciente Reservado 02', 'Adulto', 'CONFIDENTIAL'),
  paciente('sandra-vargas', 'Sandra Vargas', 'Sin fecha de nacimiento registrada'),
  paciente('julian-teran', 'Julián Terán', '29 años, familiar de personal', 'STAFF_RELATIVE'),
];

export interface FilaBandera extends RestrictionFlag {
  readonly id: string;
  readonly patientProfileId: string;
}

export const banderasDePacientes = new Coleccion<FilaBandera>(
  PACIENTES_DE_GOBIERNO.filter((p) => p.bandera !== undefined).map((p) => ({
    id: uuid(`demo-gov-flag-${p.clave}`),
    patientProfileId: p.patientProfileId,
    flag: p.bandera!,
    reason:
      p.bandera === 'VIP'
        ? 'Autoridad pública'
        : p.bandera === 'CONFIDENTIAL'
          ? 'Pedido del paciente'
          : 'Familiar de una persona del equipo',
    validFrom: iso(-30),
  })),
).persistirEn('mock.gobierno.banderas');

/** Las doce citas de §10.2 (hoy = martes 3 de noviembre): referencia para los escenarios de explicar; no entran a la agenda simulada. */
export const CITAS_DE_GOBIERNO = [
  {
    id: 'A1',
    paciente: 'carmen-ortuno',
    doctor: 'perez',
    espacio: 'a-p1-103',
    cuando: 'hoy 16:30',
  },
  {
    id: 'A2',
    paciente: 'carmen-ortuno',
    doctor: 'perez',
    espacio: 'a-p1-103',
    cuando: 'mañana 07:00',
  },
  { id: 'A3', paciente: 'luis-choque', doctor: 'perez', espacio: 'a-p1-103', cuando: '2026-11-20' },
  {
    id: 'A4',
    paciente: 'mateo-rivera',
    doctor: 'suarez',
    espacio: 'b-p1-b102',
    cuando: 'mañana 09:00',
  },
  { id: 'A5', paciente: 'reservado-01', doctor: 'perez', espacio: 'a-p1-103', cuando: 'hoy 11:30' },
  {
    id: 'A6',
    paciente: 'reservado-02',
    doctor: 'rojas',
    espacio: 'b-p2-b201',
    cuando: 'hoy 14:00',
  },
  {
    id: 'A7',
    paciente: 'carmen-ortuno',
    doctor: 'antelo',
    espacio: 'a-p2-201',
    cuando: '2026-11-05 10:00',
  },
  {
    id: 'A8',
    paciente: 'sandra-vargas',
    doctor: 'mendez',
    espacio: 'a-p1-105',
    cuando: 'hoy 12:00',
  },
  { id: 'A9', paciente: 'julian-teran', doctor: 'perez', espacio: 'a-p1-103', cuando: 'hoy 09:00' },
  {
    id: 'A10',
    paciente: 'luis-choque',
    doctor: 'rojas',
    espacio: 'b-p2-b201',
    cuando: 'hoy 16:30',
  },
  {
    id: 'A11',
    paciente: 'carmen-ortuno',
    doctor: 'rojas',
    espacio: 'b-p2-b201',
    cuando: '2026-11-05 11:00',
  },
  {
    id: 'A12',
    paciente: 'carmen-ortuno',
    doctor: 'mendez',
    espacio: 'a-p1-105',
    cuando: 'mañana 15:00',
  },
] as const;

/* ---- reglas de la organización (L1), ajustes y excepciones SoD ------------------------------------------- */

function regla(
  clave: string,
  parcial: Omit<GovernanceRule, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'rowVersion'>,
): GovernanceRule {
  return {
    id: uuid(`demo-gov-rule-${clave}`),
    status: 'ACTIVE',
    createdAt: iso(-40),
    updatedAt: iso(-40),
    rowVersion: 1,
    ...parcial,
  };
}

export const reglasDeGobierno = new Coleccion<GovernanceRule>([
  regla('secretaria-no-cobra', {
    kind: 'CEILING',
    roleTemplateCode: 'SECRETARY',
    permissionPattern: 'billing.*',
    message: 'Secretaría no cobra.',
  }),
  regla('facturacion-en-red', {
    kind: 'REQUIRE_CONDITION',
    permissionPattern: 'billing.*',
    condition: cond({ network: { require: 'ORG_RULES' } }),
    message: 'Facturación solo desde la red del hospital.',
  }),
  regla('documento-parcial', {
    kind: 'FIELD_FLOOR',
    permissionPattern: 'agenda.appointment.view.patient_document',
    maxVisibility: 'PARTIAL',
    message: 'El documento se ve siempre de forma parcial.',
  }),
]).persistirEn('mock.gobierno.reglas');

export const ajustesDeGobierno = new Coleccion<
  GovernanceSettings & { readonly id: string; readonly updatedAt: string }
>([{ id: 'settings', ...AJUSTES_DE_GOBIERNO_DEL_PILOTO, updatedAt: iso(-3) }]).persistirEn(
  'mock.gobierno.ajustes',
);

export const reglasSodDeLaOrganizacion = new Coleccion<SodRule & { readonly id: string }>(
  [],
).persistirEn('mock.gobierno.sod-reglas');

export const excepcionesSod = new Coleccion<SodException & { readonly requestedBy?: string }>([
  {
    id: uuid('demo-gov-sodex-ricardo'),
    ruleCode: 'SOD-GOV-03',
    engagementId: GENTE.ricardo.engagementId,
    justification:
      'Ricardo cobra en el piso 1 los fines de semana porque no hay otra persona de caja; se revisa cada trimestre.',
    validFrom: iso(-20),
    validTo: '2026-12-31',
    status: 'ACTIVE',
    requestedBy: ADMIN_PRINCIPAL.userId,
  },
]).persistirEn('mock.gobierno.sod-excepciones');

/* ---- cuatro ojos ------------------------------------------------------------------------------------------ */

export const aprobaciones = new Coleccion<SupportApproval>([
  {
    id: uuid('demo-gov-approval-marcos-a4'),
    tenantId: T,
    kind: 'ACTION',
    status: 'PENDING',
    approverKind: 'DOCTOR',
    atom: 'agenda.appointment.cancel',
    requesterUserId: GENTE.marcos.userId,
    subjectUserId: GENTE.marcos.userId,
    reasonText: 'La mamá de Mateo avisó que no puede venir mañana por la mañana.',
    createdAt: iso(0, 9, 40),
    expiresAt: iso(1, 9, 40),
    summary:
      'Marcos Ribera pide cancelar la cita de Mateo Rivera con el Dr. Suárez de mañana a las 09:00 (faltan 22 horas y su permiso exige 24). Si la aprueba, la cancelación se puede hacer una vez en la próxima hora.',
  },
]).persistirEn('mock.gobierno.aprobaciones');

/* ---- campañas de certificación ------------------------------------------------------------------------------ */

const CAMPANA_Q4 = uuid('demo-gov-campaign-q4');

export const campanas = new Coleccion<Campaign>([
  {
    id: CAMPANA_Q4,
    name: 'Certificación Q4-2026',
    kind: 'PERIODIC',
    status: 'OPEN',
    scope: { kind: 'ORGANIZATION' },
    filters: { minSensitivity: 'MEDIUM' },
    dueAt: iso(-4),
    graceDays: 7,
    reminderDaysBefore: [7, 3, 1],
    escalateAfterDays: 3,
    uncertifiedAction: 'UNCERTIFIED_REVOKE',
    ownerUserId: ADMIN_PRINCIPAL.userId,
    launchedAt: iso(-17),
  },
]).persistirEn('mock.gobierno.campanas');

function evidencia(
  persona: PersonaDeGobierno,
  resumen: string,
  atomos: readonly string[],
  plantilla: string,
  usos: number,
  extras: Partial<ReviewEvidence> = {},
): ReviewEvidence {
  return {
    schemaVersion: 1,
    kind: 'ENGAGEMENT',
    generatedAt: iso(-17),
    summary: resumen,
    engagement: {
      engagementId: persona.engagementId,
      templateCode: plantilla,
      state: 'ACTIVE',
      createdAt: iso(-150),
      nextRecertificationAt: iso(200),
      recertifyEveryMonths: 12,
    },
    grants: [],
    atoms: atomos.map((code) => ({ code, name: code, sensitivity: 'MEDIUM' as const })),
    usage90d: atomos
      .slice(0, 2)
      .map((atom) => ({ atom, permit: usos, deny: 0, lastUsedAt: iso(-2) })),
    openAlerts: 0,
    sodFindings: [],
    aboveCeiling: false,
    lastCertifiedAt: null,
    ...extras,
  };
}

function itemDeRevision(
  clave: string,
  persona: PersonaDeGobierno,
  reviewerKind: ReviewItem['reviewerKind'],
  state: ReviewItem['state'],
  ev: ReviewEvidence,
  extras: Partial<ReviewItem & { readonly reviewerUserId: string }> = {},
): ReviewItem & { readonly reviewerUserId: string } {
  return {
    id: uuid(`demo-gov-item-${clave}`),
    campaignId: CAMPANA_Q4,
    campaignName: 'Certificación Q4-2026',
    engagementId: persona.engagementId,
    subjectUserId: persona.userId,
    subjectName: persona.nombre,
    reviewerKind,
    state,
    dueAt: iso(-4),
    escalated: false,
    reminderCount: 2,
    maxSensitivity: 'HIGH',
    evidence: ev,
    evidenceHash: uuid(`hash-${clave}`).replaceAll('-', '').padEnd(64, '0'),
    reviewerUserId: ADMIN_PRINCIPAL.userId,
    ...extras,
  };
}

export const itemsDeRevision = new Coleccion<ReviewItem & { readonly reviewerUserId: string }>([
  itemDeRevision(
    'mario',
    GENTE.mario,
    'ADMIN',
    'CERTIFIED',
    evidencia(
      GENTE.mario,
      'Mario Salvatierra puede cobrar y emitir comprobantes en las agendas de Pérez y Rojas.',
      ['billing.payment.collect', 'billing.receipt.issue'],
      'BILLING_CASHIER',
      120,
    ),
    {
      decidedAt: iso(-10),
      comment: 'Cobra a diario y su uso coincide con su rol.',
      reminderCount: 0,
    },
  ),
  itemDeRevision(
    'sofia',
    GENTE.sofia,
    'ADMIN',
    'PENDING',
    evidencia(
      GENTE.sofia,
      'Sofía Camacho administra al equipo del servicio de Ecografía.',
      ['team.grants.assign', 'team.requests.decide'],
      'ORG_MANAGEMENT',
      12,
    ),
    { escalated: true, maxSensitivity: 'HIGH' },
  ),
  itemDeRevision(
    'marcos-eco',
    GENTE.marcos,
    'SERVICE_HEAD',
    'PENDING',
    evidencia(
      GENTE.marcos,
      'Marcos Ribera puede ver la agenda y crear citas del servicio de Ecografía.',
      ['agenda.appointment.view', 'agenda.appointment.create'],
      'CALL_CENTER',
      60,
    ),
    { maxSensitivity: 'MEDIUM', escalated: true, reviewerUserId: GENTE.sofia.userId },
  ),
  itemDeRevision(
    'ana-rojas',
    GENTE.ana,
    'DOCTOR_OWNER',
    'PENDING',
    evidencia(
      GENTE.ana,
      'Ana Gutiérrez puede ver, crear, reprogramar y cancelar citas de la Dra. Rojas, con condiciones de horario y de red.',
      ['agenda.appointment.view', 'agenda.appointment.cancel'],
      'SECRETARY',
      80,
      { sodFindings: [] },
    ),
    { escalated: true, maxSensitivity: 'MEDIUM', reviewerUserId: IDS.perez.userId },
  ),
  itemDeRevision(
    'nora',
    GENTE.nora,
    'ADMIN',
    'REVOKED',
    evidencia(
      GENTE.nora,
      'Nora Villarroel veía motivos de consulta sin dueño de cuenta asignado.',
      ['agenda.appointment.view.reason'],
      'NURSING',
      0,
    ),
    {
      decidedAt: iso(-5),
      comment: 'Sin dueño de cuenta y sin uso: se quita hasta que tenga responsable.',
      reminderCount: 1,
    },
  ),
  itemDeRevision(
    'lucia',
    GENTE.lucia,
    'SUPERVISOR',
    'PENDING',
    evidencia(
      GENTE.lucia,
      'Lucía Paz atiende la recepción del Edificio A, piso 1.',
      ['agenda.appointment.view', 'agenda.appointment.check_in'],
      'FRONT_DESK',
      200,
    ),
    { maxSensitivity: 'MEDIUM', reviewerUserId: GENTE.ricardo.userId, escalated: true },
  ),
]).persistirEn('mock.gobierno.items');

/* ---- anomalías ------------------------------------------------------------------------------------------------- */

export const anomalias = new Coleccion<Anomaly>([
  {
    id: uuid('demo-gov-anomaly-marcos'),
    userId: GENTE.marcos.userId,
    userName: GENTE.marcos.nombre,
    kind: 'ANOMALY_SEARCH_SPIKE',
    status: 'OPEN',
    windowStart: iso(0, 9, 0),
    windowEnd: iso(0, 10, 0),
    observed: 18,
    baseline: 4,
    threshold: 15,
    evidence: {
      // Con la forma que da la API real (`detectSearchSpike`): sin serie ni texto; la pantalla arma observado, habitual y umbral.
      permitsInWindow: 18,
      p95Hourly: 4,
      baselineHours: 24,
      atom: 'patients.search.exact',
    },
  },
  {
    id: uuid('demo-gov-anomaly-pablo'),
    userId: GENTE.pablo.userId,
    userName: GENTE.pablo.nombre,
    kind: 'ANOMALY_INACTIVE_ACCOUNT',
    status: 'OPEN',
    windowStart: iso(-70),
    windowEnd: iso(0),
    observed: 70,
    baseline: null,
    threshold: 45,
    evidence: { daysInactive: 70, autoSuspend: false },
  },
]).persistirEn('mock.gobierno.anomalias');

/* ---- ciclo de vida -------------------------------------------------------------------------------------------- */

export const casosDeCicloDeVida = new Coleccion<LifecycleCaseDetail>([
  {
    id: uuid('demo-gov-case-mario-joiner'),
    kind: 'JOINER',
    status: 'COMPLETED',
    engagementId: GENTE.mario.engagementId,
    subjectUserId: GENTE.mario.userId,
    openedByUserId: ADMIN_PRINCIPAL.userId,
    openedAt: iso(-200),
    completedAt: iso(-198),
    reason: 'Ingreso a caja',
    checklist: [
      {
        code: 'IDENTITY_VERIFIED',
        label: 'Identidad verificada',
        required: true,
        completion: 'MANUAL',
        status: 'DONE',
        completedAt: iso(-199),
      },
      {
        code: 'SUPERVISOR_ASSIGNED',
        label: 'Dueño de la cuenta asignado',
        required: true,
        completion: 'MANUAL',
        status: 'DONE',
        completedAt: iso(-199),
      },
      {
        code: 'CONFIDENTIALITY_ACK',
        label: 'Compromiso de confidencialidad',
        required: true,
        completion: 'AUTOMATIC',
        status: 'DONE',
        completedAt: iso(-198),
      },
    ],
    handover: [],
  },
  {
    id: uuid('demo-gov-case-nora-joiner'),
    kind: 'JOINER',
    status: 'OPEN',
    engagementId: GENTE.nora.engagementId,
    subjectUserId: GENTE.nora.userId,
    openedByUserId: ADMIN_PRINCIPAL.userId,
    openedAt: iso(-1),
    dueAt: iso(6),
    reason: 'Ingreso a enfermería de Internación',
    checklist: [
      {
        code: 'IDENTITY_VERIFIED',
        label: 'Identidad verificada',
        required: true,
        completion: 'MANUAL',
        status: 'DONE',
        completedAt: iso(-1),
      },
      {
        code: 'SUPERVISOR_ASSIGNED',
        label: 'Dueño de la cuenta asignado',
        required: true,
        completion: 'MANUAL',
        status: 'PENDING',
      },
      {
        code: 'CONFIDENTIALITY_ACK',
        label: 'Compromiso de confidencialidad',
        required: true,
        completion: 'AUTOMATIC',
        status: 'PENDING',
      },
    ],
    handover: [],
  },
]).persistirEn('mock.gobierno.casos');

/** Lo que Pablo tiene «en las manos» antes de la baja (§10.3): tres conversaciones, dos tareas y una cita pendiente. */
export const TRASPASO_DE_PABLO = [
  {
    id: uuid('demo-gov-ho-conv-1'),
    kind: 'CONVERSATION',
    sourceId: uuid('conv-pablo-1'),
    detalle: 'Conversación con un paciente del Dr. Pérez',
  },
  {
    id: uuid('demo-gov-ho-conv-2'),
    kind: 'CONVERSATION',
    sourceId: uuid('conv-pablo-2'),
    detalle: 'Conversación con un paciente del Dr. Pérez',
  },
  {
    id: uuid('demo-gov-ho-conv-3'),
    kind: 'CONVERSATION',
    sourceId: uuid('conv-pablo-3'),
    detalle: 'Conversación con un paciente de la Dra. Méndez',
  },
  {
    id: uuid('demo-gov-ho-task-1'),
    kind: 'WORKFLOW_TASK',
    sourceId: uuid('task-pablo-1'),
    detalle: 'Tarea abierta',
  },
  {
    id: uuid('demo-gov-ho-task-2'),
    kind: 'WORKFLOW_TASK',
    sourceId: uuid('task-pablo-2'),
    detalle: 'Tarea abierta',
  },
  {
    id: uuid('demo-gov-ho-appt-1'),
    kind: 'PENDING_BOOKING',
    sourceId: uuid('appt-pablo-1'),
    detalle: 'Cita pendiente creada por Pablo',
  },
] as const;

/* ---- reinicio para las pruebas ---------------------------------------------------------------------------------- */

/** Vuelve todo el estado del gobierno de accesos a los datos de arranque (las pruebas corren con `isolate: false`). */
export function reiniciarGobierno(): void {
  for (const c of [
    metaDeVinculo,
    banderasDePacientes,
    reglasDeGobierno,
    ajustesDeGobierno,
    reglasSodDeLaOrganizacion,
    excepcionesSod,
    aprobaciones,
    campanas,
    itemsDeRevision,
    anomalias,
    casosDeCicloDeVida,
  ])
    c.reiniciar();
}
