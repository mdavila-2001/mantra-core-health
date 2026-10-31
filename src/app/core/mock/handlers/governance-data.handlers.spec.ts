import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarCalidadYPrivacidad } from './governance-data.handlers';

describe('calidad de datos y privacidad demo: mismas reglas que la API', () => {
  let router: MockRouter;
  const admin = buscarUsuario('superadmin')!;

  function call(method: MockMethod, path: string, query: Record<string, string> = {}, body: unknown = null) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }
  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const body = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  const ISSUES = '/admin/governance/data-quality/issues';

  beforeEach(() => {
    router = new MockRouter();
    registrarCalidadYPrivacidad(router);
  });

  function firstOpen(): string {
    return body<{ items: { id: string }[] }>(call('GET', ISSUES, { status: 'OPEN' })).items[0]!.id;
  }

  it('el total cuenta lo que cumple el filtro y la página respeta el límite', () => {
    const all = body<{ total: number }>(call('GET', ISSUES));
    const open = body<{ total: number; items: unknown[]; nextCursor: string | null }>(
      call('GET', ISSUES, { status: 'OPEN', limit: '2' }),
    );
    expect(open.total).toBeLessThan(all.total);
    expect(open.items).toHaveLength(2);
    expect(open.nextCursor).not.toBeNull();
  });

  it('resolver es idempotente: la repetición no cambia nada y avisa que ya estaba aplicada', () => {
    const id = firstOpen();
    const input = { action: 'RESOLVE', note: 'Corregido en el origen' };
    const first = body<{ alreadyApplied: boolean; issue: { status: string } }>(
      call('POST', `${ISSUES}/${id}/resolution`, {}, input),
    );
    const second = body<{ alreadyApplied: boolean; issue: { status: string } }>(
      call('POST', `${ISSUES}/${id}/resolution`, {}, input),
    );
    expect(first).toMatchObject({ alreadyApplied: false, issue: { status: 'RESOLVED' } });
    expect(second).toMatchObject({ alreadyApplied: true, issue: { status: 'RESOLVED' } });
  });

  it('pedir el desenlace contrario sobre una incidencia cerrada es un 409, no una sobreescritura', () => {
    const id = firstOpen();
    call('POST', `${ISSUES}/${id}/resolution`, {}, { action: 'RESOLVE', note: 'Corregido en el origen' });
    const r = call('POST', `${ISSUES}/${id}/resolution`, {}, { action: 'DISMISS', note: 'Falso positivo confirmado' });
    expect(status(r)).toBe(409);
    expect(body<{ status: string }>(call('GET', `${ISSUES}/${id}`))).toMatchObject({ status: 'RESOLVED' });
  });

  it('rechaza un motivo corto y una acción desconocida con 400', () => {
    const id = firstOpen();
    expect(status(call('POST', `${ISSUES}/${id}/resolution`, {}, { action: 'RESOLVE', note: 'corto' }))).toBe(400);
    expect(status(call('POST', `${ISSUES}/${id}/resolution`, {}, { action: 'BORRAR', note: 'Un motivo largo' }))).toBe(400);
  });

  it('una incidencia que no existe es 404', () => {
    expect(status(call('GET', `${ISSUES}/00000000-0000-4000-8000-00000000ffff`))).toBe(404);
  });

  it('la regla cuenta sus incidencias abiertas y el detalle las separa por estado', () => {
    const rules = body<{ items: { id: string; openIssues: number; totalIssues: number }[] }>(
      call('GET', '/admin/governance/data-quality/rules'),
    ).items;
    const withIssues = rules.find((r) => r.totalIssues > 0)!;
    const detail = body<{ issuesByStatus: Record<string, number>; recentRuns: { recordsEvaluated: number | null }[] }>(
      call('GET', `/admin/governance/data-quality/rules/${withIssues.id}`),
    );
    expect(detail.issuesByStatus['OPEN']).toBe(withIssues.openIssues);
    // «no informó» es null, no cero
    expect(detail.recentRuns.some((r) => r.recordsEvaluated === null)).toBe(true);
  });

  it('una solicitud terminal no admite transiciones y las que admite las publica', () => {
    const list = body<{
      items: { id: string; status: string; allowedTransitions: string[] }[];
      statusCounts: Record<string, number>;
    }>(call('GET', '/admin/governance/privacy-requests'));
    const done = list.items.find((r) => r.status === 'COMPLETED')!;
    expect(done.allowedTransitions).toEqual([]);
    expect(status(call('PATCH', `/privacy/dsar/${done.id}`, {}, { status: 'IN_PROGRESS' }))).toBe(422);
    const received = list.items.find((r) => r.status === 'RECEIVED')!;
    expect(received.allowedTransitions).toContain('IN_PROGRESS');
    call('PATCH', `/privacy/dsar/${received.id}`, {}, { status: 'IN_PROGRESS' });
    const after = body<{ status: string; rowVersion: number }>(call('GET', `/admin/governance/privacy-requests/${received.id}`));
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.rowVersion).toBe(2);
    expect(list.statusCounts['RECEIVED']).toBe(2);
  });
});
