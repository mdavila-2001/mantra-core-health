import { HttpHeaders } from '@angular/common/http';

import { registrarAgenda } from './scheduling.handlers';
import { RECURSO_MEDICA } from '../fixtures/agenda';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * El doble de los bloqueos de agenda no puede ser más permisivo que el
 * contrato real: la API valida `exceptionType` contra la lista cerrada de 7
 * (`scheduling-catalog.dto.ts:735`, `@IsIn(EXCEPTION_TYPES)` en la 754).
 * Estos tests cubren los tres niveles del contrato (regla 65): correcto,
 * límite e inválido.
 */
describe('handlers de bloqueos de agenda (excepciones)', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  const medica = buscarUsuario('medica')!;

  function call<T>(method: MockMethod, path: string, body: unknown = {}): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: medica,
    });
    return (
      resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado
        ? (resultado as { body: T }).body
        : resultado
    ) as T;
  }

  function estado(method: MockMethod, path: string, body: unknown = {}): number {
    const match = router.match(method, path)!;
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: medica,
    });
    return resultado !== null && typeof resultado === 'object' && 'status' in resultado ? (resultado as { status: number }).status : 200;
  }

  it('la lista de tipos de excepción tiene exactamente los 7 del contrato real', () => {
    const { items } = call<{ items: readonly { type: string }[] }>('GET', '/scheduling/exception-types');
    expect(items.map((i) => i.type)).toEqual(['ABSENCE', 'HOLIDAY', 'VACATION', 'CONFERENCE', 'ERRAND', 'EXTRA', 'OTHER']);
  });

  it('correcto — "otros servicios" viaja como OTHER + texto libre, sin ampliar el enum (H2.S1)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string; blockedSlots: number }>('POST', path, {
      exceptionType: 'OTHER',
      reason: 'Otros servicios',
      startAt: '2026-10-01T10:00:00.000Z',
      endAt: '2026-10-01T11:00:00.000Z',
    });
    expect(creado.id).toBeTypeOf('string');

    // La lectura de la lista NO trae `exceptionType` (lo saca a propósito el
    // manejador: `.map(({ resourceId: _r, exceptionType: _e, ...b }) => b)`),
    // así que el motivo se verifica por `reasonLabel`, como lo ve la agenda.
    const { items } = call<{ items: readonly { id: string; reason: string; reasonLabel: string }[] }>(
      'GET',
      `/scheduling/resources/${RECURSO_MEDICA}/exceptions`,
    );
    const propia = items.find((i) => i.id === creado.id)!;
    expect(propia.reason).toBe('Otros servicios');
    expect(propia.reasonLabel).toBe('Otro');
  });

  it('correcto — EXTRA (horario extra de Pablo) crea disponibilidad, no un bloqueo (H2.S2)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string; blockedSlots: number }>('POST', path, {
      exceptionType: 'EXTRA',
      startAt: '2026-10-02T18:00:00.000Z',
      endAt: '2026-10-02T19:00:00.000Z',
    });
    expect(creado.blockedSlots).toBe(0);

    const { items } = call<{ items: readonly { id: string; reasonLabel: string; isAvailable: boolean }[] }>(
      'GET',
      `/scheduling/resources/${RECURSO_MEDICA}/exceptions`,
    );
    const propia = items.find((i) => i.id === creado.id)!;
    expect(propia.reasonLabel).toBe('Horario extra');
    expect(propia.isAvailable).toBe(false); // isAvailable no viajó: el default es "no libera cupos", coherente con "no bloquea" != "es disponibilidad publicada"
  });

  it('límite — una franja de 1 minuto se acepta', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(
      estado('POST', path, { exceptionType: 'EXTRA', startAt: '2026-10-03T08:00:00.000Z', endAt: '2026-10-03T08:01:00.000Z' }),
    ).toBe(201);
  });

  it('inválido — un exceptionType fuera de la lista de 7 se rechaza con 422, no se acepta en silencio', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(estado('POST', path, { exceptionType: 'SERVICE', startAt: '2026-10-04T08:00:00.000Z', endAt: '2026-10-04T09:00:00.000Z' })).toBe(
      422,
    );
  });

  it('inválido — una franja invertida (fin antes que inicio) se rechaza', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(
      estado('POST', path, { exceptionType: 'ABSENCE', startAt: '2026-10-05T10:00:00.000Z', endAt: '2026-10-05T09:00:00.000Z' }),
    ).toBe(422);
  });

  it('inválido — una franja de cero minutos se rechaza', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(
      estado('POST', path, { exceptionType: 'ABSENCE', startAt: '2026-10-06T10:00:00.000Z', endAt: '2026-10-06T10:00:00.000Z' }),
    ).toBe(422);
  });

  it('PATCH también rechaza un exceptionType inválido, sin dejarlo pasar en silencio', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string }>('POST', path, {
      exceptionType: 'HOLIDAY',
      startAt: '2026-10-07T08:00:00.000Z',
      endAt: '2026-10-07T09:00:00.000Z',
    });
    expect(estado('PATCH', `/scheduling/exceptions/${creado.id}`, { exceptionType: 'NOPE' })).toBe(422);
  });
});
