import type {
  CatalogDoctor,
  CatalogService,
  DelegateReplyDisclosure,
  DoctorPlacement,
  ExpansionMode,
  LocationKind,
  LocationNode,
  SupportActionCode,
  SupportCatalog,
  SupportEngagementOrigin,
  SupportOwnerKind,
  SupportRequestItem,
  SupportRoleTemplateCode,
  SupportScopeTarget,
} from '../../data-access/support-access/support-access.types';
import { SUPPORT_TEMPLATE_DEFAULT_ACTIONS } from '../../data-access/support-access/support-access.types';
import { IDS, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO } from '../mock-session';
import { Coleccion, iso, uuid } from '../mock-store';
export type { FilaBitacora, FilaPermiso, FilaSolicitud, FilaVinculo } from './support-hospital.types';
import type { FilaBitacora, FilaPermiso, FilaSolicitud, FilaVinculo } from './support-hospital.types';
import { ATOMOS_SOBRE_PERMISOS_EXISTENTES, PERMISOS_DE_GOBIERNO, VINCULOS_DE_GOBIERNO } from './support-hospital-governance';
import { BITACORA_PARA_HISTORIA, PERMISOS_PARA_REVISION, SOLICITUDES_PARA_BANDEJA, VINCULOS_PARA_REVISION } from './support-hospital-review';

/* ============================================================================
    El **Hospital Piloto Mantra** (ficticio) para el diseño de «personal de
    apoyo». Es el escenario del contrato compartido (`CONTRATO.md`): una sede
    central con dos edificios, una sede norte, siete doctores y cuatro personas
    de apoyo con permisos distintos.

    Todo lo escrito acá es **sintético**. Los identificadores salen de
    `uuid(semilla)`, así que son estables entre recargas, y el estado que la
    pantalla modifica vive en `Coleccion`es que sobreviven a F5 dentro de la
    pestaña (a diferencia de los stubs de M29, que no devolvían nada).
    ========================================================================== */

/* ---- ubicaciones -------------------------------------------------------------- */

const nodos: LocationNode[] = [];
/** Los nodos por clave corta (`a-p1`, `a-p1-103`), para referirlos sin repetir ids. */
export const LOC: Record<string, LocationNode> = {};

function ubicacion(clave: string, kind: LocationKind, name: string, padre?: string): LocationNode {
  const id = uuid(`hp-loc-${clave}`);
  const parent = padre === undefined ? undefined : LOC[padre];
  const node: LocationNode = {
    id,
    kind,
    name,
    parentId: parent?.id ?? null,
    path: `${parent?.path ?? '/'}${id}/`,
  };
  nodos.push(node);
  LOC[clave] = node;
  return node;
}

ubicacion('central', 'SITE', 'Sede Central');
ubicacion('a', 'BUILDING', 'Edificio A', 'central');
ubicacion('a-pb', 'LEVEL', 'Planta baja · Admisión y emergencias', 'a');
ubicacion('a-p1', 'LEVEL', 'Piso 1 · Consulta externa', 'a');
for (let n = 101; n <= 108; n += 1) ubicacion(`a-p1-${n}`, 'CONSULTING_ROOM', `Consultorio ${n}`, 'a-p1');
ubicacion('a-p2', 'LEVEL', 'Piso 2 · Imagen y laboratorio', 'a');
ubicacion('a-p2-201', 'PROCEDURE_ROOM', 'Sala 201 · Ecografía', 'a-p2');
ubicacion('a-p2-202', 'PROCEDURE_ROOM', 'Sala 202 · Ecografía', 'a-p2');
ubicacion('a-p2-203', 'PROCEDURE_ROOM', 'Sala 203 · Rayos X', 'a-p2');
ubicacion('a-p2-204', 'PROCEDURE_ROOM', 'Sala 204 · Tomografía', 'a-p2');
ubicacion('a-p2-205', 'PROCEDURE_ROOM', 'Sala 205 · Toma de muestras', 'a-p2');
ubicacion('a-p3', 'LEVEL', 'Piso 3 · Quirófanos', 'a');
for (let n = 1; n <= 4; n += 1) ubicacion(`a-p3-q${n}`, 'OPERATING_ROOM', `Quirófano Q${n}`, 'a-p3');
ubicacion('a-p3-rec', 'PROCEDURE_ROOM', 'Recuperación', 'a-p3');
ubicacion('a-p4', 'LEVEL', 'Piso 4 · Internación', 'a');
for (let n = 401; n <= 420; n += 1) ubicacion(`a-p4-${n}`, 'BED', `Cama ${n}`, 'a-p4');
ubicacion('b', 'BUILDING', 'Edificio B', 'central');
ubicacion('b-p1', 'LEVEL', 'Piso 1 · Pediatría', 'b');
for (let n = 101; n <= 104; n += 1) ubicacion(`b-p1-b${n}`, 'CONSULTING_ROOM', `Consultorio B${n}`, 'b-p1');
ubicacion('b-p2', 'LEVEL', 'Piso 2 · Ginecología', 'b');
for (let n = 201; n <= 203; n += 1) ubicacion(`b-p2-b${n}`, 'CONSULTING_ROOM', `Consultorio B${n}`, 'b-p2');
ubicacion('b-p2-b204', 'PROCEDURE_ROOM', 'Sala B204 · Eco obstétrica', 'b-p2');
ubicacion('norte', 'SITE', 'Sede Norte');
ubicacion('n-p1', 'LEVEL', 'Piso 1 · Consulta externa', 'norte');
for (let n = 101; n <= 104; n += 1) ubicacion(`n-p1-n${n}`, 'CONSULTING_ROOM', `Consultorio N${n}`, 'n-p1');

export const UBICACIONES_HOSPITAL: readonly LocationNode[] = nodos;

/* ---- servicios y doctores ----------------------------------------------------- */

function servicio(clave: string, name: string): CatalogService {
  return { id: uuid(`hp-svc-${clave}`), name };
}

export const SVC = {
  consultaCardiologia: servicio('consulta-cardiologia', 'Consulta de cardiología'),
  ecocardiograma: servicio('ecocardiograma', 'Ecocardiograma'),
  consultaGinecologia: servicio('consulta-ginecologia', 'Consulta de ginecología'),
  ecoObstetrica: servicio('eco-obstetrica', 'Ecografía obstétrica'),
  cirugiaGinecologica: servicio('cirugia-ginecologica', 'Cirugía ginecológica'),
  consultaPediatria: servicio('consulta-pediatria', 'Consulta de pediatría'),
  consultaMedicinaInterna: servicio('consulta-medicina-interna', 'Consulta de medicina interna'),
  internacion: servicio('internacion', 'Internación'),
  consultaTraumatologia: servicio('consulta-traumatologia', 'Consulta de traumatología'),
  cirugiaTraumatologica: servicio('cirugia-traumatologica', 'Cirugía traumatológica'),
  ecografia: servicio('ecografia', 'Ecografía'),
  tomografia: servicio('tomografia', 'Tomografía'),
  consultaCirugiaGeneral: servicio('consulta-cirugia-general', 'Consulta de cirugía general'),
  cirugiaGeneral: servicio('cirugia-general', 'Cirugía general'),
} as const;

export const SERVICIOS_HOSPITAL: readonly CatalogService[] = Object.values(SVC);

function lugar(ubicacionClave: string, service: CatalogService): DoctorPlacement {
  return { careSpaceId: LOC[ubicacionClave]!.id, healthcareServiceId: service.id };
}

/** Un doctor del catálogo, más lo que sólo la maqueta necesita: su usuario y su perfil de chat. */
export interface DoctorSimulado extends CatalogDoctor {
  readonly tenantId: string;
  readonly userId?: string;
  readonly practitionerProfileId: string;
}

function doctor(
  clave: string,
  name: string,
  specialty: string,
  placements: readonly DoctorPlacement[],
  usuario?: { userId: string; practitionerProfileId: string },
): DoctorSimulado {
  return {
    id: uuid(`hp-doc-${clave}`),
    tenantId: TENANT_HOSPITAL_PILOTO,
    name,
    specialty,
    placements,
    practitionerProfileId: usuario?.practitionerProfileId ?? uuid(`hp-hpid-${clave}`),
    ...(usuario === undefined ? {} : { userId: usuario.userId }),
  };
}

export const DOCTORES_HOSPITAL: readonly DoctorSimulado[] = [
  doctor('perez', 'Dr. Andrés Pérez', 'Cardiología', [lugar('a-p1-103', SVC.consultaCardiologia), lugar('a-p2-201', SVC.ecocardiograma)], IDS.perez),
  doctor('rojas', 'Dra. Valeria Rojas', 'Ginecología', [
    lugar('b-p2-b201', SVC.consultaGinecologia),
    lugar('b-p2-b204', SVC.ecoObstetrica),
    lugar('a-p3-q1', SVC.cirugiaGinecologica),
  ]),
  doctor('suarez', 'Dr. Martín Suárez', 'Pediatría', [lugar('b-p1-b102', SVC.consultaPediatria), lugar('n-p1-n102', SVC.consultaPediatria)], IDS.suarez),
  doctor('mendez', 'Dra. Carla Méndez', 'Medicina interna', [lugar('a-p1-105', SVC.consultaMedicinaInterna), lugar('a-p4-401', SVC.internacion)]),
  doctor('vaca', 'Dr. Jorge Vaca', 'Traumatología', [lugar('a-p1-107', SVC.consultaTraumatologia), lugar('a-p3-q2', SVC.cirugiaTraumatologica)]),
  doctor('antelo', 'Dra. Lucía Antelo', 'Radiología', [lugar('a-p2-201', SVC.ecografia), lugar('a-p2-204', SVC.tomografia)]),
  doctor('flores', 'Dr. Diego Flores', 'Cirugía general', [lugar('n-p1-n101', SVC.consultaCirugiaGeneral), lugar('a-p3-q3', SVC.cirugiaGeneral)]),
];

export const DOC = Object.fromEntries(
  DOCTORES_HOSPITAL.map((d) => [d.id, d]),
) as Record<string, DoctorSimulado>;

function doctorPorClave(clave: string): DoctorSimulado {
  return DOCTORES_HOSPITAL.find((d) => d.id === uuid(`hp-doc-${clave}`))!;
}
export const PEREZ = doctorPorClave('perez');
export const ROJAS = doctorPorClave('rojas');
export const SUAREZ = doctorPorClave('suarez');
export const MENDEZ = doctorPorClave('mendez');
export const VACA = doctorPorClave('vaca');
export const ANTELO = doctorPorClave('antelo');
export const FLORES = doctorPorClave('flores');

export const CATALOGO_HOSPITAL: SupportCatalog = {
  organizationName: 'Hospital Piloto Mantra',
  doctors: DOCTORES_HOSPITAL.map(({ tenantId: _t, userId: _u, practitionerProfileId: _p, ...visible }) => visible),
  services: SERVICIOS_HOSPITAL,
  locations: UBICACIONES_HOSPITAL,
};

/* ---- el consultorio de la Dra. Céspedes (organización aparte) ------------------ */

export const CESPEDES_LOC = {
  sede: { id: uuid('cesp-loc-sede'), kind: 'SITE', name: 'Consultorio Céspedes', parentId: null, path: `/${uuid('cesp-loc-sede')}/` },
} satisfies Record<string, LocationNode>;
const CESPEDES_SALA: LocationNode = {
  id: uuid('cesp-loc-sala'),
  kind: 'CONSULTING_ROOM',
  name: 'Consultorio principal',
  parentId: CESPEDES_LOC.sede.id,
  path: `${CESPEDES_LOC.sede.path}${uuid('cesp-loc-sala')}/`,
};
export const SVC_CESPEDES = servicio('cesp-consulta', 'Consulta de dermatología');
export const CESPEDES: DoctorSimulado = {
  id: uuid('cesp-doc'),
  tenantId: TENANT_CESPEDES,
  name: 'Dra. Paola Céspedes',
  specialty: 'Dermatología',
  placements: [{ careSpaceId: CESPEDES_SALA.id, healthcareServiceId: SVC_CESPEDES.id }],
  practitionerProfileId: uuid('hpid-cespedes'),
};
export const CATALOGO_CESPEDES: SupportCatalog = {
  organizationName: 'Consultorio Dra. Paola Céspedes',
  doctors: [{ id: CESPEDES.id, name: CESPEDES.name, specialty: CESPEDES.specialty, placements: CESPEDES.placements }],
  services: [SVC_CESPEDES],
  locations: [CESPEDES_LOC.sede, CESPEDES_SALA],
};

/** Las dos organizaciones con apoyo, por tenant. */
export const CATALOGOS: Readonly<Record<string, SupportCatalog>> = {
  [TENANT_HOSPITAL_PILOTO]: CATALOGO_HOSPITAL,
  [TENANT_CESPEDES]: CATALOGO_CESPEDES,
};
export const DOCTORES_POR_TENANT: Readonly<Record<string, readonly DoctorSimulado[]>> = {
  [TENANT_HOSPITAL_PILOTO]: DOCTORES_HOSPITAL,
  [TENANT_CESPEDES]: [CESPEDES],
};

/* ---- filas de estado ----------------------------------------------------------- */

export interface FilaDelegado {
  readonly id: string;
  readonly engagementId: string;
  readonly doctorId: string;
  readonly status: 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'REVOKED';
  readonly mayReplyOnBehalf: boolean;
  readonly replyDisclosure: DelegateReplyDisclosure;
  readonly acceptedAt?: string;
}

export interface FilaAccesoClinico {
  readonly id: string;
  readonly doctorId: string;
  readonly engagementId: string;
  readonly patientLabel: string;
  readonly reasonText: string;
  readonly requestedAt: string;
  readonly requestedHours: number;
  readonly status: 'PENDING' | 'APPROVED' | 'DENIED';
}

export interface FilaInvitacion {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: 'PRACTITIONER' | 'SUPPORT_STAFF';
  readonly code: string;
  readonly targetPersonLabel?: string;
  /** La persona a la que va dirigida: con ella el código es de un solo uso y afilia directo; sin ella, el canje queda pendiente. */
  readonly targetPersonId?: string;
  readonly maxUses: number;
  readonly usesCount: number;
  readonly expiresAt: string;
  readonly roleTemplate?: SupportRoleTemplateCode;
  readonly status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  readonly createdAt: string;
}

export interface FilaAjusteAgenda {
  readonly id: string;
  readonly status: 'BOOKED' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'FREE';
  readonly patientLabel?: string;
  readonly reasonLabel?: string;
}

export interface FilaAsignacion {
  /** El id de la conversación. */
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly status: 'NEW' | 'TAKEN' | 'WAITING_DOCTOR' | 'RESOLVED';
  readonly assignedUserId?: string;
  /** Hasta cuándo debería tener respuesta (`sla_due_at`). */
  readonly slaDueAt?: string;
  /** Cuándo se resolvió: un mensaje posterior del paciente la reabre. */
  readonly resolvedAt?: string;
}

export interface FilaNota {
  readonly id: string;
  readonly conversationId: string;
  readonly authorUserId: string;
  readonly bodyText: string;
  readonly createdAt: string;
}

export interface FilaAutoria {
  readonly id: string;
  readonly authorUserId: string;
  readonly onBehalfOfProfileId: string;
  readonly disclosureShown: boolean;
}

function defaults(plantilla: SupportRoleTemplateCode): readonly SupportActionCode[] {
  return SUPPORT_TEMPLATE_DEFAULT_ACTIONS[plantilla];
}

function vinculo(
  clave: string,
  tenantId: string,
  ownerKind: SupportOwnerKind,
  persona: { userId: string },
  personName: string,
  personEmail: string,
  roleTemplate: SupportRoleTemplateCode,
  origin: SupportEngagementOrigin,
  diasDesdeAlta: number,
): FilaVinculo {
  return {
    id: uuid(`hp-eng-${clave}`),
    tenantId,
    ownerKind,
    userId: persona.userId,
    personName,
    personEmail,
    roleTemplate,
    status: 'ACTIVE',
    origin,
    validFrom: iso(-diasDesdeAlta),
    recertifyEveryMonths: 12,
    nextRecertificationAt: iso(365 - diasDesdeAlta),
  };
}

// La recertificación de Ana vence en 9 días: es el vínculo con el que se demuestra
// que la persona confirma el suyo antes de que se suspenda a los 15 días.
export const VINCULO_ANA: FilaVinculo = {
  ...vinculo('ana', TENANT_HOSPITAL_PILOTO, 'ORGANIZATION', IDS.ana, 'Ana Gutiérrez', 'ana.gutierrez@alovida.mock', 'SECRETARY', 'REQUEST', 60),
  nextRecertificationAt: iso(9),
};
export const VINCULO_LUCIA = vinculo('lucia', TENANT_HOSPITAL_PILOTO, 'ORGANIZATION', IDS.lucia, 'Lucía Paz', 'lucia.paz@alovida.mock', 'FRONT_DESK', 'INVITATION', 45);
export const VINCULO_MARCOS = vinculo('marcos', TENANT_HOSPITAL_PILOTO, 'ORGANIZATION', IDS.marcos, 'Marcos Ribera', 'marcos.ribera@alovida.mock', 'CALL_CENTER', 'QR', 30);
/**
 * Elena Camacho trabaja en **dos organizaciones**: secretaria de la agenda del
 * Dr. Pérez en el hospital y del consultorio de la Dra. Céspedes. Es la persona
 * con la que se ve la agenda combinada de varias organizaciones.
 */
export const VINCULO_ELENA_HOSPITAL = vinculo('elena-hospital', TENANT_HOSPITAL_PILOTO, 'ORGANIZATION', IDS.elena, 'Elena Camacho', 'elena.camacho@alovida.mock', 'SECRETARY', 'INVITATION', 20);
export const VINCULO_ELENA_CESPEDES = vinculo('elena-cespedes', TENANT_CESPEDES, 'PRIVATE_PRACTICE', IDS.elena, 'Elena Camacho', 'elena.camacho@alovida.mock', 'SECRETARY', 'INVITATION', 20);
export const VINCULO_ROSA = vinculo('rosa', TENANT_CESPEDES, 'PRIVATE_PRACTICE', IDS.rosa, 'Rosa Quiroga', 'rosa.quiroga@alovida.mock', 'SECRETARY', 'INVITATION', 90);

function permiso(
  vinculoDe: FilaVinculo,
  clave: string,
  objetivo: SupportScopeTarget,
  expansionMode: ExpansionMode = 'DYNAMIC',
): FilaPermiso {
  return {
    id: uuid(`hp-grant-${clave}`),
    engagementId: vinculoDe.id,
    ...objetivo,
    expansionMode,
    actions: defaults(vinculoDe.roleTemplate),
    status: 'ACTIVE',
  };
}

const deDoctor = (d: DoctorSimulado): SupportScopeTarget => ({
  targetKind: 'PRACTITIONER',
  practitionerRoleAssignmentId: d.id,
});

const PERMISOS_INICIALES: readonly FilaPermiso[] = [
  permiso(VINCULO_ANA, 'ana-perez', deDoctor(PEREZ)),
  permiso(VINCULO_ANA, 'ana-rojas', deDoctor(ROJAS)),
  permiso(VINCULO_LUCIA, 'lucia-a-p1', { targetKind: 'LOCATION', careSpaceId: LOC['a-p1']!.id }),
  permiso(VINCULO_MARCOS, 'marcos-eco', { targetKind: 'SERVICE', healthcareServiceId: SVC.ecografia.id }),
  permiso(VINCULO_MARCOS, 'marcos-suarez-norte', {
    targetKind: 'PRACTITIONER_LOCATION',
    practitionerRoleAssignmentId: SUAREZ.id,
    practiceSiteId: LOC['norte']!.id,
  }),
  permiso(VINCULO_ROSA, 'rosa-cespedes', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: CESPEDES.id }),
  permiso(VINCULO_ELENA_HOSPITAL, 'elena-perez', deDoctor(PEREZ)),
  permiso(VINCULO_ELENA_CESPEDES, 'elena-cespedes', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: CESPEDES.id }),
];

/** Id estable de la relación persona↔doctor, para que el doctor pueda actuar sobre ella. */
export function delegadoId(engagementId: string, doctorId: string): string {
  return uuid(`hp-delegate-${engagementId}-${doctorId}`);
}

function delegado(
  vinculoDe: FilaVinculo,
  d: DoctorSimulado,
  mayReplyOnBehalf: boolean,
  replyDisclosure: DelegateReplyDisclosure = 'SHOW',
): FilaDelegado {
  return {
    id: delegadoId(vinculoDe.id, d.id),
    engagementId: vinculoDe.id,
    doctorId: d.id,
    status: 'ACTIVE',
    mayReplyOnBehalf,
    replyDisclosure,
    acceptedAt: iso(-40),
  };
}

const DELEGADOS_INICIALES: readonly FilaDelegado[] = [
  delegado(VINCULO_ANA, PEREZ, true, 'SHOW'),
  delegado(VINCULO_ANA, ROJAS, false, 'SHOW'),
  delegado(VINCULO_ROSA, CESPEDES, true, 'HIDE'),
  delegado(VINCULO_ELENA_HOSPITAL, PEREZ, false, 'SHOW'),
  delegado(VINCULO_ELENA_CESPEDES, CESPEDES, false, 'SHOW'),
];

const TODAS_LAS_ACCIONES_SECRETARIA = defaults('SECRETARY');

function itemSolicitud(
  clave: string,
  objetivo: SupportScopeTarget,
  proposedActions: readonly SupportActionCode[],
): SupportRequestItem {
  return { id: uuid(`hp-item-${clave}`), ...objetivo, proposedActions, decision: 'PENDING' };
}

const SOLICITUDES_INICIALES: readonly FilaSolicitud[] = [
  {
    // La solicitud del recorrido de la demostración: Ana pide **ampliar** su
    // vínculo a dos doctores más; la organización aprueba uno y rechaza el
    // otro, y el doctor aprobado la acepta desde «Mi equipo».
    id: uuid('hp-req-ana-ampliacion'),
    tenantId: TENANT_HOSPITAL_PILOTO,
    requesterUserId: IDS.ana.userId,
    requesterName: 'Ana Gutiérrez',
    direction: 'REQUEST',
    roleTemplate: 'SECRETARY',
    parentEngagementId: VINCULO_ANA.id,
    message: 'Cubro también la agenda de pediatría y de traumatología porque se fue una compañera.',
    status: 'PENDING',
    expiresAt: iso(13),
    createdAt: iso(-2),
    items: [
      itemSolicitud('ana-suarez', deDoctor(SUAREZ), TODAS_LAS_ACCIONES_SECRETARIA),
      itemSolicitud('ana-vaca', deDoctor(VACA), TODAS_LAS_ACCIONES_SECRETARIA),
    ],
  },
  {
    id: uuid('hp-req-julia-enfermeria'),
    tenantId: TENANT_HOSPITAL_PILOTO,
    requesterUserId: uuid('user-julia-mamani'),
    requesterName: 'Julia Mamani',
    direction: 'REQUEST',
    roleTemplate: 'NURSING',
    message: 'Soy enfermera de internación y necesito ver quién llega al piso 4.',
    status: 'PENDING',
    expiresAt: iso(10),
    createdAt: iso(-5),
    items: [itemSolicitud('julia-p4', { targetKind: 'LOCATION', careSpaceId: LOC['a-p4']!.id }, defaults('NURSING'))],
  },
];

const ACCESOS_CLINICOS_INICIALES: readonly FilaAccesoClinico[] = [
  {
    id: uuid('hp-clin-ana-perez-1'),
    doctorId: PEREZ.id,
    engagementId: VINCULO_ANA.id,
    patientLabel: 'Paciente M. R. · CI ***456',
    reasonText: 'Necesito el informe del último electrocardiograma para adjuntarlo a la autorización del seguro.',
    requestedAt: iso(-1, 16),
    requestedHours: 24,
    status: 'PENDING',
  },
];

const INVITACIONES_INICIALES: readonly FilaInvitacion[] = [
  {
    id: uuid('hp-inv-personal'),
    tenantId: TENANT_HOSPITAL_PILOTO,
    kind: 'SUPPORT_STAFF',
    code: 'Qm7vK2xTb9LrW4zYp1nDf8aHc5UeJ3oS',
    targetPersonLabel: 'Personal de recepción (varios usos)',
    maxUses: 20,
    usesCount: 3,
    expiresAt: iso(25),
    roleTemplate: 'FRONT_DESK',
    status: 'ACTIVE',
    createdAt: iso(-5),
  },
  {
    id: uuid('hp-inv-flores'),
    tenantId: TENANT_HOSPITAL_PILOTO,
    kind: 'PRACTITIONER',
    code: 'tZ6hN0cXw3GdR8yVkP2sBj5LmQa9Fe4U',
    targetPersonLabel: 'Dr. Diego Flores',
    targetPersonId: uuid('hp-persona-diego-flores'),
    maxUses: 1,
    usesCount: 0,
    expiresAt: iso(14),
    status: 'ACTIVE',
    createdAt: iso(-1),
  },
];

const BITACORA_INICIAL: readonly FilaBitacora[] = [
  { id: uuid('hp-act-1'), tenantId: TENANT_HOSPITAL_PILOTO, occurredAt: iso(0, 8, 42), actorName: 'Ana Gutiérrez', action: 'schedule.create', summary: 'Creó una cita con el Dr. Andrés Pérez.', doctorId: PEREZ.id, patientLabel: 'Paciente C. M.' },
  { id: uuid('hp-act-2'), tenantId: TENANT_HOSPITAL_PILOTO, occurredAt: iso(0, 8, 15), actorName: 'Lucía Paz', action: 'schedule.check_in', summary: 'Registró la llegada de un paciente de la Dra. Carla Méndez.', doctorId: MENDEZ.id, patientLabel: 'Paciente R. M.' },
  { id: uuid('hp-act-3'), tenantId: TENANT_HOSPITAL_PILOTO, occurredAt: iso(-1, 17, 5), actorName: 'Marcos Ribera', action: 'schedule.create', summary: 'Agendó una ecografía con la Dra. Lucía Antelo.', doctorId: ANTELO.id, patientLabel: 'Paciente L. V.' },
  { id: uuid('hp-act-4'), tenantId: TENANT_HOSPITAL_PILOTO, occurredAt: iso(-2, 10, 30), actorName: 'Ana Gutiérrez', action: 'messages.reply_on_behalf', summary: 'Respondió un mensaje administrativo en nombre del Dr. Andrés Pérez.', doctorId: PEREZ.id },
  { id: uuid('hp-act-5'), tenantId: TENANT_HOSPITAL_PILOTO, occurredAt: iso(-3, 9, 0), actorName: 'Hospital Piloto Mantra', action: 'engagement.created', summary: 'Se aprobó el vínculo de Marcos Ribera (call center).' },
];

/* ---- las colecciones: estado en memoria que sobrevive a F5 --------------------- */

export const vinculos = new Coleccion<FilaVinculo>([
  VINCULO_ANA,
  VINCULO_LUCIA,
  VINCULO_MARCOS,
  VINCULO_ROSA,
  VINCULO_ELENA_HOSPITAL,
  VINCULO_ELENA_CESPEDES,
  ...VINCULOS_PARA_REVISION,
  ...VINCULOS_DE_GOBIERNO,
]).persistirEn('mock.apoyo.vinculos');
export const permisos = new Coleccion<FilaPermiso>([...PERMISOS_INICIALES, ...PERMISOS_PARA_REVISION, ...PERMISOS_DE_GOBIERNO].map((p) => ({ ...p, ...(ATOMOS_SOBRE_PERMISOS_EXISTENTES.get(p.id) ?? {}) }))).persistirEn('mock.apoyo.permisos');
export const delegados = new Coleccion<FilaDelegado>(DELEGADOS_INICIALES).persistirEn('mock.apoyo.delegados');
export const solicitudes = new Coleccion<FilaSolicitud>([...SOLICITUDES_INICIALES, ...SOLICITUDES_PARA_BANDEJA]).persistirEn('mock.apoyo.solicitudes');
export const accesosClinicos = new Coleccion<FilaAccesoClinico>(ACCESOS_CLINICOS_INICIALES).persistirEn('mock.apoyo.accesos-clinicos');
export const invitaciones = new Coleccion<FilaInvitacion>(INVITACIONES_INICIALES).persistirEn('mock.apoyo.invitaciones');
export const bitacora = new Coleccion<FilaBitacora>([...BITACORA_INICIAL, ...BITACORA_PARA_HISTORIA]).persistirEn('mock.apoyo.bitacora');
export const ajustesDeAgenda = new Coleccion<FilaAjusteAgenda>([]).persistirEn('mock.apoyo.agenda');
export const asignaciones = new Coleccion<FilaAsignacion>([]).persistirEn('mock.apoyo.asignaciones');
export const notasInternas = new Coleccion<FilaNota>([]).persistirEn('mock.apoyo.notas');
export const autorias = new Coleccion<FilaAutoria>([]).persistirEn('mock.apoyo.autorias');

/** Alguien anotado en la lista de espera de un horario, desde la agenda combinada. */
export interface FilaEspera {
  readonly id: string;
  /** El horario (`bookable_slot_id`) desde el que se anotó. */
  readonly slotId: string;
  readonly patientLabel: string;
  readonly createdAt: string;
}
export const esperasDeApoyo = new Coleccion<FilaEspera>([]).persistirEn('mock.apoyo.esperas');
