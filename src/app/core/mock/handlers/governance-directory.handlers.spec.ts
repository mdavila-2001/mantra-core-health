import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerGovernance } from './governance.handlers';

interface Row {
  id: string;
  type: string;
  maskedEmail: string | null;
  displayName: string;
}
interface Page {
  items: Row[];
  nextCursor: string | null;
  limit: number;
  scope: string;
  source: string;
}

describe('simulated GET /authz/users/directory', () => {
  const router = new MockRouter();
  registerGovernance(router);
  const admin = buscarUsuario('superadmin')!;

  function call(query: Record<string, string> = {}) {
    const match = router.match('GET', '/authz/users/directory');
    if (match === null) throw new Error('route not registered');
    return match.handler({
      method: 'GET',
      path: '/authz/users/directory',
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }
  const page = (query: Record<string, string> = {}) => call(query) as Page;
  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);

  it('is marked as simulated, in the published shape, and covers every account type', () => {
    const all = page({ limit: '100' });
    expect(all.source).toBe('SIMULATED');
    expect(all.scope).toBe('PLATFORM');
    expect(new Set(all.items.map((u) => u.type))).toEqual(
      new Set(['PATIENT', 'PRACTITIONER', 'PHARMACY', 'LABORATORY', 'INTERNAL', 'OTHER']),
    );
    expect(Object.keys(all.items[0]!).sort()).toEqual(
      ['displayName', 'id', 'lastLoginAt', 'maskedEmail', 'mfaStatusConceptId', 'permissions', 'roles', 'statusConceptId', 'type'],
    );
  });

  it('never carries passwords, documents or an unmasked e-mail, and null when the login is not an e-mail', () => {
    const all = page({ limit: '100' });
    expect(JSON.stringify(all)).not.toMatch(/password|document|phone|hash/i);
    for (const u of all.items) if (u.maskedEmail !== null) expect(u.maskedEmail).toMatch(/^.\*\*\*@.\*\*\*\./);
    expect(all.items.some((u) => u.maskedEmail === null)).toBe(true);
  });

  it('filters by type and by role code, and paginates by cursor ordered by name then id', () => {
    const doctors = page({ type: 'PRACTITIONER' });
    expect(doctors.items.length).toBeGreaterThan(0);
    expect(doctors.items.every((u) => u.type === 'PRACTITIONER')).toBe(true);
    expect(page({ roleCode: 'PATIENT' }).items.every((u) => u.type === 'PATIENT')).toBe(true);
    const first = page({ limit: '10' });
    expect(first.nextCursor).toBe('10');
    expect(first.items.map((u) => u.displayName)).toEqual([...first.items.map((u) => u.displayName)].sort((a, b) => a.localeCompare(b)));
    const second = page({ limit: '10', cursor: first.nextCursor! });
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
  });

  it('rejects like the API: free text, unknown type, non-uuid status, bad role code, limit above 100', () => {
    expect(status(call({ q: 'ana' }))).toBe(400);
    expect(status(call({ type: 'DOCTOR' }))).toBe(400);
    expect(status(call({ status: 'ACTIVE' }))).toBe(400);
    expect(status(call({ roleCode: 'dpo' }))).toBe(400);
    expect(status(call({ limit: '101' }))).toBe(400);
    expect(status(call({ limit: '100' }))).toBe(200);
  });
});
