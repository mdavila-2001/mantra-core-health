import { HttpErrorResponse } from '@angular/common/http';

import { classifyAccessChallenge, isReservedBlock, RESERVED_BLOCK_LABEL, withAccessChallenge, ACCESS_CHALLENGE, APPROVAL_HEADER } from './access-challenge';

const error = (status: number, code: string, reason: string | undefined, details: Record<string, unknown> = {}, message = 'x'): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { statusCode: status, code, message, ...(reason === undefined ? {} : { reason }), details: { ...details, ...(reason === undefined ? {} : { reason }) }, timestamp: '', path: '/x' } });

describe('classifyAccessChallenge', () => {
  it('422 REASON_REQUIRED pide el motivo, con el mínimo de la API', () => {
    expect(classifyAccessChallenge(error(422, 'PRECONDITION_FAILED', 'REASON_REQUIRED', { minLength: 10 }))).toEqual({ kind: 'REASON', minLength: 10, placeholder: false });
  });

  it('422 REASON_PLACEHOLDER vuelve a pedir el motivo y avisa que el anterior era de relleno', () => {
    expect(classifyAccessChallenge(error(422, 'PRECONDITION_FAILED', 'REASON_PLACEHOLDER'))).toEqual({ kind: 'REASON', minLength: 5, placeholder: true });
  });

  it('403 STEP_UP_REQUIRED pide el segundo paso; sin factor activado lo manda a activarlo', () => {
    expect(classifyAccessChallenge(error(403, 'FORBIDDEN', 'STEP_UP_REQUIRED', { maxAgeMinutes: 5, enrolled: true }))).toEqual({ kind: 'STEP_UP', maxAgeMinutes: 5, enrolled: true });
    expect(classifyAccessChallenge(error(403, 'FORBIDDEN', 'STEP_UP_REQUIRED', { enrolled: false }))).toEqual({ kind: 'STEP_UP', maxAgeMinutes: null, enrolled: false });
  });

  it('403 APPROVAL_REQUIRED pide aprobación y dice de quién', () => {
    expect(classifyAccessChallenge(error(403, 'FORBIDDEN', 'APPROVAL_REQUIRED', { approverKind: 'DOCTOR', atom: 'agenda.appointment.cancel', ttlMinutes: 60 }))).toEqual({
      kind: 'APPROVAL',
      approverKind: 'DOCTOR',
      atom: 'agenda.appointment.cancel',
      ttlMinutes: 60,
      stale: false,
    });
  });

  it('409 FOUR_EYES_PAYLOAD_CHANGED y la aprobación consumida o vencida piden una aprobación nueva', () => {
    expect(classifyAccessChallenge(error(409, 'CONFLICT', 'FOUR_EYES_PAYLOAD_CHANGED'))).toMatchObject({ kind: 'APPROVAL', stale: true });
    expect(classifyAccessChallenge(error(403, 'FORBIDDEN', 'APPROVAL_REQUIRED', { approvalProblem: 'FOUR_EYES_ALREADY_CONSUMED' }))).toMatchObject({ kind: 'APPROVAL', stale: true });
  });

  it('503 STEP_UP_UNAVAILABLE, 429 STEP_UP_ATTEMPTS_EXCEEDED y DECISION_LOG_UNAVAILABLE no se reintentan: se explican', () => {
    expect(classifyAccessChallenge(error(503, 'DEPENDENCY_UNAVAILABLE', 'STEP_UP_UNAVAILABLE'))).toMatchObject({ kind: 'BLOCKED', reason: 'STEP_UP_UNAVAILABLE' });
    expect(classifyAccessChallenge(error(429, 'RATE_LIMITED', 'STEP_UP_ATTEMPTS_EXCEEDED'))).toMatchObject({ kind: 'BLOCKED', reason: 'STEP_UP_ATTEMPTS_EXCEEDED' });
    expect(classifyAccessChallenge(error(403, 'FORBIDDEN', undefined, { reason: 'DECISION_LOG_UNAVAILABLE' }))).toMatchObject({ kind: 'BLOCKED', reason: 'DECISION_LOG_UNAVAILABLE' });
  });

  it('un 403 genérico, un 404 o algo que no es un error de la API no son un desafío', () => {
    expect(classifyAccessChallenge(error(403, 'FORBIDDEN', undefined))).toBeNull();
    expect(classifyAccessChallenge(error(404, 'NOT_FOUND', undefined))).toBeNull();
    expect(classifyAccessChallenge(new Error('boom'))).toBeNull();
    expect(classifyAccessChallenge(new HttpErrorResponse({ status: 0 }))).toBeNull();
  });
});

describe('bloques «Reservado»', () => {
  it('un bloque con denialReason RESERVED se muestra «Reservado» y no revela nada más', () => {
    expect(isReservedBlock({ denialReason: 'RESERVED' })).toBe(true);
    expect(isReservedBlock({ denialReason: 'su permiso no cubre este horario' })).toBe(false);
    expect(isReservedBlock({})).toBe(false);
    expect(RESERVED_BLOCK_LABEL).toBe('Reservado');
  });
});

describe('withAccessChallenge', () => {
  it('marca la petición para que el interceptor resuelva los desafíos, con el campo del motivo', () => {
    const context = withAccessChallenge({ reasonField: 'reason' });
    expect(context.get(ACCESS_CHALLENGE)).toMatchObject({ reasonField: 'reason' });
    expect(APPROVAL_HEADER).toBe('X-Approval-Id');
  });

  it('sin opciones usa reasonText, el nombre del campo de la API de agenda', () => {
    expect(withAccessChallenge().get(ACCESS_CHALLENGE)).toMatchObject({ reasonField: 'reasonText' });
  });
});
