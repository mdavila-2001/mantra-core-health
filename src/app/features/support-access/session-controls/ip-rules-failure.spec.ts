import { HttpErrorResponse } from '@angular/common/http';

import { ipRulesFailureOf } from './ip-rules-failure';

const fallo = (status: number, reason?: string, extra: Record<string, unknown> = {}): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: { statusCode: status, code: status === 403 ? 'FORBIDDEN' : 'PRECONDITION_FAILED', message: 'x', timestamp: '', path: '/org/ip-access-rules', ...(reason === undefined ? {} : { details: { reason, ...extra } }) },
  });

describe('el fallo de guardar las redes', () => {
  it('un conjunto que deja fuera a quien lo guarda se explica y dice que no se guardó nada', () => {
    const f = ipRulesFailureOf(fallo(422, 'IP_RULES_WOULD_LOCK_OUT_ACTOR'));
    expect(f.kind).toBe('LOCK_OUT');
    expect(f.message).toContain('No se guardó nada');
    expect(f.message).toContain('quedaría fuera de su propia organización');
  });

  it('un rango inválido nombra el rango y da el ejemplo', () => {
    const f = ipRulesFailureOf(fallo(422, 'IP_RULE_CIDR_INVALID', { cidr: '190.129.0.0' }));
    expect(f.kind).toBe('CIDR');
    expect(f.message).toContain('190.129.0.0');
    expect(f.message).toContain('/16');
  });

  it('una vigencia al revés se explica', () => {
    expect(ipRulesFailureOf(fallo(422, 'IP_RULE_VALIDITY_INVALID'))).toMatchObject({ kind: 'VALIDITY' });
  });

  it('un 403 dice quién puede cambiarlas, sin confundirse con un rechazo de negocio', () => {
    expect(ipRulesFailureOf(fallo(403))).toMatchObject({ kind: 'FORBIDDEN' });
  });

  it('sin red, lo dice; cualquier otra cosa, un mensaje general', () => {
    expect(ipRulesFailureOf(new HttpErrorResponse({ status: 0 }))).toMatchObject({ kind: 'OFFLINE' });
    expect(ipRulesFailureOf(fallo(500))).toMatchObject({ kind: 'OTHER' });
    expect(ipRulesFailureOf(new Error('x'))).toMatchObject({ kind: 'OTHER' });
  });

  it('ningún mensaje deja ver códigos de sistema', () => {
    for (const reason of ['IP_RULES_WOULD_LOCK_OUT_ACTOR', 'IP_RULE_CIDR_INVALID', 'IP_RULE_VALIDITY_INVALID']) {
      expect(ipRulesFailureOf(fallo(422, reason)).message).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    }
  });
});
