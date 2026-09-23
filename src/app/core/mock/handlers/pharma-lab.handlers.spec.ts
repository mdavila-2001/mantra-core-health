import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { PACIENTE } from '../fixtures/personas';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * H3 — duración de la visita del visitador (configurable, 15 min por
 * omisión, tope según la política del doctor) y el límite de acceso del
 * visitador a información clínica. Contrato real citado:
 * `mantra-core-health-api/src/modules/pharma_lab/dto/visits.dto.ts` (durationMinutes:
 * `@IsInt() @Min(5) @Max(240)`) y `visit-agenda.service.ts:assertSlotAvailable`
 * (`PreconditionFailedException` = 422 si supera `maxDurationMinutes`).
 */
describe('handlers de laboratorio farmacéutico: duración de visita y límite de acceso', () => {
  const router = crearRouterSimulado();
  const visitador = buscarUsuario('visitador')!;
  const medica = buscarUsuario('medica')!;

  function pedir(method: MockMethod, path: string, user: typeof medica | null, body: unknown = {}) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  function estado(resultado: unknown): number {
    return isMockReply(resultado) ? resultado.status : 200;
  }

  function cuerpoDe<T>(resultado: unknown): T {
    return (isMockReply(resultado) ? resultado.body : resultado) as T;
  }

  describe('duración configurable de la visita (C-13)', () => {
    it('correcto — sin durationMinutes, la visita dura 15 minutos por omisión', () => {
      const resultado = pedir('POST', '/visit-requests', medica, {
        doctorUserId: medica.id,
        reason: 'Presentación de producto',
        requestedStartAt: '2026-10-10T13:00:00.000Z',
        modalityConceptId: 'x',
      });
      expect(estado(resultado)).toBe(201);
      const { id } = cuerpoDe<{ id: string }>(resultado);
      const propia = cuerpoDe<readonly { id: string; durationMinutes: number }[]>(pedir('GET', '/visit-requests/mine', medica)).find(
        (s) => s.id === id,
      )!;
      expect(propia.durationMinutes).toBe(15);
    });

    it('correcto — con durationMinutes explícito dentro del tope de la política, dura eso', () => {
      // La política de MEDICA declara maxDurationMinutes: 20 (fixtures/agenda o
      // pharma-lab.handlers.ts según quién la haya definido para su usuario).
      const resultado = pedir('POST', '/visit-requests', medica, {
        doctorUserId: medica.id,
        reason: 'Seguimiento',
        requestedStartAt: '2026-10-11T13:00:00.000Z',
        durationMinutes: 20,
        modalityConceptId: 'x',
      });
      expect(estado(resultado)).toBe(201);
    });

    it('límite — el mínimo del contrato real (5 minutos) se acepta', () => {
      const resultado = pedir('POST', '/visit-requests', medica, {
        doctorUserId: medica.id,
        reason: 'Entrega de muestra',
        requestedStartAt: '2026-10-12T13:00:00.000Z',
        durationMinutes: 5,
        modalityConceptId: 'x',
      });
      expect(estado(resultado)).toBe(201);
    });

    it('inválido — cero minutos se rechaza (400, mismo contrato que el ValidationPipe real)', () => {
      expect(
        estado(
          pedir('POST', '/visit-requests', medica, {
            doctorUserId: medica.id,
            reason: 'x',
            requestedStartAt: '2026-10-13T13:00:00.000Z',
            durationMinutes: 0,
            modalityConceptId: 'x',
          }),
        ),
      ).toBe(400);
    });

    it('inválido — un número negativo se rechaza', () => {
      expect(
        estado(
          pedir('POST', '/visit-requests', medica, {
            doctorUserId: medica.id,
            reason: 'x',
            requestedStartAt: '2026-10-13T13:00:00.000Z',
            durationMinutes: -10,
            modalityConceptId: 'x',
          }),
        ),
      ).toBe(400);
    });

    it('inválido — superar el tope de la política del doctor se rechaza con 422, no con silencio', () => {
      expect(
        estado(
          pedir('POST', '/visit-requests', medica, {
            doctorUserId: medica.id,
            reason: 'x',
            requestedStartAt: '2026-10-13T13:00:00.000Z',
            durationMinutes: 200,
            modalityConceptId: 'x',
          }),
        ),
      ).toBe(422);
    });
  });

  describe('límite de acceso: el visitador no ve información clínica (H3.S3)', () => {
    it('el visitador NO puede leer el resumen clínico de un paciente (403)', () => {
      const resultado = pedir('GET', `/clinical/patients/${PACIENTE.id}/summary`, visitador);
      expect(estado(resultado)).toBe(403);
    });

    it('el visitador NO puede leer el expediente (chart) de un paciente (403)', () => {
      const resultado = pedir('GET', `/charts/patients/${PACIENTE.id}/chart`, visitador);
      expect(estado(resultado)).toBe(403);
    });

    it('la médica (practitioner) SÍ puede leer el resumen clínico — la restricción es del rol, no global', () => {
      const resultado = pedir('GET', `/clinical/patients/${PACIENTE.id}/summary`, medica);
      expect(estado(resultado)).toBe(200);
    });

    it('la respuesta de "mis solicitudes de visita" no trae ningún campo de paciente ni clínico', () => {
      const solicitudes = cuerpoDe<readonly Record<string, unknown>[]>(pedir('GET', '/visit-requests/mine', visitador));
      expect(solicitudes.length).toBeGreaterThan(0);
      const camposProhibidos = ['patientProfileId', 'patientName', 'diagnosis', 'condition', 'medication'];
      for (const solicitud of solicitudes) {
        for (const campo of camposProhibidos) {
          expect(Object.keys(solicitud)).not.toContain(campo);
        }
      }
    });
  });
});
