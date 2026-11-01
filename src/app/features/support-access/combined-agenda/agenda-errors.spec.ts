import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { explanationOf } from '../../../core/http/error-explanation';
import { failureMessage } from './agenda-errors';

const respuesta = (status: number, code: string, message: string): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { statusCode: status, code, message, error: 'x' } });

describe('lo que la API dijo cuando falló una acción', () => {
  it('un conflicto o una regla de negocio llegan con las palabras de la API', () => {
    expect(failureMessage(respuesta(409, 'CONFLICT', 'Ese horario ya no está libre.'), 'No pudimos.')).toBe('Ese horario ya no está libre.');
    expect(failureMessage(respuesta(422, 'PRECONDITION_FAILED', 'Escriba por qué se cancela la cita.'), 'No pudimos.')).toBe('Escriba por qué se cancela la cita.');
  });

  it('un 403 trae el motivo del permiso', () => {
    expect(failureMessage(respuesta(403, 'FORBIDDEN', 'Su permiso no incluye «crear citas».'), 'No pudimos.')).toBe('Su permiso no incluye «crear citas».');
  });

  it('sin conexión lo dice con palabras de quien está frente a la pantalla', () => {
    expect(failureMessage(new HttpErrorResponse({ status: 0 }), 'No pudimos.')).toContain('Sin conexión');
  });

  it('un fallo que no es de la API cae al texto de reserva', () => {
    expect(failureMessage(new Error('boom'), 'No pudimos completar la acción.')).toBe(
      `No pudimos completar la acción. ${explanationOf('client').cause}`,
    );
    const proxy = failureMessage(new HttpErrorResponse({ status: 502, error: '<html>' }), 'No pudimos completar la acción.');
    expect(proxy).toBe(`No pudimos completar la acción. ${explanationOf('unavailable').cause}`);
    expect(proxy).not.toContain('<html>');
  });
});
