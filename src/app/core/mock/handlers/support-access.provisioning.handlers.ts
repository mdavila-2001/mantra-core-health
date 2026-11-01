import {
  delegados,
  DOCTORES_POR_TENANT,
  vinculos,
  type DoctorSimulado,
  type FilaDelegado,
  type FilaVinculo,
} from '../fixtures/support-hospital';
import { forbidden, reply, type MockRouter } from '../mock-router';
import type { MockUser } from '../mock-session';
import { ahora, nuevoId } from '../mock-store';
import { anotar } from './support-access.core';
import { cuentas } from './support-staff.store';
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

    // Guardar cuenta en la colección persistente de cuentas de apoyo
    cuentas.agregar({
      id: userId,
      key: userId,
      email: payload.email,
      nationalId: payload.nationalId,
      displayName,
      personId,
    });

    const vinculo: FilaVinculo = {
      id: linkId,
      tenantId,
      ownerKind: 'PRIVATE_PRACTICE',
      userId,
      personName: displayName,
      personEmail: payload.email,
      roleTemplate: 'SECRETARY',
      status: 'ACTIVE',
      origin: 'INVITATION',
      validFrom: ahora(),
      recertifyEveryMonths: 12,
      nextRecertificationAt: ahora(),
    };
    vinculos.agregar(vinculo);

    // Crear delegado activo para el doctor
    const delegado: FilaDelegado = {
      id: nuevoId('delegado'),
      engagementId: linkId,
      doctorId: doctor?.id ?? 'doctor-default',
      status: 'ACTIVE',
      mayReplyOnBehalf: true,
      replyDisclosure: 'SHOW',
      acceptedAt: ahora(),
    };
    delegados.agregar(delegado);

    anotar(
      tenantId,
      doctor?.name ?? user.displayName,
      'support_staff.created_by_practitioner',
      `${user.displayName} creó y vinculó la cuenta de la secretaria ${displayName}.`,
      { doctorId: doctor?.id },
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
    const tenantId = request.headers.get('X-Tenant-Id') ?? 'tenant-hospital';
    const userId = nuevoId('user-sec-org');
    const personId = nuevoId('person-sec-org');
    const linkId = nuevoId('org-link');
    const displayName = `${payload.name} ${payload.lastName}`.trim();

    cuentas.agregar({
      id: userId,
      key: userId,
      email: payload.email,
      nationalId: payload.nationalId,
      displayName,
      personId,
    });

    // Crear vínculo activo de organización
    const vinculo: FilaVinculo = {
      id: linkId,
      tenantId,
      ownerKind: 'ORGANIZATION',
      userId,
      personName: displayName,
      personEmail: payload.email,
      roleTemplate: 'SECRETARY',
      status: 'ACTIVE',
      origin: 'INVITATION',
      validFrom: ahora(),
      recertifyEveryMonths: 12,
      nextRecertificationAt: ahora(),
    };
    vinculos.agregar(vinculo);

    anotar(
      tenantId,
      user.displayName,
      'support_staff.created_by_org',
      `La organización creó y vinculó la cuenta de la secretaria ${displayName}.`,
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
