import { HttpHeaders } from '@angular/common/http';
import { afterEach, describe, expect, it } from 'vitest';

import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import {
  registerServiceSurveyAssignments,
  resetServiceSurveyAssignments,
} from './surveys-service-assignments.handlers';

/** The «Encuestas por servicio» mock follows the 06/11/2026 contract. */
describe('simulador: encuestas estándar por servicio', () => {
  const router = new MockRouter();
  registerServiceSurveyAssignments(router);
  const doctor = buscarUsuario('medica')!;
  const patient = buscarUsuario('paciente')!;

  afterEach(() => resetServiceSurveyAssignments());

  interface Row {
    readonly serviceId: string;
    readonly assignment: { readonly catalogCode: string | null; readonly templateId: string } | null;
  }
  interface Body {
    readonly items: readonly { code: string; source: { license: string }; questions: readonly { answerType: string; required: boolean }[] }[];
    readonly consultation: unknown;
    readonly services: readonly Row[];
    readonly assignment: { readonly catalogCode: string; readonly templateId: string };
    readonly reason: string;
  }

  /** Calls a mock route; the body is typed loosely as the union of what these routes return. */
  function call(method: MockMethod, path: string, caller = doctor, body: unknown = {}): { status: number; body: Body } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const r: unknown = match.handler({ method, path, params: match.params, query: new URLSearchParams(), body, headers: new HttpHeaders(), user: caller });
    return r !== null && typeof r === 'object' && 'status' in r && 'body' in r
      ? (r as { status: number; body: Body })
      : { status: 200, body: r as Body };
  }

  const ECG = uuid('service-ECG');

  it('el catálogo trae plantillas con fuente y preguntas opcionales del juego común', () => {
    const { body } = call('GET', '/surveys/standard-catalog');
    expect(body.items.length).toBeGreaterThanOrEqual(4);
    for (const item of body.items) {
      expect(item.code).toMatch(/^STD_[A-Z_]+_V\d+$/);
      expect(item.source.license).toBeTruthy();
      for (const q of item.questions) {
        expect(['TEXT', 'SCALE', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']).toContain(q.answerType);
        expect(q.required).toBe(false);
      }
    }
    expect(JSON.stringify(body)).not.toMatch(/NPS|Net Promoter/);
  });

  it('la cita médica es del sistema y no reemplazable; un renglón por servicio ofrecido', () => {
    const { body } = call('GET', '/surveys/service-assignments');
    expect(body.consultation).toMatchObject({ system: true, title: 'Cita médica', replaceable: false });
    expect(body.services.length).toBe(5);
    expect(body.services.find((s) => s.serviceId === ECG)?.assignment).toBeNull();
    // Legacy hand-made attachment: reported with catalogCode null (the front reads it as none).
    expect(body.services.find((s) => s.serviceId === uuid('service-TELE-CARDIO'))?.assignment?.catalogCode).toBeNull();
  });

  it('PUT deja UNA activa por servicio, cambiar la reemplaza y DELETE vuelve a la base', () => {
    const first = call('PUT', `/surveys/service-assignments/${ECG}`, doctor, { catalogCode: 'STD_PROCEDURE_V1' });
    expect(first.body.assignment.catalogCode).toBe('STD_PROCEDURE_V1');
    const change = call('PUT', `/surveys/service-assignments/${ECG}`, doctor, { catalogCode: 'STD_LAB_V1' });
    expect(change.body.assignment.catalogCode).toBe('STD_LAB_V1');

    const read = call('GET', '/surveys/service-assignments').body.services.filter(
      (s) => s.serviceId === ECG,
    );
    expect(read).toHaveLength(1);
    expect(read[0]!.assignment?.catalogCode).toBe('STD_LAB_V1');

    expect(call('DELETE', `/surveys/service-assignments/${ECG}`).status).toBe(204);
    expect(
      call('GET', '/surveys/service-assignments').body.services.find((s) => s.serviceId === ECG)?.assignment,
    ).toBeNull();
  });

  it('código desconocido → 404 con SURVEY_CATALOG_CODE_UNKNOWN; servicio ajeno → 403; paciente → 403', () => {
    const unknown = call('PUT', `/surveys/service-assignments/${ECG}`, doctor, { catalogCode: 'STD_NADA_V1' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.reason).toBe('SURVEY_CATALOG_CODE_UNKNOWN');
    expect(call('PUT', `/surveys/service-assignments/${uuid('service-MAPA')}`, doctor, { catalogCode: 'STD_LAB_V1' }).status).toBe(403);
    expect(call('GET', '/surveys/service-assignments', patient).status).toBe(403);
  });

  it('una importación nueva no trae respuestas viejas; la sembrada sí, y las conserva al quitarla y reimportarla', () => {
    const answersOf = (templateId: string): readonly unknown[] => {
      const match = router.match('GET', `/surveys/templates/${templateId}/responses`)!;
      const reply: unknown = match.handler({ method: 'GET', path: '', params: match.params, query: new URLSearchParams(), body: null, headers: new HttpHeaders(), user: doctor });
      return Array.isArray(reply) ? reply : [];
    };
    const fresh = call('PUT', `/surveys/service-assignments/${ECG}`, doctor, { catalogCode: 'STD_PROCEDURE_V1' }).body.assignment;
    expect(answersOf(fresh.templateId)).toEqual([]);

    const echo = uuid('service-ECO-DOPPLER');
    const seeded = call('GET', '/surveys/service-assignments').body.services.find((s) => s.serviceId === echo)!.assignment!;
    expect(answersOf(seeded.templateId).length).toBeGreaterThan(0);
    expect(call('DELETE', `/surveys/service-assignments/${echo}`).status).toBe(204);
    call('PUT', `/surveys/service-assignments/${echo}`, doctor, { catalogCode: 'STD_IMAGING_V1' });
    expect(answersOf(seeded.templateId).length).toBeGreaterThan(0);
  });
});
