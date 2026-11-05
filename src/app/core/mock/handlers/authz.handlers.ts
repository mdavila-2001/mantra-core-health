import { KINSHIP, STATUS } from '../fixtures/concepts';
import { PROFESSIONALS, patientById, professionalById } from '../fixtures/people';
import {
  conflict,
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  unauthorized,
  type MockRouter,
} from '../mock-router';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, cuerpo, nuevoId, uuid } from '../mock-store';
import {
  CARE_RELATIONSHIP_TYPE,
  careRelationships,
  clinicalGrants,
  legalRepresentations,
  type SimulatedCareRelationship,
} from './authz.store';

/* ============================================================================
    `authz` routes over care relationships, legal representations and
    clinical grants (moved out of `misc.handlers.ts`). The unified inbox and
    the access by specialty are in `access-requests.handlers.ts`.
    ========================================================================== */

/** The 409 reasons the request screens branch on (never on the message). */
export const ALREADY_ACTIVE = 'CARE_RELATIONSHIP_ALREADY_ACTIVE';
export const ALREADY_PENDING = 'CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING';

/**
 * The 409 for a duplicate between the same patient and practitioner, of the
 * same relationship type: an active primary practitioner does not block a
 * request for a care episode, and vice versa.
 */
export function duplicateConflict(patientProfileId: string, practitionerProfileId: string, typeConceptId: string) {
  const same = careRelationships.filtrar(
    (r) =>
      r.patientProfileId === patientProfileId &&
      r.practitionerProfileId === practitionerProfileId &&
      r.relationshipTypeConceptId === typeConceptId,
  );
  if (same.some((r) => r.statusConceptId === STATUS['ST-ACTIVE'])) {
    return conflict('Ya existe una relación activa con esa persona', { reason: ALREADY_ACTIVE });
  }
  if (same.some((r) => r.statusConceptId === STATUS['ST-PENDING'])) {
    return conflict('Ya existe una solicitud pendiente con esa persona', { reason: ALREADY_PENDING });
  }
  return null;
}

function readableState(statusConceptId: string, validTo: string | null): 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'OTHER' {
  if (statusConceptId === STATUS['ST-REVOKED']) return 'REVOKED';
  if (statusConceptId === STATUS['ST-ACTIVE']) {
    return validTo !== null && Date.parse(validTo) <= Date.now() ? 'EXPIRED' : 'ACTIVE';
  }
  return 'OTHER';
}

function careRelationshipView(r: SimulatedCareRelationship) {
  return {
    id: r.id,
    patientProfileId: r.patientProfileId,
    practitionerProfileId: r.practitionerProfileId,
    relationshipTypeConceptId: r.relationshipTypeConceptId,
    statusConceptId: r.statusConceptId,
    purposeConceptId: r.purposeConceptId,
    validFrom: r.validFrom,
    validTo: r.validTo,
  };
}

export function registerAuthz(router: MockRouter): void {
  /* ---- «Quién ve mi historia» (BR-20): only the patient, from the session -- */

  router.get('/authz/me/access', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const pid = user.patientProfileId ?? '';
    if (pid === '') return forbidden('Esta sección es para pacientes');
    return {
      // Pending and rejected requests never granted access: they live in the inbox.
      careRelationships: careRelationships
        .filtrar(
          (r) =>
            r.patientProfileId === pid &&
            r.statusConceptId !== STATUS['ST-PENDING'] &&
            r.statusConceptId !== STATUS['ST-REJECTED'],
        )
        .map((r) => ({
          id: r.id,
          tenantId: r.tenantId,
          practitionerProfileId: r.practitionerProfileId,
          practitionerName: professionalById(r.practitionerProfileId)?.displayName,
          state: readableState(r.statusConceptId, r.validTo),
          validFrom: r.validFrom,
          validTo: r.validTo ?? undefined,
        })),
      grants: clinicalGrants
        .filtrar((a) => a.patientProfileId === pid)
        .map((a) => ({
          id: a.id,
          tenantId: a.tenantId,
          grantedUserId: a.grantedUserId,
          grantedName: PROFESSIONALS.find((p) => p.userId === a.grantedUserId)?.displayName,
          isEmergency: a.isEmergency,
          state: readableState(a.stateConceptId, a.validTo),
          validFrom: a.validFrom,
          validTo: a.validTo,
          reasonConceptId: uuid('concept-reason'),
          accessLevelConceptId: uuid('concept-access-level'),
        })),
    };
  });

  router.post('/authz/me/care-relationships/:id/revoke', ({ params, user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const r = careRelationships.get(params['id']!);
    // Someone else's or missing is 404: existence is not revealed.
    if (r === undefined || r.patientProfileId !== user.patientProfileId) return notFound('Relación asistencial no encontrada');
    if (r.statusConceptId === STATUS['ST-PENDING']) {
      return preconditionFailed('La solicitud sigue pendiente: respóndala en lugar de revocarla');
    }
    if (r.statusConceptId !== STATUS['ST-ACTIVE']) return preconditionFailed('La relación asistencial no está activa');
    careRelationships.actualizar(r.id, { statusConceptId: STATUS['ST-REVOKED']!, validTo: ahora() });
    return { ok: true, affected: 1 };
  });

  router.post('/authz/me/clinical-access-grants/:grantId/revoke', ({ params, user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const a = clinicalGrants.get(params['grantId']!);
    if (a === undefined || a.patientProfileId !== user.patientProfileId) return notFound('Acceso clínico no encontrado');
    if (a.stateConceptId !== STATUS['ST-ACTIVE']) return preconditionFailed('El acceso clínico no está activo');
    clinicalGrants.actualizar(a.id, { stateConceptId: STATUS['ST-REVOKED']!, validTo: ahora() });
    return { ok: true, affected: 1 };
  });

  /**
   * `POST /authz/patients/:id/break-the-glass`: only `CLINICAL_APPROVER` or
   * `SECURITY_ADMIN`; without a 10-character justification, 400 and nothing is created.
   */
  router.post('/authz/patients/:patientProfileId/break-the-glass', (request) => {
    const user = request.user;
    if (user === null) return unauthorized('Sesión vencida');
    if (!['CLINICAL_APPROVER', 'SECURITY_ADMIN', 'SUPERADMIN'].some((role) => user.roles.includes(role))) {
      return forbidden('Rol insuficiente para la operación');
    }
    const body = cuerpo<{ tenantId?: string; justification?: string; windowMinutes?: number }>(request);
    if ((body.justification ?? '').trim().length < 10) {
      // Like the API: the DTO fails validation and answers 400, creating nothing.
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'La justificación es obligatoria (al menos 10 caracteres)',
        error: 'Bad Request',
        details: { issues: [{ field: 'justification', message: 'La justificación debe tener al menos 10 caracteres' }] },
      });
    }
    const created = clinicalGrants.agregar({
      id: nuevoId('clinical-grant-emergencia'),
      tenantId: body.tenantId ?? TENANT_CLINICA,
      patientProfileId: request.params['patientProfileId']!,
      grantedUserId: user.id,
      isEmergency: true,
      stateConceptId: STATUS['ST-ACTIVE']!,
      validFrom: ahora(),
      validTo: new Date(Date.now() + (body.windowMinutes ?? 60) * 60_000).toISOString(),
    });
    return { status: 201, body: { id: created.id, status: 'ACTIVE', createdAt: created.validFrom } };
  });

  router.get('/authz/care-relationships', ({ query }) => {
    const patient = query.get('patientProfileId');
    return careRelationships
      .filtrar((r) => patient === null || r.patientProfileId === patient)
      .map(careRelationshipView);
  });
  router.post('/authz/care-relationships', (request) => {
    const body = cuerpo<{
      tenantId: string;
      patientProfileId: string;
      practitionerProfileId: string;
      relationshipType?: string;
      validTo?: string;
    }>(request);
    const created = careRelationships.agregar({
      id: nuevoId('care-rel'),
      tenantId: body.tenantId ?? TENANT_CLINICA,
      patientProfileId: body.patientProfileId ?? '',
      practitionerProfileId: body.practitionerProfileId ?? '',
      relationshipTypeConceptId:
        body.relationshipType === 'CONSULTING' ? CARE_RELATIONSHIP_TYPE.CONSULTING : CARE_RELATIONSHIP_TYPE.TREATING,
      statusConceptId: STATUS['ST-ACTIVE']!,
      purposeConceptId: null,
      validFrom: ahora(),
      validTo: body.validTo ?? null,
      reasonText: null,
    });
    return { status: 201, body: { id: created.id, status: 'ACTIVE', createdAt: created.validFrom } };
  });
  router.post('/authz/care-relationships/:id/revoke', ({ params }) => {
    const r = careRelationships.get(params['id']!);
    if (r === undefined) return notFound('Relación no encontrada');
    careRelationships.actualizar(r.id, { statusConceptId: STATUS['ST-REVOKED']!, validTo: ahora() });
    return { ok: true, affected: 1 };
  });

  /** The practitioner asks: a care episode by default, `PRIMARY` to be the primary practitioner. */
  router.post('/authz/care-relationships/request', (request) => {
    const body = cuerpo<{ tenantId: string; patientProfileId: string; reasonText?: string; relationshipType?: string }>(
      request,
    );
    const hpid = request.user?.practitionerProfileId;
    if (hpid === undefined) {
      return preconditionFailed('Sólo un practicante con perfil propio puede solicitar acceso a un expediente');
    }
    if (patientById(body.patientProfileId ?? '') === undefined) return notFound('Paciente no encontrado');
    const type = body.relationshipType === 'PRIMARY' ? CARE_RELATIONSHIP_TYPE.PRIMARY : CARE_RELATIONSHIP_TYPE.TREATING;
    const duplicate = duplicateConflict(body.patientProfileId ?? '', hpid, type);
    if (duplicate !== null) return duplicate;
    const now = ahora();
    const created = careRelationships.agregar({
      id: nuevoId('care-request'),
      tenantId: body.tenantId ?? TENANT_CLINICA,
      patientProfileId: body.patientProfileId ?? '',
      practitionerProfileId: hpid,
      relationshipTypeConceptId: type,
      statusConceptId: STATUS['ST-PENDING']!,
      purposeConceptId: null,
      validFrom: now,
      validTo: null,
      reasonText: body.reasonText ?? null,
      requestedBy: 'PRACTITIONER',
      requestedAt: now,
      decidedAt: null,
    });
    return { status: 201, body: { id: created.id, status: 'PENDING', createdAt: created.validFrom } };
  });

  /** The patient answers what a practitioner asked; someone else's is 404. */
  router.post('/authz/care-relationships/:id/respond', (request) => {
    const r = careRelationships.get(request.params['id']!);
    if (r === undefined || r.patientProfileId !== request.user?.patientProfileId) return notFound('Solicitud no encontrada');
    if ((r.requestedBy ?? 'PRACTITIONER') !== 'PRACTITIONER') {
      return forbidden('Esta solicitud la envió usted: la responde el profesional');
    }
    if (r.statusConceptId !== STATUS['ST-PENDING']) return preconditionFailed('La solicitud ya fue respondida');
    const body = cuerpo<{ decision: 'ACCEPT' | 'REJECT' }>(request);
    const now = ahora();
    careRelationships.actualizar(
      r.id,
      body.decision === 'REJECT'
        ? { statusConceptId: STATUS['ST-REJECTED']!, decidedAt: now }
        : { statusConceptId: STATUS['ST-ACTIVE']!, validFrom: now, decidedAt: now },
    );
    return { ok: true, affected: 1 };
  });

  router.get('/authz/legal-representations', ({ query }) => {
    const patient = query.get('patientProfileId');
    return legalRepresentations
      .filtrar((r) => patient === null || r.patientProfileId === patient)
      .map(({ tenantId: _t, ...r }) => r);
  });
  router.post('/authz/legal-representations', (request) => {
    const body = cuerpo<{
      tenantId: string;
      patientProfileId: string;
      representativeUserId: string;
      relationshipConceptId?: string;
    }>(request);
    const created = legalRepresentations.agregar({
      id: nuevoId('legal-rep'),
      tenantId: body.tenantId ?? TENANT_CLINICA,
      patientProfileId: body.patientProfileId ?? '',
      representativeUserId: body.representativeUserId ?? '',
      representativeName: 'Representante',
      relationshipConceptId: body.relationshipConceptId ?? KINSHIP['RELATIONSHIP_GUARDIAN']!,
      statusConceptId: STATUS['ST-ACTIVE']!,
      validFrom: ahora(),
      validTo: null,
    });
    return { status: 201, body: { id: created.id, status: 'ACTIVE', createdAt: created.validFrom } };
  });
  router.post('/authz/legal-representations/:id/revoke', ({ params }) => {
    const r = legalRepresentations.get(params['id']!);
    if (r === undefined) return notFound('Representación no encontrada');
    legalRepresentations.actualizar(r.id, { statusConceptId: STATUS['ST-REVOKED']!, validTo: ahora() });
    return { ok: true, affected: 1 };
  });
}
