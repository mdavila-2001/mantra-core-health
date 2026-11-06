import { professionalById } from '../fixtures/people';
import {
  isMockReply,
  precondition,
  reply,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { cuerpo } from '../mock-store';
import { crearAdmisionDeAltaDeDoctor } from './admissions.handlers';

/* ============================================================================
    `POST /profiles/practitioners/me/admission/submit`: the practitioner sends
    their first verification request.

    Same rules and same order as the API: no professional profile is a 404
    `ADMISSION_NOT_FOUND`; no attestation, a 422 `ADMISSION_ATTESTATION_REQUIRED`;
    an existing request, a 409 `ADMISSION_ALREADY_EXISTS` (that one is resent,
    not opened again); a profile that is no longer pending, a 422
    `ADMISSION_NOT_PENDING`. It answers what `GET …/me/admission` answers next.

    The route is newer than the simulator's contract (`api-contract.generated.ts`),
    so the generic validator does not look at the body: it is checked here.
    ========================================================================== */

const OWN_ADMISSION = '/profiles/practitioners/me/admission';

/** The API's error body for a 404 or a 409: generic code, message and stable `reason`. */
function refusal(status: 404 | 409, reason: string, message: string): MockReply {
  const code = status === 404 ? 'NOT_FOUND' : 'CONFLICT';
  return reply(status, { statusCode: status, code, error: code, message, reason, details: {} });
}

/** What `GET /me/admission` answers for this session: the request, or its 404. */
function ownAdmission(router: MockRouter, request: MockRequest): unknown {
  const read = router.match('GET', OWN_ADMISSION);
  return read?.handler({ ...request, method: 'GET', path: OWN_ADMISSION, body: null });
}

function attested(request: MockRequest): boolean {
  const body = cuerpo<{ attested: unknown; attestationVersion: unknown }>(request);
  const version = body.attestationVersion;
  return body.attested === true && typeof version === 'string' && version.trim() !== '';
}

export function registerOwnAdmissionSubmit(router: MockRouter): void {
  router.post('/profiles/practitioners/me/admission/submit', (request) => {
    const user = request.user;
    const practitioner =
      user?.practitionerProfileId === undefined ? undefined : professionalById(user.practitionerProfileId);
    if (user === null || practitioner === undefined) {
      return refusal(404, 'ADMISSION_NOT_FOUND', 'Admisión no encontrada');
    }
    if (!attested(request)) {
      return precondition(
        'Debe aceptar la declaración para enviar la solicitud',
        'ADMISSION_ATTESTATION_REQUIRED',
        { field: 'attested' },
      );
    }
    const current = ownAdmission(router, request);
    if (!isMockReply(current) || current.status !== 404) {
      return refusal(
        409,
        'ADMISSION_ALREADY_EXISTS',
        'Ya tiene una solicitud de verificación: reenvíela en lugar de abrir otra',
      );
    }
    if (practitioner.verified) {
      return precondition('Su perfil ya no está pendiente de verificación', 'ADMISSION_NOT_PENDING');
    }
    crearAdmisionDeAltaDeDoctor({
      userId: user.id,
      profileId: practitioner.id,
      displayName: user.displayName,
      nationalId: user.nationalId,
      email: user.email,
    });
    return ownAdmission(router, request);
  });
}
