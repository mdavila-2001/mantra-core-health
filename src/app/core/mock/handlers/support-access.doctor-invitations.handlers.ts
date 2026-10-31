import type { SupportInvitationLink } from '../../data-access/support-access/support-invite.types';
import { delegados, delegadoId, DOCTORES_POR_TENANT, permisos, vinculos, type DoctorSimulado } from '../fixtures/support-hospital';
import { forbidden, isMockReply, reply, validation, type MockRouter, type ValidationIssue } from '../mock-router';
import { MOCK_USERS, TENANT_NAMES, type MockUser } from '../mock-session';
import { ahora, Coleccion, cuerpo, nuevoId } from '../mock-store';
import { anotar } from './support-access.core';
import { conMotivo } from './support-access.errors';

/* ============================================================================
    «Invitar a una secretaria»: el doctor ofrece, la secretaria decide.

    `POST /me/practitioner/support-invitations` crea un vínculo **pendiente** que espera a la
    secretaria (`initiatedBy: 'PRACTITIONER'`, `awaiting: 'SUPPORT_STAFF'`), como
    `SupportStaffService.inviteForPractitioner` de la API. No concede nada: ningún permiso, ningún
    delegado activo. La invitación aparece luego en `GET /me/practitioner/support-team`, que acá se
    envuelve para sumarla, y sobrevive a F5 como el resto del estado de apoyo.
   ========================================================================== */

/** Una invitación del doctor a una secretaria, mientras la secretaria no responde. */
export interface FilaInvitacionDelDoctor {
  readonly id: string;
  /** La vinculación del doctor con el hospital (`practitioner_role_assignment_id`). */
  readonly doctorId: string;
  readonly tenantId: string;
  /** La secretaria invitada. */
  readonly userId: string;
  readonly personName: string;
  readonly status: 'PENDING';
  readonly createdAt: string;
}

export const invitacionesDelDoctor = new Coleccion<FilaInvitacionDelDoctor>([]).persistirEn('mock.apoyo.invitaciones-del-doctor');

/** `NATIONAL_ID_PATTERN` de la API: letras, dígitos, punto y guion. */
const PATRON_DOCUMENTO = /^[A-Za-z0-9.-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVES_DEL_DTO: readonly string[] = ['nationalId', 'practitionerRoleAssignmentId'];

/** Las vinculaciones del doctor con un hospital que este simulador conoce, las de su cuenta. */
function vinculacionesDe(user: MockUser): DoctorSimulado[] {
  return Object.values(DOCTORES_POR_TENANT)
    .flat()
    .filter((d) => d.userId === user.id);
}

/** `PractitionerInviteSupportDto` con los mensajes de `class-validator`; la API además prohíbe las claves de más. */
function problemasDelCuerpo(datos: Readonly<Record<string, unknown>>): ValidationIssue[] {
  const problemas: ValidationIssue[] = [];
  for (const clave of Object.keys(datos)) {
    if (!CLAVES_DEL_DTO.includes(clave)) problemas.push({ field: clave, message: 'should not exist' });
  }
  const documento = datos['nationalId'];
  if (typeof documento !== 'string') problemas.push({ field: 'nationalId', message: 'must be a string' });
  else {
    if (documento.length < 4) problemas.push({ field: 'nationalId', message: 'must be longer than or equal to 4 characters' });
    if (documento.length > 40) problemas.push({ field: 'nationalId', message: 'must be shorter than or equal to 40 characters' });
    if (!PATRON_DOCUMENTO.test(documento)) problemas.push({ message: 'El documento sólo admite letras, dígitos, punto y guion' });
  }
  const vinculacion = datos['practitionerRoleAssignmentId'];
  if (typeof vinculacion !== 'string' || !UUID.test(vinculacion)) problemas.push({ field: 'practitionerRoleAssignmentId', message: 'must be a UUID' });
  return problemas;
}

/**
 * La secretaria registrada con ese documento, por coincidencia exacta del texto enviado: la API busca por
 * `external_subject = ?` con el `nationalId` tal cual, sin normalizarlo (`support-links.repository.ts`).
 */
function secretariaConDocumento(documento: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.roles.includes('SUPPORT_STAFF') && u.nationalId === documento);
}

/** Si la secretaria ya tiene un vínculo vivo (pendiente o activo) con esa vinculación del doctor. */
function yaTieneVinculoVivo(secretaria: MockUser, doctor: DoctorSimulado): boolean {
  if (invitacionesDelDoctor.filtrar((i) => i.userId === secretaria.id && i.doctorId === doctor.id && i.status === 'PENDING').length > 0) return true;
  const delegado = (engagementId: string) => delegados.get(delegadoId(engagementId, doctor.id));
  return vinculos
    .filtrar((v) => v.userId === secretaria.id && v.tenantId === doctor.tenantId && v.status === 'ACTIVE')
    .some((v) => {
      const cubreAlDoctor = permisos.filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE' && p.targetKind === 'PRACTITIONER' && p.practitionerRoleAssignmentId === doctor.id).length > 0;
      return cubreAlDoctor && delegado(v.id)?.status !== 'REVOKED';
    });
}

/** El vínculo como lo cuenta la API (`SupportLinkViewDto`). */
function vistaDelVinculo(fila: FilaInvitacionDelDoctor): SupportInvitationLink {
  const doctor = Object.values(DOCTORES_POR_TENANT)
    .flat()
    .find((d) => d.id === fila.doctorId);
  return {
    id: fila.id,
    kind: 'PRACTITIONER',
    targetKind: 'PRACTITIONER',
    tenantId: fila.tenantId,
    organizationName: TENANT_NAMES[fila.tenantId] ?? null,
    userId: fila.userId,
    personName: fila.personName,
    status: fila.status,
    initiatedBy: 'PRACTITIONER',
    awaiting: 'SUPPORT_STAFF',
    practiceSiteId: null,
    clinicalUnitId: null,
    careSpaceId: null,
    practitionerRoleAssignmentId: fila.doctorId,
    practitionerProfileId: doctor?.practitionerProfileId ?? null,
    targetName: doctor?.name ?? null,
    createdAt: fila.createdAt,
  };
}

/**
 * La invitación como integrante de «Mi equipo»: con la forma de `DoctorTeamMember` más `initiatedBy` y `awaiting`, que
 * son los que dicen que **es la secretaria quien tiene que decidir**. Sin permisos ni acciones: todavía no puede nada.
 */
function integranteDelEquipo(fila: FilaInvitacionDelDoctor): Record<string, unknown> {
  const organizacion = TENANT_NAMES[fila.tenantId] ?? 'Organización';
  return {
    delegateId: fila.id,
    userId: fila.userId,
    personName: fila.personName,
    practitionerRoleAssignmentId: fila.doctorId,
    tenantId: fila.tenantId,
    organizationName: organizacion,
    roleTemplateCode: 'SECRETARY',
    roleTemplate: 'SECRETARY',
    status: 'PENDING_ACCEPTANCE',
    delegateStatus: 'ACTIVE',
    accepted: false,
    mayReplyOnBehalf: false,
    replyDisclosure: 'SHOW',
    actions: [],
    coverageSummary: `La invitó a asistirlo en ${organizacion}. Hasta que ella acepte, no puede actuar sobre su agenda.`,
    pendingClinicalRequests: [],
    initiatedBy: 'PRACTITIONER',
    awaiting: 'SUPPORT_STAFF',
    createdAt: fila.createdAt,
  };
}

export function registrarApoyoInvitacionesDelDoctor(router: MockRouter): void {
  router.post('/me/practitioner/support-invitations', (request) => {
    const user = request.user;
    if (user === null) return reply(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sin sesión', error: 'Unauthorized' });
    if (!user.roles.includes('PRACTITIONER') && !user.roles.includes('CLINICIAN')) return forbidden('Esto es para quien atiende.');

    const datos = cuerpo<Record<string, unknown>>(request) as Readonly<Record<string, unknown>>;
    const problemas = problemasDelCuerpo(datos);
    if (problemas.length > 0) return validation('Error de validación', problemas);

    // Una vinculación ajena responde igual que una inexistente.
    const doctor = vinculacionesDe(user).find((d) => d.id === datos['practitionerRoleAssignmentId']);
    if (doctor === undefined) return conMotivo(404, 'Vinculación no encontrada', 'SUPPORT_TARGET_NOT_FOUND');
    const secretaria = secretariaConDocumento(datos['nationalId'] as string);
    if (secretaria === undefined) return conMotivo(404, 'No hay una secretaria registrada con ese documento', 'SUPPORT_STAFF_NOT_FOUND');
    if (yaTieneVinculoVivo(secretaria, doctor)) return conMotivo(409, 'Ya hay un vínculo vivo con ese mismo objetivo', 'SUPPORT_LINK_DUPLICATE');

    const fila = invitacionesDelDoctor.agregar({
      id: nuevoId('invitacion-del-doctor'),
      doctorId: doctor.id,
      tenantId: doctor.tenantId,
      userId: secretaria.id,
      personName: secretaria.displayName,
      status: 'PENDING',
      createdAt: ahora(),
    });
    anotar(doctor.tenantId, doctor.name, 'support_staff.invited_by_practitioner', `${doctor.name} invitó a ${secretaria.displayName} a asistirlo.`, { doctorId: doctor.id });
    // `SupportLinksCreatedDto`: el id del primer vínculo, la organización y los vínculos creados.
    return { status: 201, body: { id: fila.id, tenantId: fila.tenantId, items: [vistaDelVinculo(fila)] } };
  });

  // «Mi equipo» también cuenta lo que el doctor ofreció y la secretaria todavía no respondió.
  router.wrap('GET', '/me/practitioner/support-team', (request, siguiente) => {
    const respuesta = siguiente(request);
    const user = request.user;
    if (user === null || (isMockReply(respuesta) && respuesta.status !== 200)) return respuesta;
    const cuerpoOriginal = (isMockReply(respuesta) ? respuesta.body : respuesta) as { items?: readonly unknown[] };
    const propias = new Set(vinculacionesDe(user).map((d) => d.id));
    const pendientes = invitacionesDelDoctor
      .filtrar((i) => i.status === 'PENDING' && propias.has(i.doctorId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(integranteDelEquipo);
    return { ...cuerpoOriginal, items: [...(cuerpoOriginal.items ?? []), ...pendientes] };
  });
}
