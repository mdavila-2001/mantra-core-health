import { HttpHeaders } from '@angular/common/http';

import { PROFESSIONALS } from '../fixtures/people';
import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarAdmisiones, reiniciarAdmisiones } from './admissions.handlers';
import { registerOwnAdmissionSubmit } from './own-admission-submit.handlers';

/* The simulator answers the first request the way the API does: same refusals,
   same order, and afterwards the request reads back as `ENVIADA`. */

const router = new MockRouter();
registrarAdmisiones(router);
registerOwnAdmissionSubmit(router);

const OWN = '/profiles/practitioners/me/admission';
const ATTESTATION = { attested: true, attestationVersion: '2026-10' };

const newDoctor = buscarUsuario('medico_nuevo')!;
const patient = buscarUsuario('paciente')!;

interface Answer {
  readonly status: number;
  readonly body: { readonly reason?: string; readonly status?: { readonly code: string } };
}

function call(method: MockMethod, path: string, user: MockUser, body: unknown = undefined): Answer {
  const match = router.match(method, path);
  if (match === null) throw new Error(`No route ${method} ${path}`);
  const r = match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(),
    body,
    headers: new HttpHeaders(),
    user,
  } satisfies MockRequest);
  return (isMockReply(r) ? r : { status: 200, body: r }) as Answer;
}

/** A doctor account for a pending professional that has no request yet. */
function doctorWithoutRequest(): MockUser {
  const as = (id: string): MockUser => ({ ...newDoctor, id: `user-of-${id}`, practitionerProfileId: id });
  const found = PROFESSIONALS.find((p) => !p.verified && call('GET', OWN, as(p.id)).status === 404);
  if (found === undefined) throw new Error('The simulator has no pending professional without a request');
  return as(found.id);
}

describe('POST /profiles/practitioners/me/admission/submit (simulator)', () => {
  beforeEach(() => reiniciarAdmisiones());

  it('opens the request of a pending doctor without one: ENVIADA, and GET reads it back', () => {
    const doctor = doctorWithoutRequest();
    const sent = call('POST', `${OWN}/submit`, doctor, ATTESTATION);
    expect(sent.status).toBe(200);
    expect(sent.body.status?.code).toBe('ENVIADA');
    expect(call('GET', OWN, doctor).body.status?.code).toBe('ENVIADA');
  });

  it('without the attestation: 422 ADMISSION_ATTESTATION_REQUIRED, and nothing is opened', () => {
    const doctor = doctorWithoutRequest();
    for (const body of [{}, { attested: true }, { attested: false, attestationVersion: '2026-10' }, { attested: true, attestationVersion: ' ' }]) {
      const r = call('POST', `${OWN}/submit`, doctor, body);
      expect(r.status).toBe(422);
      expect(r.body.reason).toBe('ADMISSION_ATTESTATION_REQUIRED');
    }
    expect(call('GET', OWN, doctor).status).toBe(404);
  });

  it('with a request already: 409 ADMISSION_ALREADY_EXISTS (it is resent, not opened again)', () => {
    const r = call('POST', `${OWN}/submit`, newDoctor, ATTESTATION);
    expect(r.status).toBe(409);
    expect(r.body.reason).toBe('ADMISSION_ALREADY_EXISTS');
  });

  it('a profile that is no longer pending: 422 ADMISSION_NOT_PENDING', () => {
    // Every verified doctor of the simulator has a request: this one is verified for the test only.
    const doctor = doctorWithoutRequest();
    const profile = PROFESSIONALS.find((p) => p.id === doctor.practitionerProfileId) as { verified: boolean };
    profile.verified = true;
    try {
      const r = call('POST', `${OWN}/submit`, doctor, ATTESTATION);
      expect(r.status).toBe(422);
      expect(r.body.reason).toBe('ADMISSION_NOT_PENDING');
      expect(call('GET', OWN, doctor).status).toBe(404);
    } finally {
      profile.verified = false;
    }
  });

  it('without a professional profile: 404 ADMISSION_NOT_FOUND', () => {
    const r = call('POST', `${OWN}/submit`, patient, ATTESTATION);
    expect(r.status).toBe(404);
    expect(r.body.reason).toBe('ADMISSION_NOT_FOUND');
  });
});
