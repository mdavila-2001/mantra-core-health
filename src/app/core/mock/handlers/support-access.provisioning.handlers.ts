import { delegados, DOCTORES_POR_TENANT, vinculos, type DoctorSimulado } from '../fixtures/support-hospital';
import { forbidden, reply, type MockRouter } from '../mock-router';
import { MOCK_USERS, type MockUser } from '../mock-session';
import { ahora, nuevoId } from '../mock-store';
import { anotar } from './support-access.core';
import type {
  CreateOrgSecretaryPayload,
  CreatePractitionerSecretaryPayload,
  CreatedSupportStaffResponse,
} from '../../data-access/support-access/support-provisioning.types';

function vinculacionesDe(user: MockUser): DoctorSimulado[] {
  const todas = Object.values(DOCTORES_POR_TENANT).flat();
  return todas.filter((d) => d.userId === user.id);
}

/**
 * Simulador de creación directa de cuentas de secretaria para Doctor y Hospital.
 */
export function instalarProvisioningHandlers(router: MockRouter): void {
  // 1. El Doctor crea una secretaria y la vincula de inmediato a su práctica
  router.post('/me/practitioner/support-staff', (request) => {
    const user = request.user;
    if (user === null) {
      return reply(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sin sesión' });
    }
    if (!user.roles.includes('PRACTITIONER') && !user.roles.includes('CLINICIAN')) {
      return forbidden('Solo los profesionales de salud pueden crear secretarias');
    }

    const payload = request.body as CreatePractitionerSecretaryPayload;
    const doctor = vinculacionesDe(user).find(
      (d) => d.id === payload.practitionerRoleAssignmentId,
    ) ?? vinculacionesDe(user)[0];

    const tenantId = doctor?.tenantId ?? 'tenant-hospital';
    const userId = nuevoId('user-sec');
    const personId = nuevoId('person-sec');
    const linkId = nuevoId('prac-link');
    const displayName = `${payload.name} ${payload.lastName}`.trim();

    // Guardar usuario en sesión simulada
    MOCK_USERS[payload.nationalId] = {
      id: userId,
      displayName,
      email: payload.email,
      roles: ['USER', 'SUPPORT_STAFF'],
      organizationAccess: [tenantId],
    };

    // Crear delegado activo para el doctor
    delegados.agregar({
      id: nuevoId('delegado'),
      supportUserId: userId,
      personName: displayName,
      roleTemplate: 'RECEPTION',
      status: 'ACTIVE',
      mayReplyOnBehalf: true,
      replyDisclosure: 'SHOW',
      coverageSummary: `Agenda de ${doctor?.name ?? 'su consulta'}`,
      grants: [],
      lastActivityAt: ahora(),
      acceptedAt: ahora(),
      origin: 'DOCTOR_ACCEPTED',
      pendingClinicalRequests: [],
    });

    anotar(
      tenantId,
      doctor?.name ?? user.displayName,
      'support_staff.created_by_practitioner',
      `${user.displayName} creó y vinculó la cuenta de la secretaria ${displayName}.`,
      { doctorId: doctor?.id, secretaryId: userId },
    );

    const respuesta: CreatedSupportStaffResponse = {
      userId,
      personId,
      supportProfileId: personId,
      linkId,
      status: 'ACTIVE',
      organizationName: doctor?.name,
    };

    return reply(201, respuesta);
  });

  // 2. La Organización crea una secretaria y la vincula de inmediato a la institución
  router.post('/org/support-staff', (request) => {
    const user = request.user;
    if (user === null) {
      return reply(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sin sesión' });
    }

    const payload = request.body as CreateOrgSecretaryPayload;
    const tenantId = request.tenantId ?? 'tenant-hospital';
    const userId = nuevoId('user-sec-org');
    const personId = nuevoId('person-sec-org');
    const linkId = nuevoId('org-link');
    const displayName = `${payload.name} ${payload.lastName}`.trim();

    MOCK_USERS[payload.nationalId] = {
      id: userId,
      displayName,
      email: payload.email,
      roles: ['USER', 'SUPPORT_STAFF'],
      organizationAccess: [tenantId],
    };

    // Crear vínculo activo de organización
    vinculos.agregar({
      id: linkId,
      tenantId,
      supportUserId: userId,
      supportPersonId: personId,
      personName: displayName,
      roleTemplate: 'RECEPTION',
      status: 'ACTIVE',
      origin: 'ORGANIZATION',
      grants: [],
      acceptedAt: ahora(),
      lastActivityAt: ahora(),
      pendingRecertification: false,
    });

    anotar(
      tenantId,
      user.displayName,
      'support_staff.created_by_org',
      `La organización creó y vinculó la cuenta de la secretaria ${displayName}.`,
      { secretaryId: userId },
    );

    const respuesta: CreatedSupportStaffResponse = {
      userId,
      personId,
      supportProfileId: personId,
      linkId,
      status: 'ACTIVE',
    };

    return reply(201, respuesta);
  });
}
