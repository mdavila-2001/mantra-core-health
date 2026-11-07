import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerGovernance } from './governance.handlers';

interface Row {
  id: string;
  type: string;
  maskedEmail: string | null;
}
interface Page {
  items: Row[];
  nextCursor: string | null;
  typeCounts: Record<string, number>;
  source: string;
}

describe('simulated GET /authz/directory-users', () => {
  const router = new MockRouter();
  registerGovernance(router);
  const admin = buscarUsuario('superadmin')!;

  function call(query: Record<string, string> = {}) {
    const match = router.match('GET', '/authz/directory-users');
    if (match === null) throw new Error('route not registered');
    return match.handler({
      method: 'GET',
      path: '/authz/directory-users',
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }
  const page = (query: Record<string, string> = {}) => call(query) as Page;
  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);

  it('is marked as simulated and covers every account type', () => {
    const all = page({ limit: '200' });
    expect(all.source).toBe('SIMULATED');
    expect(Object.keys(all.typeCounts).sort()).toEqual(['DOCTOR', 'INTERNAL', 'LABORATORY', 'PATIENT', 'PHARMACY']);
    expect(all.items.length).toBe(Object.values(all.typeCounts).reduce((a, b) => a + b, 0));
  });

  it('never carries passwords, documents or an unmasked e-mail', () => {
    const all = page({ limit: '200' });
    expect(JSON.stringify(all)).not.toMatch(/password|document|phone|hash/i);
    for (const u of all.items) if (u.maskedEmail !== null) expect(u.maskedEmail).toContain('***@');
  });

  it('filters by type keeping the counts of every type, and paginates by cursor', () => {
    const doctors = page({ type: 'DOCTOR' });
    expect(doctors.items.every((u) => u.type === 'DOCTOR')).toBe(true);
    expect(doctors.typeCounts['PATIENT']).toBeGreaterThan(0);
    const first = page({ limit: '10' });
    expect(first.nextCursor).toBe('10');
    const second = page({ limit: '10', cursor: first.nextCursor! });
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
  });

  it('rejects an unknown type or status and an oversized limit with 400', () => {
    expect(status(call({ type: 'ROBOT' }))).toBe(400);
    expect(status(call({ status: 'GONE' }))).toBe(400);
    expect(status(call({ limit: '999' }))).toBe(400);
  });
});
