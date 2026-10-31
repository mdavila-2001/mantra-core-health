import { loginPolicyOutcome } from './login-policy-reasons';

describe('loginPolicyOutcome', () => {
  it('los dos de código piden el código', () => {
    expect(loginPolicyOutcome('MFA_REQUIRED')).toMatchObject({ kind: 'ask-code' });
    expect(loginPolicyOutcome('MFA_INVALID')).toMatchObject({ kind: 'ask-code' });
  });

  it('la falta de dos pasos activados ya no es un rechazo: la API deja entrar y avisa en la respuesta', () => {
    expect(loginPolicyOutcome('MFA_ENROLLMENT_REQUIRED')).toBeNull();
  });

  it('fuera de horario y fuera de la red bloquean y explican qué hacer', () => {
    expect(loginPolicyOutcome('OUTSIDE_ALLOWED_HOURS')!.message).toContain('horario laboral');
    expect(loginPolicyOutcome('OUTSIDE_ALLOWED_NETWORK')).toMatchObject({ kind: 'blocked' });
    expect(loginPolicyOutcome('OUTSIDE_ALLOWED_NETWORK')!.message).toContain('propia red');
  });

  it('el nombre viejo de la red se acepta igual y dice lo mismo', () => {
    expect(loginPolicyOutcome('NETWORK_NOT_ALLOWED')).toMatchObject({ kind: 'blocked' });
    expect(loginPolicyOutcome('NETWORK_NOT_ALLOWED')!.message).toBe(loginPolicyOutcome('OUTSIDE_ALLOWED_NETWORK')!.message);
  });

  it('un motivo que no es de política no se inventa', () => {
    expect(loginPolicyOutcome('OTRA_COSA')).toBeNull();
    expect(loginPolicyOutcome(undefined)).toBeNull();
    expect(loginPolicyOutcome('toString')).toBeNull();
  });

  it('ningún mensaje deja ver códigos de sistema', () => {
    for (const r of ['MFA_REQUIRED', 'MFA_INVALID', 'OUTSIDE_ALLOWED_HOURS', 'OUTSIDE_ALLOWED_NETWORK', 'NETWORK_NOT_ALLOWED']) {
      expect(loginPolicyOutcome(r)!.message).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    }
  });
});
