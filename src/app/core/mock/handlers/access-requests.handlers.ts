import { STATUS } from '../fixtures/concepts';
import { patientById, professionalById } from '../fixtures/people';
import {
  forbidden,
  notFound,
  preconditionFailed,
  unauthorized,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import type { MockUser } from '../mock-session';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import {
  CARE_RELATIONSHIP_TYPE,
  careRelationships,
  practitionerAccesses,
  type GranularStatus,
  type RequestInitiator,
  type SimulatedCareRelationship,
  type SimulatedPractitionerAccess,
} from './authz.store';
import { duplicateConflict } from './authz.handlers';

/* ============================================================================
    The unified inbox (entrega 2) and the access by specialty (granular).

    - Primary practitioner: either side asks, the other one answers.
    - Granular: only the practitioner asks (a patient gets 403), the patient
      decides which of the requested specialties to authorize, and revokes.
    - The practitioner's inbox is the active tenant only (`X-Tenant-Id`). The
      patient's is not filtered: the simulated patient's session carries the
      platform tenant, which owns none of these rows (open point of the API).
    ========================================================================== */

const PRACTITIONER_ROLES = ['CLINICIAN', 'PRACTITIONER'];

function practitionerOf(user: MockUser | null): string | null {
  if (user === null || user.practitionerProfileId === undefined) return null;
  return PRACTITIONER_ROLES.some((role) => user.roles.includes(role)) ? user.practitionerProfileId : null;
}

function activeTenant(request: MockRequest): string | null {
  return request.headers.get('X-Tenant-Id');
}

function inboxStatus(r: SimulatedCareRelationship): GranularStatus {
  if (r.statusConceptId === STATUS['ST-PENDING']) return 'PENDING';
  if (r.statusConceptId === STATUS['ST-REJECTED']) return 'REJECTED';
  if (r.statusConceptId === STATUS['ST-REVOKED']) return 'REVOKED';
  if (r.statusConceptId === STATUS['ST-ACTIVE']) {
    return r.validTo !== null && Date.parse(r.validTo) <= Date.now() ? 'EXPIRED' : 'ACTIVE';
  }
  return 'EXPIRED';
}

function counterpartOf(side: RequestInitiator, patientProfileId: string, practitionerProfileId: string) {
  return side === 'PATIENT'
    ? { profileId: practitionerProfileId, displayName: professionalById(practitionerProfileId)?.displayName ?? 'Profesional' }
    : { profileId: patientProfileId, displayName: patientById(patientProfileId)?.displayName ?? 'Paciente' };
}

function careRelationshipItem(r: SimulatedCareRelationship, side: RequestInitiator) {
  const status = inboxStatus(r);
  return {
    id: r.id,
    kind: r.relationshipTypeConceptId === CARE_RELATIONSHIP_TYPE.PRIMARY ? 'CABECERA' : 'ATENCION',
    direction: (r.requestedBy ?? 'PRACTITIONER') === side ? 'SENT' : 'RECEIVED',
    counterpart: counterpartOf(side, r.patientProfileId, r.practitionerProfileId),
    requestedAt: r.requestedAt ?? r.validFrom,
    decidedAt: status === 'PENDING' ? null : (r.decidedAt ?? r.validFrom),
    status,
    requestedSpecialtyConceptIds: [],
    authorizedSpecialtyConceptIds: [],
  };
}

function granularItem(a: SimulatedPractitionerAccess, side: RequestInitiator) {
  return {
    id: a.id,
    kind: 'GRANULAR',
    direction: side === 'PRACTITIONER' ? 'SENT' : 'RECEIVED',
    counterpart: counterpartOf(side, a.patientProfileId, a.practitionerProfileId),
    requestedAt: a.requestedAt,
    decidedAt: a.decidedAt,
    status: a.status,
    requestedSpecialtyConceptIds: a.requestedSpecialtyConceptIds,
    authorizedSpecialtyConceptIds: a.authorizedSpecialtyConceptIds,
  };
}

const newestFirst = (a: { requestedAt: string }, b: { requestedAt: string }) => b.requestedAt.localeCompare(a.requestedAt);

/** The patient's own granular request, or `null` when it is someone else's (404). */
function ownGranular(request: MockRequest): SimulatedPractitionerAccess | null {
  const a = practitionerAccesses.get(request.params['id']!);
  return a === undefined || a.patientProfileId !== request.user?.patientProfileId ? null : a;
}

export function registerAccessRequests(router: MockRouter): void {
  router.get('/authz/me/access-requests', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const pid = user.patientProfileId ?? '';
    if (pid === '') return forbidden('Esta sección es para pacientes');
    return [
      ...careRelationships.filtrar((r) => r.patientProfileId === pid).map((r) => careRelationshipItem(r, 'PATIENT')),
      ...practitionerAccesses.filtrar((a) => a.patientProfileId === pid).map((a) => granularItem(a, 'PATIENT')),
    ].sort(newestFirst);
  });

  router.get('/authz/practitioners/me/access-requests', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const hpid = practitionerOf(request.user);
    if (hpid === null) return forbidden('Esta sección es para profesionales');
    const tenant = activeTenant(request);
    const inTenant = (row: { tenantId: string }) => tenant === null || row.tenantId === tenant;
    return [
      ...careRelationships
        .filtrar((r) => r.practitionerProfileId === hpid && inTenant(r))
        .map((r) => careRelationshipItem(r, 'PRACTITIONER')),
      ...practitionerAccesses
        .filtrar((a) => a.practitionerProfileId === hpid && inTenant(a))
        .map((a) => granularItem(a, 'PRACTITIONER')),
    ].sort(newestFirst);
  });

  /** The patient asks to have this practitioner as primary; the tenant is the practitioner's. */
  router.post('/authz/me/primary-practitioner-requests', (request) => {
    const user = request.user;
    if (user === null) return unauthorized('Sesión vencida');
    if (user.patientProfileId === undefined) return forbidden('Sólo un paciente puede pedir médico de cabecera');
    const practitionerProfileId = cuerpo<{ practitionerProfileId: string }>(request).practitionerProfileId ?? '';
    if (professionalById(practitionerProfileId) === undefined) return notFound('Profesional no encontrado');
    const tenantId = activeTenant(request);
    if (tenantId === null) return preconditionFailed('Falta la organización del profesional');
    const duplicate = duplicateConflict(user.patientProfileId, practitionerProfileId, CARE_RELATIONSHIP_TYPE.PRIMARY);
    if (duplicate !== null) return duplicate;
    const now = ahora();
    const created = careRelationships.agregar({
      id: nuevoId('care-request-primary'),
      tenantId,
      patientProfileId: user.patientProfileId,
      practitionerProfileId,
      relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.PRIMARY,
      statusConceptId: STATUS['ST-PENDING']!,
      purposeConceptId: null,
      validFrom: now,
      validTo: null,
      reasonText: null,
      requestedBy: 'PATIENT',
      requestedAt: now,
      decidedAt: null,
    });
    return { status: 201, body: { id: created.id, status: 'PENDING', createdAt: now } };
  });

  /** The practitioner answers what a patient asked; someone else's is 404. */
  router.post('/authz/practitioners/me/care-relationships/:id/respond', (request) => {
    const hpid = practitionerOf(request.user);
    if (hpid === null) return forbidden('Esta acción es para profesionales');
    const r = careRelationships.get(request.params['id']!);
    if (r === undefined || r.practitionerProfileId !== hpid) return notFound('Solicitud no encontrada');
    if ((r.requestedBy ?? 'PRACTITIONER') !== 'PATIENT') return forbidden('Esta solicitud la envió usted: la responde el paciente');
    if (r.statusConceptId !== STATUS['ST-PENDING']) return preconditionFailed('La solicitud ya fue respondida');
    const now = ahora();
    careRelationships.actualizar(
      r.id,
      cuerpo<{ decision: 'ACCEPT' | 'REJECT' }>(request).decision === 'REJECT'
        ? { statusConceptId: STATUS['ST-REJECTED']!, decidedAt: now }
        : { statusConceptId: STATUS['ST-ACTIVE']!, validFrom: now, decidedAt: now },
    );
    return { ok: true, affected: 1 };
  });

  /* ---- access by specialty (granular) ------------------------------------ */

  router.post('/consent/practitioner-access-requests', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const hpid = practitionerOf(request.user);
    // Only the practitioner opens a granular request: the patient cannot start one.
    if (hpid === null) return forbidden('Sólo un profesional puede pedir acceso por especialidad');
    const body = cuerpo<{ patientProfileId: string; specialtyConceptIds: string[]; reasonText?: string }>(request);
    if (patientById(body.patientProfileId ?? '') === undefined) return notFound('Paciente no encontrado');
    const specialties = [...new Set(body.specialtyConceptIds ?? [])];
    if (specialties.length === 0) {
      return validation('Elija al menos una especialidad', [{ field: 'specialtyConceptIds', message: 'no puede estar vacío' }]);
    }
    const created = practitionerAccesses.agregar({
      id: nuevoId('practitioner-access'),
      tenantId: activeTenant(request) ?? request.user.tenants[0] ?? '',
      patientProfileId: body.patientProfileId ?? '',
      practitionerProfileId: hpid,
      requestedSpecialtyConceptIds: specialties,
      authorizedSpecialtyConceptIds: [],
      reasonText: body.reasonText ?? null,
      status: 'PENDING',
      requestedAt: ahora(),
      decidedAt: null,
    });
    return { status: 201, body: { id: created.id, status: 'PENDING', createdAt: created.requestedAt } };
  });

  router.post('/consent/practitioner-access-requests/:id/decision', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const a = ownGranular(request);
    if (a === null) return notFound('Solicitud no encontrada');
    if (a.status !== 'PENDING') return preconditionFailed('La solicitud ya fue respondida');
    const body = cuerpo<{ decision: 'ACCEPTED' | 'DECLINED'; authorizedSpecialtyConceptIds: string[] }>(request);
    const authorized = [...new Set(body.authorizedSpecialtyConceptIds ?? [])];
    if (body.decision === 'ACCEPTED') {
      if (authorized.length === 0 || authorized.some((id) => !a.requestedSpecialtyConceptIds.includes(id))) {
        return validation('Autorice al menos una de las especialidades pedidas', [
          { field: 'authorizedSpecialtyConceptIds', message: 'debe ser parte de lo pedido' },
        ]);
      }
    }
    practitionerAccesses.actualizar(a.id, {
      status: body.decision === 'ACCEPTED' ? 'ACTIVE' : 'REJECTED',
      authorizedSpecialtyConceptIds: body.decision === 'ACCEPTED' ? authorized : [],
      decidedAt: ahora(),
    });
    return { ok: true, affected: 1 };
  });

  router.post('/consent/practitioner-access-requests/:id/revoke', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const a = ownGranular(request);
    if (a === null) return notFound('Solicitud no encontrada');
    if (a.status !== 'ACTIVE') return preconditionFailed('El acceso no está activo');
    practitionerAccesses.actualizar(a.id, { status: 'REVOKED' });
    return { ok: true, affected: 1 };
  });
}
