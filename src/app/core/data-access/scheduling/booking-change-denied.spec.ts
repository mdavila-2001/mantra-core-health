import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { bookingChangeDeniedText } from './booking-change-denied';

const falla = (status: number, body: Record<string, unknown> = {}): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code: 'FORBIDDEN',
      message: 'Forbidden resource',
      timestamp: '',
      path: '/x',
      ...body,
    },
  });

/**
 * Ronda 2 de la API (G1): un profesional que cancela o mueve la cita de un COLEGA recibe 403 (antes 200). Es un muro, no
 * un error que se reintente: se dice con claridad de quién es la cita y a quién pedírselo.
 */
describe('bookingChangeDeniedText', () => {
  it('un 403 al cancelar dice que la cita no es de su agenda y a quién pedirla', () => {
    const texto = bookingChangeDeniedText(falla(403), 'cancelar')!;
    expect(texto).toContain('no es de su agenda');
    expect(texto).toContain('cancelar');
    expect(texto).toMatch(/quien la atiende|recepción/);
  });

  it('lo mismo al mover', () => {
    expect(bookingChangeDeniedText(falla(403), 'mover')).toContain('mover');
  });

  it('un 403 de un desafío (aprobación, segundo paso, motivo) NO es esto: lo atiende el diálogo de desafíos', () => {
    expect(
      bookingChangeDeniedText(
        falla(403, { reason: 'APPROVAL_REQUIRED', details: { reason: 'APPROVAL_REQUIRED' } }),
        'cancelar',
      ),
    ).toBeNull();
    expect(
      bookingChangeDeniedText(
        falla(403, { reason: 'STEP_UP_UNAVAILABLE', details: { reason: 'STEP_UP_UNAVAILABLE' } }),
        'cancelar',
      ),
    ).toBeNull();
  });

  it('un 403 con un motivo de negocio propio se deja a quien lo explica', () => {
    expect(
      bookingChangeDeniedText(
        falla(403, {
          reason: 'ONBOARDING_INCOMPLETE',
          details: { reason: 'ONBOARDING_INCOMPLETE' },
        }),
        'cancelar',
      ),
    ).toBeNull();
  });

  it('otros estados y otros errores no son esto', () => {
    expect(bookingChangeDeniedText(falla(409), 'cancelar')).toBeNull();
    expect(bookingChangeDeniedText(falla(404), 'cancelar')).toBeNull();
    expect(bookingChangeDeniedText(new Error('x'), 'cancelar')).toBeNull();
  });
});
