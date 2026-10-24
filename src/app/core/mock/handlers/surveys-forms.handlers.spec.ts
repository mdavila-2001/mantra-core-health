import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';

describe('encuestas y formularios del backend demo', () => {
  const router = new MockRouter();
  const storageKeys = ['mock.surveys-forms.encuestas', 'mock.surveys-forms.invitaciones'];
  const previous = new Map<string, string | null>();
  const patient = buscarUsuario('paciente')!;

  beforeAll(async () => {
    for (const key of storageKeys) {
      previous.set(key, sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
    }
    vi.resetModules();
    const { registrarEncuestas } = await import('./surveys-forms.handlers');
    registrarEncuestas(router);
  });

  afterAll(() => {
    for (const key of storageKeys) {
      const value = previous.get(key);
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    }
    vi.resetModules();
  });

  function request(method: MockMethod, path: string, body: unknown = {}, query = new URLSearchParams()) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user: patient,
    } satisfies MockRequest);
  }

  const status = (response: unknown) => isMockReply(response) ? response.status : 200;
  const data = <T>(response: unknown) => (isMockReply(response) ? response.body : response) as T;

  it('edita preguntas en borrador, conserva el orden y bloquea cambios publicados', () => {
    const templates = '/surveys/templates';
    const created = data<{ id: string; versionId: string }>(
      request('POST', templates, { title: 'Encuesta sintética', responseWindowDays: 10 }),
    );
    const path = `${templates}/${created.id}`;
    expect(data<{ title: string; responseWindowDays: number }>(request('GET', path)))
      .toMatchObject({ title: 'Encuesta sintética', responseWindowDays: 10 });
    expect(status(request('PATCH', path, { description: 'Evaluación de prueba', responseWindowDays: 14 }))).toBe(200);

    const choice = data<{ id: string; position: number }>(request('POST', `${path}/questions`, {
      questionText: '¿Qué opción?', answerType: 'SINGLE_CHOICE', options: ['A', 'B'], required: true,
    }));
    const scale = data<{ id: string; position: number }>(request('POST', `${path}/questions`, {
      questionText: '¿Cuánto?', answerType: 'SCALE', scaleMin: 0, scaleMax: 10,
    }));
    expect([choice.position, scale.position]).toEqual([1, 2]);
    expect(status(request('PATCH', `${path}/questions/${choice.id}`, {
      questionText: 'Comentario libre', answerType: 'TEXT', required: false,
    }))).toBe(200);
    const edited = data<{ questions: { id: string; questionText: string; options?: string[] }[] }>(request('GET', path));
    expect(edited.questions[0]).toMatchObject({ questionText: 'Comentario libre' });
    expect(edited.questions[0]).not.toHaveProperty('options');

    expect(status(request('PUT', `${path}/questions/order`, { questionIds: [scale.id] }))).toBe(200);
    expect(data<{ questions: { id: string; position: number }[] }>(request('GET', path)).questions)
      .toMatchObject([{ id: scale.id, position: 1 }, { id: choice.id, position: 2 }]);
    expect(status(request('DELETE', `${path}/questions/${scale.id}`))).toBe(200);
    expect(data<{ questions: { id: string; position: number }[] }>(request('GET', path)).questions)
      .toMatchObject([{ id: choice.id, position: 1 }]);

    expect(status(request('POST', `${path}/publish`, { effectiveFrom: '2026-10-01' }))).toBe(200);
    expect(status(request('PATCH', path, { title: 'No permitido' }))).toBe(422);
    expect(status(request('PATCH', `${path}/questions/${choice.id}`, { questionText: 'No permitido' }))).toBe(422);
    expect(status(request('DELETE', `${path}/questions/${choice.id}`))).toBe(422);
    expect(status(request('PUT', `${path}/questions/order`, { questionIds: [choice.id] }))).toBe(422);
    expect(data<{ title: string }>(request('GET', path)).title).toBe('Encuesta sintética');
    expect(status(request('POST', `${path}/versions`))).toBe(201);
    expect(status(request('PATCH', path, { title: 'Versión nueva' }))).toBe(200);
    expect(status(request('POST', `${path}/versions/${created.versionId}/publish`))).toBe(200);
    expect(status(request('POST', `${path}/deactivate`))).toBe(200);
    expect(data<{ status: string }>(request('GET', path)).status).toBe('INACTIVE');
  });

  it('reporta recursos inexistentes y respuestas de invitaciones', () => {
    const missing = '/surveys/templates/missing';
    expect(status(request('GET', missing))).toBe(404);
    expect(status(request('POST', `${missing}/versions`))).toBe(404);
    expect(status(request('POST', `${missing}/questions`))).toBe(404);
    expect(status(request('PATCH', missing))).toBe(404);
    expect(status(request('PATCH', `${missing}/questions/missing`))).toBe(404);
    expect(status(request('DELETE', `${missing}/questions/missing`))).toBe(404);
    expect(status(request('PUT', `${missing}/questions/order`, { questionIds: [] }))).toBe(404);
    expect(status(request('POST', `${missing}/publish`))).toBe(404);
    expect(status(request('POST', `${missing}/versions/missing/publish`))).toBe(404);
    expect(status(request('POST', `${missing}/deactivate`))).toBe(404);
    expect(status(request('GET', `${missing}/responses`))).toBe(404);

    const templates = data<{ id: string; published: boolean }[]>(request('GET', '/surveys/templates'));
    const active = templates.find((template) => template.published)!;
    expect(data<unknown[]>(request('GET', `/surveys/templates/${active.id}/responses`)).length).toBeGreaterThan(0);
    const invites = data<{ id: string; status: string }[]>(request('GET', '/surveys/me/invitations'));
    const pending = invites.find((invite) => invite.status === 'PENDING')!;
    expect(data<{ id: string; questions: unknown[] }>(request('GET', `/surveys/me/invitations/${pending.id}`)).questions.length).toBeGreaterThan(0);
    expect(status(request('POST', `/surveys/me/invitations/${pending.id}/responses`))).toBe(201);
    expect(data<{ status: string }>(request('GET', `/surveys/me/invitations/${pending.id}`)).status).toBe('ANSWERED');
    expect(status(request('GET', '/surveys/me/invitations/missing'))).toBe(404);
    expect(status(request('POST', '/surveys/me/invitations/missing/responses'))).toBe(404);
    expect(data<{ ids: string[] }>(request('POST', '/surveys/invitations', { appointmentBookingIds: ['a', 'b'] })).ids).toHaveLength(2);
    expect(status(request('POST', '/surveys/assignments'))).toBe(201);
  });

  it('crea, lee, completa y cierra instancias de formulario', () => {
    const path = '/forms/instances';
    const created = data<{ id: string; schemaVersion: number; state: string }>(
      request('POST', path, { resourceId: 'synthetic-encounter', schemaVersion: 2 }),
    );
    expect(created).toMatchObject({ schemaVersion: 2, state: 'OPEN' });
    expect(status(request('POST', `${path}/missing/values`, { values: [] }))).toBe(404);
    expect(data<{ captured: number }>(request('POST', `${path}/${created.id}/values`, {
      values: [{ fieldId: 'synthetic-field', dataType: 'string', value: 'synthetic-value' }],
    }))).toMatchObject({ captured: 1 });
    expect(data<{ items: { id: string }[] }>(
      request('GET', path, {}, new URLSearchParams({ encounter: 'synthetic-encounter' })),
    ).items).toMatchObject([{ id: created.id }]);
    expect(data<{ items: { id: string }[] }>(
      request('GET', path, {}, new URLSearchParams({ encounterId: 'synthetic-encounter' })),
    ).items).toMatchObject([{ id: created.id }]);
    expect(data<{ values: { value: string }[] }>(request('GET', `${path}/${created.id}`)).values)
      .toMatchObject([{ value: 'synthetic-value' }]);
    expect(status(request('POST', `${path}/${created.id}/close`))).toBe(200);
    expect(data<{ closedAt: string }>(request('GET', `/forms/me/instances/${created.id}`)).closedAt).toBeTruthy();
    expect(status(request('GET', `${path}/missing`))).toBe(404);
    expect(status(request('GET', '/forms/me/instances/missing'))).toBe(404);
    expect(data<{ items: { id: string }[] }>(request('GET', '/forms/me/instances')).items.some((item) => item.id === created.id)).toBe(true);
  });

  it('mantiene campos propios editables y protege los del estándar', async () => {
    const { plantillasVigentes } = await import('./clinical.handlers');
    const template = plantillasVigentes().find((item) => item.fields.some((field) => !field.own))!;
    const target = template.fieldTargetConceptId;
    const standard = template.fields.find((field) => !field.own)!;
    const initial = data<{ used: number }>(request(
      'GET', '/forms/assignments/budget', {}, new URLSearchParams({ targetResourceConceptId: target }),
    )).used;

    const definition = data<{ id: string }>(request('POST', '/forms/field-definitions', {
      code: 'QA-GRID', name: 'Cuadrícula sintética', dataType: 'grid',
      options: ['A', 'B'], rows: ['Fila 1'], description: 'Descripción de prueba',
      cardinalityMin: 1, cardinalityMax: 2, requireEachRow: true, oneResponsePerColumn: true,
    }));
    expect(status(request('POST', '/forms/assignments', {
      fieldId: definition.id, targetResourceConceptId: 'missing',
    }))).toBe(404);
    expect(status(request('POST', '/forms/assignments', {
      fieldId: 'missing', targetResourceConceptId: target,
    }))).toBe(404);
    const assignment = data<{ id: string }>(request('POST', '/forms/assignments', {
      fieldId: definition.id, targetResourceConceptId: target, required: true,
    }));
    expect(template.fields.find((field) => field.assignmentId === assignment.id))
      .toMatchObject({ name: 'Cuadrícula sintética', rows: ['Fila 1'], options: ['A', 'B'], required: true, own: true });
    expect(data<{ used: number }>(request(
      'GET', '/forms/assignments/budget', {}, new URLSearchParams({ targetResourceConceptId: target }),
    )).used).toBe(initial + 1);

    expect(status(request('PATCH', `/forms/field-definitions/${definition.id}`, {
      name: 'Pregunta de elección', dataType: 'choice', options: ['Sí', 'No'],
      rows: [], description: null, cardinalityMin: null, cardinalityMax: null,
    }))).toBe(200);
    const edited = template.fields.find((field) => field.assignmentId === assignment.id)!;
    expect(edited).toMatchObject({ name: 'Pregunta de elección', options: ['Sí', 'No'] });
    expect(edited).not.toHaveProperty('rows');
    expect(edited).not.toHaveProperty('description');
    expect(edited).not.toHaveProperty('cardinalityMin');
    expect(edited).not.toHaveProperty('cardinalityMax');
    expect(status(request('PATCH', `/forms/assignments/${assignment.id}`, { required: false }))).toBe(200);
    expect(template.fields.find((field) => field.assignmentId === assignment.id)?.required).toBe(false);
    expect(status(request('PATCH', `/forms/assignments/${standard.assignmentId}`, { required: false }))).toBe(403);
    expect(status(request('DELETE', `/forms/assignments/${standard.assignmentId}`))).toBe(403);

    const secondDefinition = data<{ id: string }>(request('POST', '/forms/field-definitions', {
      code: 'QA-TEXT', name: 'Texto sintético', dataType: 'string',
    }));
    const second = data<{ id: string }>(request('POST', '/forms/assignments', {
      fieldId: secondDefinition.id, targetResourceConceptId: target,
    }));
    expect(status(request('PUT', '/forms/assignments/order', {
      targetResourceConceptId: target, assignmentIds: [second.id, assignment.id],
    }))).toBe(200);
    expect(template.fields.filter((field) => field.own).map((field) => field.assignmentId))
      .toEqual([second.id, assignment.id]);
    expect(status(request('DELETE', `/forms/assignments/${assignment.id}`))).toBe(200);
    expect(status(request('DELETE', `/forms/assignments/${second.id}`))).toBe(200);
    expect(data<{ used: number }>(request(
      'GET', '/forms/assignments/budget', {}, new URLSearchParams({ targetResourceConceptId: target }),
    )).used).toBe(initial);
    expect(status(request('PATCH', '/forms/assignments/missing', { required: true }))).toBe(404);
    expect(status(request('DELETE', '/forms/assignments/missing'))).toBe(404);
  });
});
