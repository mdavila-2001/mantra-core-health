import { HttpErrorResponse } from '@angular/common/http';

import { readAdmissionError, roleSentence } from './admission-error';

const err = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('readAdmissionError', () => {
  it('409 es versión vieja, venga el motivo en `reason` (como lo manda la API), en details.reason o en el code', () => {
    for (const cuerpo of [
      { code: 'CONFLICT', reason: 'ADMISSION_STALE' },
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
    const api = readAdmissionError(err(403, { code: 'FORBIDDEN', reason: 'ADMISSION_ROLE_REQUIRED', details: { requiredRole: 'ADMISSIONS_APPROVER' } }));
    expect(api.kind).toBe('role');
    expect(api.requiredRole).toBe('ADMISSIONS_APPROVER');
    expect(api.message).toContain('«Aprobación de admisiones»');
    const reserva = readAdmissionError(err(403, { code: 'FORBIDDEN' }), 'ADMISSIONS_REVIEWER');
    expect(reserva.message).toContain('«Revisión de admisiones»');
    expect(readAdmissionError(err(403, null)).message).toBe('Su cuenta no tiene permiso para esta acción.');
  });

  it('403 de cuatro ojos y de no asignada usan las palabras de la API', () => {
    const o = readAdmissionError(err(403, { code: 'FORBIDDEN', message: 'Otra persona debe aprobar.', reason: 'ADMISSION_FOUR_EYES_REQUIRED' }));
    expect(o.kind).toBe('four-eyes');
    expect(o.message).toBe('Otra persona debe aprobar.');
    expect(readAdmissionError(err(403, { reason: 'ADMISSION_NOT_ASSIGNED_TO_ACTOR' })).kind).toBe('not-assigned');
  });

  it('412 y 422 son precondición: un motivo conocido se dice en usted, uno desconocido usa el texto de la API', () => {
    const e = readAdmissionError(err(412, { code: 'PRECONDITION_FAILED', message: 'Falta la fuente.', reason: 'ADMISSION_ITEM_REQUIRES_SOURCE' }));
    expect(e.kind).toBe('precondition');
    expect(e.reason).toBe('ADMISSION_ITEM_REQUIRES_SOURCE');
    expect(e.message).toBe('Para verificar, indique de dónde obtuvo el dato.');
    expect(readAdmissionError(err(412, { message: 'Algo nuevo.', reason: 'ADMISSION_ALGO_NUEVO' })).message).toBe('Algo nuevo.');
    expect(readAdmissionError(err(422, null)).kind).toBe('precondition');
  });

  it('cada precondición del servidor tiene su frase: checklist, atestación, tope de reenvíos…', () => {
    const dice = (reason: string): string => readAdmissionError(err(412, { reason })).message;
    expect(dice('ADMISSION_CHECKLIST_INCOMPLETE')).toContain('requisitos obligatorios');
    expect(dice('ADMISSION_ATTESTATION_REQUIRED')).toContain('declaración');
    expect(dice('ADMISSION_RESUBMISSION_LIMIT')).toContain('máximo de reenvíos');
    expect(dice('ADMISSION_INVALID_TRANSITION')).toContain('ya no está');
  });

  it('409 de evidencia cambiada y 403 de auto-acceso se distinguen de una versión vieja', () => {
    const cambio = readAdmissionError(err(409, { code: 'CONFLICT', reason: 'ADMISSION_EVIDENCE_CHANGED' }));
    expect(cambio.kind).toBe('evidence-changed');
    expect(cambio.message).toBe('El profesional cambió este documento; revíselo de nuevo.');
    const propio = readAdmissionError(err(403, { code: 'FORBIDDEN', reason: 'ADMISSION_SELF_ACCESS' }));
    expect(propio.kind).toBe('self-access');
    expect(propio.message).toContain('No puede revisar su propia solicitud');
  });

  it('una ficha que ya no existe en la admisión pide cargar la versión actual, no da la admisión por perdida', () => {
    const e = readAdmissionError(err(404, { reason: 'ADMISSION_ITEM_NOT_FOUND' }));
    expect(e.kind).toBe('stale');
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
