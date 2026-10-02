import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarPortalAdministrativo } from './admin-portal.handlers';

describe('portal administrativo demo: catálogo, revisión y planes QA', () => {
  const router = new MockRouter();
  registrarPortalAdministrativo(router);
  const author = buscarUsuario('superadmin')!;
  const reviewer = buscarUsuario('medica')!;

  function request(
    method: MockMethod,
    path: string,
    body: unknown = {},
    query = new URLSearchParams(),
    user = author,
  ) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  const status = (response: unknown) => isMockReply(response) ? response.status : 200;
  const data = <T>(response: unknown) => (isMockReply(response) ? response.body : response) as T;

  it('filtra catálogo y muestra columnas, cambios e impacto de un objeto', () => {
    const schemas = data<{ schemaName: string; objects: number }[]>(request('GET', '/admin/catalog/schemas'));
    expect(schemas.length).toBeGreaterThan(1);
    const page = data<{ items: { id: string; schemaName: string }[]; nextCursor: string | null }>(
      request('GET', '/admin/catalog/objects', {}, new URLSearchParams({ schema: schemas[0]!.schemaName, limit: '1' })),
    );
    expect(page.items).toHaveLength(1);
    const id = page.items[0]!.id;
    const detail = data<{ technical: { schemaName: string; columnCount: number }; coverage: { technical: string } }>(
      request('GET', `/admin/catalog/objects/${id}`),
    );
    expect(detail.technical.schemaName).toBe(schemas[0]!.schemaName);
    expect(detail.coverage.technical).toBe('COMPLETE');
    expect(data<{ items: unknown[] }>(request('GET', `/admin/catalog/objects/${id}/columns`)).items)
      .toHaveLength(detail.technical.columnCount);
    expect(data<{ items: unknown[] }>(request('GET', `/admin/catalog/objects/${id}/changes`)).items).toHaveLength(1);
    expect(data<{ root: string; nodes: { objectId: string }[] }>(
      request('GET', `/admin/catalog/objects/${id}/impact`, {}, new URLSearchParams({ direction: 'both', depth: '2' })),
    )).toMatchObject({ root: id, nodes: expect.arrayContaining([expect.objectContaining({ objectId: id })]) });
    expect(data<{ denominator: number }>(request('GET', '/admin/catalog/coverage')).denominator).toBeGreaterThan(0);
    expect(data<{ denominator: number }>(
      request('GET', '/admin/catalog/coverage', {}, new URLSearchParams({ schema: 'does-not-exist' })),
    ).denominator).toBe(0);
    expect(status(request('GET', '/admin/catalog/objects/missing'))).toBe(404);
    expect(status(request('GET', '/admin/catalog/objects/missing/columns'))).toBe(404);
    expect(status(request('GET', '/admin/catalog/objects/missing/evidence'))).toBe(404);
    expect(status(request('GET', '/admin/catalog/objects/missing/history'))).toBe(404);
    expect(status(request('GET', '/admin/catalog/objects/missing/impact'))).toBe(404);
  });

  it('exige versión, contenido, evidencia y separación entre autor y revisor', () => {
    const none = data<{ items: { id: string }[] }>(request(
      'GET', '/admin/catalog/objects', {}, new URLSearchParams({ reviewStatus: 'NONE' }),
    )).items[0]!;
    const path = `/admin/catalog/objects/${none.id}`;
    expect(status(request('PUT', `${path}/annotation`, { expectedVersion: 1, submit: true }))).toBe(409);
    expect(status(request('PUT', `${path}/annotation`, { expectedVersion: 0, submit: true }))).toBe(422);
    expect(status(request('PUT', `${path}/annotation`, {
      expectedVersion: 0, submit: true, purpose: 'Guarda datos',
      existenceRationale: 'Esta tabla almacena datos', rowGrain: 'Un registro',
    }))).toBe(422);

    const annotation = data<{ id: string; version: number; reviewStatus: string; currentRevisionNo: number }>(
      request('PUT', `${path}/annotation`, {
        expectedVersion: 0,
        submit: true,
        purpose: 'Permite seguir cada solicitud sintética de la prueba de catálogo.',
        existenceRationale: 'Separa el ciclo de revisión de otros registros de la plataforma.',
        rowGrain: 'Una fila representa una solicitud de ejemplo identificada de forma única.',
      }),
    );
    expect(annotation).toMatchObject({ version: 1, reviewStatus: 'NEEDS_REVIEW' });
    const reviewPath = `/admin/catalog/annotations/${annotation.id}/review`;
    expect(status(request('POST', reviewPath, { decision: 'APPROVED', expectedRevisionNo: 0 }, new URLSearchParams(), reviewer))).toBe(409);
    expect(status(request('POST', reviewPath, { decision: 'APPROVED', expectedRevisionNo: annotation.currentRevisionNo }))).toBe(403);
    expect(status(request('POST', reviewPath, { decision: 'REJECTED', expectedRevisionNo: annotation.currentRevisionNo, comment: 'corto' }, new URLSearchParams(), reviewer))).toBe(400);
    expect(status(request('POST', reviewPath, { decision: 'APPROVED', expectedRevisionNo: annotation.currentRevisionNo }, new URLSearchParams(), reviewer))).toBe(422);
    expect(status(request('POST', `${path}/evidence`, { reference: 'x' }))).toBe(400);
    expect(status(request('POST', `${path}/evidence`, { reference: 'REQ-QA-001', kind: 'REQUIREMENT', excerpt: 'Fuente sintética' }))).toBe(201);
    expect(data<unknown[]>(request('GET', `${path}/evidence`))).toHaveLength(1);
    const approved = data<{ reviewStatus: string; approvalIsCurrent: boolean }>(
      request('POST', reviewPath, { decision: 'APPROVED', expectedRevisionNo: annotation.currentRevisionNo }, new URLSearchParams(), reviewer),
    );
    expect(approved).toMatchObject({ reviewStatus: 'APPROVED', approvalIsCurrent: true });
    expect(status(request('POST', reviewPath, { decision: 'APPROVED', expectedRevisionNo: annotation.currentRevisionNo }, new URLSearchParams(), reviewer))).toBe(422);
    expect(data<{ revisions: unknown[]; decisions: unknown[] }>(request('GET', `${path}/history`)))
      .toMatchObject({ revisions: expect.any(Array), decisions: expect.arrayContaining([expect.objectContaining({ decision: 'APPROVED' })]) });
  });

  it('prepara, crea y cancela planes QA con conflictos observables', () => {
    const suite = data<{ id: string }[]>(request('GET', '/admin/qa/suites'))[0]!;
    const environment = data<{ id: string }[]>(request('GET', '/admin/qa/environments'))[0]!;
    expect(status(request('POST', '/admin/qa/plans/preflight', { suiteId: 'missing', environmentId: environment.id }))).toBe(404);
    const preflight = data<{ executable: boolean; steps: unknown[]; hash: string }>(
      request('POST', '/admin/qa/plans/preflight', { suiteId: suite.id, environmentId: environment.id }),
    );
    expect(preflight).toMatchObject({ executable: true, steps: expect.any(Array), hash: expect.any(String) });
    expect(preflight.steps).toHaveLength(3);
    expect(status(request('POST', '/admin/qa/plans', { suiteId: 'missing', environmentId: environment.id }))).toBe(404);
    const plan = data<{ id: string; status: string }>(
      request('POST', '/admin/qa/plans', { suiteId: suite.id, environmentId: environment.id }),
    );
    expect(plan.status).toBe('QUEUED');
    expect(data<{ id: string }>(request('GET', `/admin/qa/plans/${plan.id}`)).id).toBe(plan.id);
    expect(status(request('POST', `/admin/qa/plans/${plan.id}/approvals`))).toBe(409);
    expect(status(request('POST', `/admin/qa/plans/${plan.id}/cancel`))).toBe(200);
    expect(status(request('POST', `/admin/qa/plans/${plan.id}/cancel`))).toBe(409);
    expect(status(request('GET', '/admin/qa/plans/missing'))).toBe(404);
    expect(status(request('POST', '/admin/qa/plans/missing/cancel'))).toBe(404);
    expect(status(request('POST', '/admin/qa/plans/missing/approvals'))).toBe(404);
    expect(status(request('GET', '/admin/qa/suites/missing'))).toBe(404);
    expect(status(request('GET', '/admin/qa/runs/missing'))).toBe(404);
    expect(data<{ results: unknown[] }>(request(
      'GET', `/admin/qa/runs/${data<{ id: string }[]>(request('GET', '/admin/qa/runs'))[0]!.id}`,
    )).results).toHaveLength(3);
  });
});
