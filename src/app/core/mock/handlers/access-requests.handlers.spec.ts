import { HttpHeaders } from '@angular/common/http';

import { SPECIALTY } from '../fixtures/concepts';
import { PACIENTE, PATIENTS, PROFESSIONALS, professionalById } from '../fixtures/people';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_CONSULTORIO, type MockUser } from '../mock-session';
import { registerAccessRequests } from './access-requests.handlers';
import { registerAuthz } from './authz.handlers';

interface InboxRow {
  readonly id: string;
  readonly kind: string;
  readonly direction: string;
  readonly status: string;
  readonly counterpart: { readonly profileId: string; readonly displayName: string };
  readonly requestedSpecialtyConceptIds: readonly string[];
  readonly authorizedSpecialtyConceptIds: readonly string[];
}

/**
 * El simulador del buzón dice lo mismo que la API de la entrega 2: la cabecera
 * la pide cualquiera de los dos lados y la acepta el otro; el acceso por
 * especialidad lo pide sólo el profesional y lo decide el paciente.
 *
 * Las pruebas crean sus propias solicitudes (y un profesional sintético donde
 * hace falta) para no mover las semillas que otros archivos leen: el corredor
 * comparte los módulos entre archivos.
 */
describe('simulador · buzón de solicitudes de acceso', () => {
  const router = new MockRouter();
  registerAuthz(router);
  registerAccessRequests(router);

  const patient = buscarUsuario('paciente')!;
  const practitioner = buscarUsuario('medica')!;
  /** A practitioner of the fixtures with no seeded relationship with Ana. */
  const otherPractitioner: MockUser = { ...practitioner, key: 'colega', practitionerProfileId: PROFESSIONALS[9]!.id };
  const CARDIO = SPECIALTY['CARDIOLOGIA']!;
  const NEURO = SPECIALTY['NEUROLOGIA']!;

  function call(method: MockMethod, path: string, body: unknown, user: MockUser | null, tenant?: string): unknown {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: tenant === undefined ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': tenant }),
      user,
    });
  }

  const status = (value: unknown): number =>
    typeof value === 'object' && value !== null && 'body' in value && typeof (value as MockReply).status === 'number'
      ? (value as MockReply).status
      : 200;
  const bodyOf = (value: unknown): Record<string, unknown> => (value as MockReply).body as Record<string, unknown>;
  const patientInbox = (): InboxRow[] => call('GET', '/authz/me/access-requests', null, patient) as InboxRow[];
  const practitionerInbox = (user: MockUser, tenant?: string): InboxRow[] =>
    call('GET', '/authz/practitioners/me/access-requests', null, user, tenant) as InboxRow[];

  function requestGranular(specialties: readonly string[]): string {
    const created = call(
      'POST',
      '/consent/practitioner-access-requests',
      { patientProfileId: PACIENTE.id, specialtyConceptIds: specialties },
      practitioner,
      TENANT_CLINICA,
    );
    expect(status(created)).toBe(201);
    return bodyOf(created)['id'] as string;
  }

  describe('acceso por especialidad (granular)', () => {
    it('el paciente no puede iniciarlo (403); el profesional sí, y cada lado lo ve desde el suyo', () => {
      const byPatient = call('POST', '/consent/practitioner-access-requests', { patientProfileId: PACIENTE.id, specialtyConceptIds: [CARDIO] }, patient);
      expect(status(byPatient)).toBe(403);

      const id = requestGranular([CARDIO, NEURO]);

      expect(practitionerInbox(practitioner, TENANT_CLINICA).find((r) => r.id === id)).toMatchObject({
        kind: 'GRANULAR',
        direction: 'SENT',
        status: 'PENDING',
        counterpart: { profileId: PACIENTE.id },
      });
      expect(patientInbox().find((r) => r.id === id)).toMatchObject({
        kind: 'GRANULAR',
        direction: 'RECEIVED',
        status: 'PENDING',
        requestedSpecialtyConceptIds: [CARDIO, NEURO],
        counterpart: { displayName: professionalById(practitioner.practitionerProfileId!)!.displayName },
      });
    });

    it('sin especialidades no se crea nada (400)', () => {
      const before = patientInbox().length;
      const empty = call('POST', '/consent/practitioner-access-requests', { patientProfileId: PACIENTE.id, specialtyConceptIds: [] }, practitioner);
      expect(status(empty)).toBe(400);
      expect(patientInbox()).toHaveLength(before);
    });

    it('el paciente acepta una de las dos; no puede autorizar lo que no se pidió ni decidir dos veces', () => {
      const id = requestGranular([CARDIO, NEURO]);
      const path = `/consent/practitioner-access-requests/${id}/decision`;

      expect(status(call('POST', path, { decision: 'ACCEPTED', authorizedSpecialtyConceptIds: [CARDIO] }, practitioner))).toBe(404);
      expect(status(call('POST', path, { decision: 'ACCEPTED', authorizedSpecialtyConceptIds: [SPECIALTY['PEDIATRIA']!] }, patient))).toBe(400);
      expect(status(call('POST', path, { decision: 'ACCEPTED', authorizedSpecialtyConceptIds: [CARDIO] }, patient))).toBe(200);
      expect(status(call('POST', path, { decision: 'DECLINED', authorizedSpecialtyConceptIds: [] }, patient))).toBe(422);

      expect(patientInbox().find((r) => r.id === id)).toMatchObject({ status: 'ACTIVE', authorizedSpecialtyConceptIds: [CARDIO] });
      expect(practitionerInbox(practitioner, TENANT_CLINICA).find((r) => r.id === id)?.status).toBe('ACTIVE');
    });

    it('revocar deja la fila REVOKED y no se revoca dos veces; rechazar no autoriza nada', () => {
      const accepted = requestGranular([CARDIO]);
      call('POST', `/consent/practitioner-access-requests/${accepted}/decision`, { decision: 'ACCEPTED', authorizedSpecialtyConceptIds: [CARDIO] }, patient);
      const revoke = `/consent/practitioner-access-requests/${accepted}/revoke`;
      expect(status(call('POST', revoke, {}, practitioner))).toBe(404);
      expect(status(call('POST', revoke, {}, patient))).toBe(200);
      expect(status(call('POST', revoke, {}, patient))).toBe(422);
      expect(patientInbox().find((r) => r.id === accepted)?.status).toBe('REVOKED');

      const declined = requestGranular([NEURO]);
      call('POST', `/consent/practitioner-access-requests/${declined}/decision`, { decision: 'DECLINED', authorizedSpecialtyConceptIds: [] }, patient);
      expect(patientInbox().find((r) => r.id === declined)).toMatchObject({ status: 'REJECTED', authorizedSpecialtyConceptIds: [] });
    });
  });

  describe('médico de cabecera', () => {
    it('lo pide el paciente con la organización del profesional; lo acepta el profesional, no el paciente', () => {
      const path = '/authz/me/primary-practitioner-requests';
      const body = { practitionerProfileId: otherPractitioner.practitionerProfileId };
      expect(status(call('POST', path, body, patient))).toBe(422);

      const created = call('POST', path, body, patient, TENANT_CONSULTORIO);
      expect(status(created)).toBe(201);
      const id = bodyOf(created)['id'] as string;
      expect(bodyOf(call('POST', path, body, patient, TENANT_CONSULTORIO))).toMatchObject({
        details: { reason: 'CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING' },
      });

      expect(patientInbox().find((r) => r.id === id)).toMatchObject({ kind: 'CABECERA', direction: 'SENT', status: 'PENDING' });
      expect(practitionerInbox(otherPractitioner, TENANT_CONSULTORIO).find((r) => r.id === id)).toMatchObject({
        kind: 'CABECERA',
        direction: 'RECEIVED',
        counterpart: { profileId: PACIENTE.id, displayName: patient.displayName },
      });
      // Only the active tenant: from another organization the practitioner does not see it.
      expect(practitionerInbox(otherPractitioner, TENANT_CLINICA).some((r) => r.id === id)).toBe(false);

      expect(status(call('POST', `/authz/care-relationships/${id}/respond`, { decision: 'ACCEPT' }, patient))).toBe(403);
      const respond = `/authz/practitioners/me/care-relationships/${id}/respond`;
      expect(status(call('POST', respond, { decision: 'ACCEPT' }, patient))).toBe(403);
      expect(status(call('POST', respond, { decision: 'ACCEPT' }, otherPractitioner))).toBe(200);
      expect(patientInbox().find((r) => r.id === id)?.status).toBe('ACTIVE');
      expect(bodyOf(call('POST', path, body, patient, TENANT_CONSULTORIO))).toMatchObject({
        details: { reason: 'CARE_RELATIONSHIP_ALREADY_ACTIVE' },
      });
    });

    it('la pide el profesional (PRIMARY); el paciente la rechaza y queda REJECTED, fuera de «Quién ve mi historia»', () => {
      const target = PATIENTS[7]!;
      const owner: MockUser = { ...patient, key: 'paciente-7', patientProfileId: target.id };
      const created = call(
        'POST',
        '/authz/care-relationships/request',
        { tenantId: TENANT_CLINICA, patientProfileId: target.id, relationshipType: 'PRIMARY' },
        practitioner,
      );
      expect(status(created)).toBe(201);
      const id = bodyOf(created)['id'] as string;

      const inbox = call('GET', '/authz/me/access-requests', null, owner) as InboxRow[];
      expect(inbox.find((r) => r.id === id)).toMatchObject({ kind: 'CABECERA', direction: 'RECEIVED' });

      expect(status(call('POST', `/authz/care-relationships/${id}/respond`, { decision: 'REJECT' }, patient))).toBe(404);
      expect(status(call('POST', `/authz/care-relationships/${id}/respond`, { decision: 'REJECT' }, owner))).toBe(200);
      expect((call('GET', '/authz/me/access-requests', null, owner) as InboxRow[]).find((r) => r.id === id)?.status).toBe('REJECTED');
      const access = call('GET', '/authz/me/access', null, owner) as { careRelationships: { id: string }[] };
      expect(access.careRelationships.some((r) => r.id === id)).toBe(false);
    });
  });

  it('cada bandeja es de su rol: sin perfil de paciente o sin rol profesional, 403', () => {
    expect(status(call('GET', '/authz/me/access-requests', null, practitioner))).toBe(403);
    expect(status(call('GET', '/authz/practitioners/me/access-requests', null, patient))).toBe(403);
    // The practitioner no longer poses as Ana in «Quién ve mi historia».
    expect(status(call('GET', '/authz/me/access', null, practitioner))).toBe(403);
  });
});
