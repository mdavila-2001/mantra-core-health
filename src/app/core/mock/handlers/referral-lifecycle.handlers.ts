import { reply, forbidden, validation, type MockRouter } from '../mock-router';
import { ahora, cuerpo } from '../mock-store';
import {
  activeTenant,
  externalOnly,
  filled,
  invalid,
  isClinician,
  isDestination,
  notFoundReferral,
  precondition,
  REFERRAL_STATUS,
  referralList,
  view,
} from './referrals.handlers';

/* ============================================================================
    Lo que pasa con una derivación después de emitida (API v4266): leerla,
    responderla desde el destino, registrar la contrarreferencia y anularla, y
    `GET /referrals/me` para la persona. Separado de `referrals.handlers.ts`
    por tamaño; comparte su colección y sus reglas.
    ========================================================================== */

export function registerReferralLifecycle(router: MockRouter): void {
  router.get('/referrals/me', (request) => {
    const patient = request.user?.patientProfileId;
    if (patient === undefined) return [];
    return referralList
      .filtrar((d) => d.patientProfileId === patient)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(view);
  });

  router.get('/referrals/:id', (request) => {
    if (!isClinician(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const found = referralList.get(id);
    return found === undefined ? notFoundReferral(id) : view(found);
  });

  router.patch('/referrals/:id/respond', (request) => {
    if (!isClinician(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const body = cuerpo<{ decision: string; rejectReason: string }>(request);
    if (body.decision !== 'ACCEPT' && body.decision !== 'REJECT') {
      return validation('decision debe ser ACCEPT o REJECT', [{ message: 'decision debe ser ACCEPT o REJECT' }]);
    }
    if (body.decision === 'REJECT' && !filled(body.rejectReason)) {
      return invalid('REFERRAL_REJECT_REASON_REQUIRED', 'Rechazar una derivación exige el motivo', ['rejectReason']);
    }
    const tenant = activeTenant(request);
    if (tenant === null) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'Se requiere una organización activa',
        details: { reason: 'TENANT_REQUIRED' },
      });
    }
    const found = referralList.get(id);
    // Quien no es destino recibe 404, igual que si no existiera.
    if (found === undefined || !isDestination(found, request, tenant)) return notFoundReferral(id);
    if (found.statusConceptId !== REFERRAL_STATUS['REF_REQUESTED']) {
      return precondition('REFERRAL_NOT_PENDING', 'La referencia no está en estado solicitado', found.id);
    }
    const answered = referralList.actualizar(found.id, {
      statusConceptId: REFERRAL_STATUS[body.decision === 'ACCEPT' ? 'REF_ACCEPTED' : 'REF_REJECTED']!,
      respondedAt: ahora(),
      rejectReason: body.decision === 'REJECT' ? body.rejectReason!.trim() : null,
    })!;
    return { ok: true, ...view(answered) };
  });

  router.patch('/referrals/:id/counter-referral', (request) => {
    if (!isClinician(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const found = referralList.get(id);
    if (found === undefined) return notFoundReferral(id);
    const body = cuerpo<{ counterReferralText: string }>(request);
    if (!filled(body.counterReferralText)) {
      return validation('counterReferralText should not be empty', [
        { field: 'counterReferralText', message: 'should not be empty' },
      ]);
    }
    const external = externalOnly(found);
    if (!external && !isDestination(found, request, activeTenant(request))) return notFoundReferral(id);
    const status = found.statusConceptId;
    if (!(status === REFERRAL_STATUS['REF_ACCEPTED'] || (external && status === REFERRAL_STATUS['REF_REQUESTED']))) {
      return precondition(
        'REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED',
        'La derivación no admite contrarreferencia en su estado actual',
        found.id,
      );
    }
    const closed = referralList.actualizar(found.id, {
      statusConceptId: REFERRAL_STATUS['REF_COMPLETED']!,
      counterReferralText: body.counterReferralText!.trim(),
      counterReferralAt: ahora(),
    })!;
    return view(closed);
  });

  router.patch('/referrals/:id/cancel', (request) => {
    if (!isClinician(request)) return forbidden();
    const id = request.params['id'] ?? '';
    const found = referralList.get(id);
    if (found === undefined) return notFoundReferral(id);
    if (
      found.statusConceptId !== REFERRAL_STATUS['REF_REQUESTED'] &&
      found.statusConceptId !== REFERRAL_STATUS['REF_ACCEPTED']
    ) {
      return precondition('REFERRAL_ALREADY_CLOSED', 'La derivación ya está cerrada', found.id);
    }
    return view(referralList.actualizar(found.id, { statusConceptId: REFERRAL_STATUS['REF_CANCELLED']! })!);
  });
}
