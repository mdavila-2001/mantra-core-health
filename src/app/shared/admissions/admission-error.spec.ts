import { HttpErrorResponse } from '@angular/common/http';

import { readAdmissionError, roleSentence } from './admission-error';

const err = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('readAdmissionError', () => {
  it('409 es versión vieja, venga el motivo en details.reason o en el code', () => {
    for (const cuerpo of [
      { code: 'CONFLICT', details: { reason: 'ADMISSION_STALE' } },
      { code: 'ADMISSION_STALE', message: 'x' },
      null,
    ]) {
      const e = readAdmissionError(err(409, cuerpo));
      expect(e.kind).toBe('stale');
      expect(e.message).toContain('Otra persona modificó');
    }
  });

  it('403 por rol nombra el rol que falta con su etiqueta, el de la API o el de la acción', () => {
    const api = readAdmissionError(err(403, { code: 'FORBIDDEN', details: { reason: 'ADMISSION_ROLE_REQUIRED', requiredRole: 'ADMISSIONS_APPROVER' } }));
    expect(api.kind).toBe('role');
    expect(api.requiredRole).toBe('ADMISSIONS_APPROVER');
    expect(api.message).toContain('«Aprobación de admisiones»');
    const reserva = readAdmissionError(err(403, { code: 'FORBIDDEN' }), 'ADMISSIONS_REVIEWER');
    expect(reserva.message).toContain('«Revisión de admisiones»');
    expect(readAdmissionError(err(403, null)).message).toBe('Su cuenta no tiene permiso para esta acción.');
  });

  it('403 de cuatro ojos y de no asignada usan las palabras de la API', () => {
    const o = readAdmissionError(err(403, { code: 'FORBIDDEN', message: 'Otra persona debe aprobar.', details: { reason: 'ADMISSION_FOUR_EYES' } }));
    expect(o.kind).toBe('four-eyes');
    expect(o.message).toBe('Otra persona debe aprobar.');
    expect(readAdmissionError(err(403, { details: { reason: 'ADMISSION_NOT_ASSIGNED' } })).kind).toBe('not-assigned');
  });

  it('412 y 422 son precondición y traen el mensaje de la API', () => {
    const e = readAdmissionError(err(412, { code: 'PRECONDITION_FAILED', message: 'Falta la fuente.', details: { reason: 'ADMISSION_ITEM_REQUIRES_SOURCE' } }));
    expect(e.kind).toBe('precondition');
    expect(e.reason).toBe('ADMISSION_ITEM_REQUIRES_SOURCE');
    expect(e.message).toBe('Falta la fuente.');
    expect(readAdmissionError(err(422, null)).kind).toBe('precondition');
  });

  it('404, sin conexión y lo inesperado', () => {
    expect(readAdmissionError(err(404)).kind).toBe('not-found');
    expect(readAdmissionError(err(0)).kind).toBe('offline');
    expect(readAdmissionError(new Error('boom')).kind).toBe('other');
    expect(readAdmissionError(err(500, { message: 'caído', correlationId: 'abc' }))).toMatchObject({ kind: 'other', requestId: 'abc' });
  });

  it('roleSentence usa la etiqueta y, sin ella, el código', () => {
    expect(roleSentence('ADMISSIONS_REVIEWER')).toBe('«Revisión de admisiones»');
    expect(roleSentence('ROL_RARO')).toBe('«ROL_RARO»');
  });
});
