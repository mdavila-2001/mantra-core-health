import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { reportErrorState } from './report-error-state';

describe('reportErrorState', () => {
  const forbidden = (message?: string): HttpErrorResponse =>
    new HttpErrorResponse({ status: 403, error: message === undefined ? { code: 'FORBIDDEN' } : { code: 'FORBIDDEN', message } });

  it('un 403 nunca queda en un muro: dice a quién pedir acceso y ofrece volver al inicio', () => {
    const state = reportErrorState(forbidden('Su rol no puede ver este reporte.'));
    expect(state.status).toBe('forbidden');
    if (state.status !== 'forbidden') {
      return;
    }
    expect(state.message).toBe('Su rol no puede ver este reporte. Pida acceso a quien administra su organización.');
    expect(state.nextAction).toEqual({ label: 'Volver al inicio', route: '/' });
  });

  it('sin texto del servidor, igual orienta', () => {
    const state = reportErrorState(forbidden());
    expect(state.status).toBe('forbidden');
    expect(state.status === 'forbidden' && state.message).toContain('Pida acceso a quien administra su organización.');
  });

  it('no repite el punto cuando el servidor ya lo trae', () => {
    const state = reportErrorState(forbidden('Sin permiso...'));
    expect(state.status === 'forbidden' && state.message).toMatch(/Sin permiso\. Pida acceso/);
  });

  it('los demás errores no se tocan', () => {
    expect(reportErrorState(new HttpErrorResponse({ status: 500 })).status).toBe('error');
    expect(reportErrorState(new HttpErrorResponse({ status: 0 })).status).toBe('offline');
  });
});
