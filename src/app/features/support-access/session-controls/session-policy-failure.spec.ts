import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { sessionPolicyFailureOf } from './session-policy-failure';

const falla = (reason: string, details: Record<string, unknown> = {}): HttpErrorResponse =>
  new HttpErrorResponse({ status: 422, error: { code: 'PRECONDITION_FAILED', message: 'mensaje de la API', details: { ...details, reason }, timestamp: '', path: '' } });

describe('sessionPolicyFailureOf', () => {
  it('SESSION_POLICY_HOURS_EMPTY: la franja no admite a nadie', () => {
    expect(sessionPolicyFailureOf(falla('SESSION_POLICY_HOURS_EMPTY'), 'f')).toContain('misma hora');
  });

  it('SESSION_POLICY_HOURS_TOO_SHORT: dice el mínimo que la API informa (4 horas)', () => {
    expect(sessionPolicyFailureOf(falla('SESSION_POLICY_HOURS_TOO_SHORT', { minimumMinutes: 240 }), 'f')).toContain('al menos 4 horas');
  });

  it('SESSION_POLICY_WOULD_LOCK_OUT_ACTOR: quien guarda quedaría fuera del horario', () => {
    expect(sessionPolicyFailureOf(falla('SESSION_POLICY_WOULD_LOCK_OUT_ACTOR'), 'f')).toContain('fuera de su propia organización');
  });

  it('IP_RULES_WOULD_LOCK_OUT_ACTOR también al guardar políticas: lo explica con la red', () => {
    const texto = sessionPolicyFailureOf(falla('IP_RULES_WOULD_LOCK_OUT_ACTOR'), 'f');
    expect(texto).toContain('red desde la que está trabajando');
    expect(texto).toContain('redes de la organización');
  });

  it('lo demás cae en el mensaje de la API o en el de respaldo', () => {
    expect(sessionPolicyFailureOf(falla('OTRO'), 'f')).toBe('mensaje de la API');
    expect(sessionPolicyFailureOf('x', 'respaldo')).toBe('respaldo');
  });
});
