import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { patientFailureMessage } from './patient-failure';

function failure(status: number, code: string, message: string, details: Record<string, unknown>): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { statusCode: status, code, message, details, timestamp: '', path: '' } });
}

describe('patientFailureMessage', () => {
  it('429 por persona y por minuto: pide esperar un minuto', () => {
    const texto = patientFailureMessage(failure(429, 'RATE_LIMITED', 'x', { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit: 'PER_MINUTE', scope: 'PERSON' }), 'f');
    expect(texto).toContain('Hizo demasiadas consultas');
    expect(texto).toContain('un minuto');
  });

  it('429 por persona y por día: dice que podrá seguir mañana', () => {
    const texto = patientFailureMessage(failure(429, 'RATE_LIMITED', 'x', { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit: 'PER_DAY', scope: 'PERSON' }), 'f');
    expect(texto).toContain('máximo de consultas de pacientes de hoy');
  });

  it('429 por IP: aclara que no es un problema de su cuenta', () => {
    const minuto = patientFailureMessage(failure(429, 'RATE_LIMITED', 'x', { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit: 'PER_MINUTE', scope: 'IP' }), 'f');
    const dia = patientFailureMessage(failure(429, 'RATE_LIMITED', 'x', { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit: 'PER_DAY', scope: 'IP' }), 'f');
    expect(minuto).toContain('esta conexión');
    expect(minuto).toContain('No es un problema de su cuenta');
    expect(dia).toContain('esta conexión');
    expect(dia).toContain('mañana');
    expect(minuto).not.toBe(dia);
  });

  it('409 de documento registrado: lo dice también para las variantes del mismo documento', () => {
    const texto = patientFailureMessage(failure(409, 'CONFLICT', 'Ese documento ya está registrado.', { reason: 'SUPPORT_PATIENT_DOCUMENT_REGISTERED' }), 'f');
    expect(texto).toContain('de otra forma');
    expect(texto).toContain('Búsquelo por documento');
  });

  it('400 de documento sin contenido: explica el mínimo', () => {
    const texto = patientFailureMessage(failure(400, 'VALIDATION_FAILED', 'El documento de identidad no es válido.', { field: 'document' }), 'f');
    expect(texto).toContain('al menos 4');
  });

  it('cualquier otro fallo usa el texto de la API o el de respaldo', () => {
    expect(patientFailureMessage(failure(403, 'FORBIDDEN', 'Su permiso no incluye registrar pacientes.', {}), 'f')).toBe('Su permiso no incluye registrar pacientes.');
    expect(patientFailureMessage('algo', 'respaldo').length).toBeGreaterThan(0);
  });
});
