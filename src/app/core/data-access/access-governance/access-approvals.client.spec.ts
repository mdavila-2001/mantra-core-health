import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AccessApprovalsClient } from './access-approvals.client';
import type { SupportApprovalList } from './access-reviews.types';

/** `GET /approvals/pending` pagina (`limit`, `cursor`, `nextCursor`): la pantalla tiene que ver TODO lo que le espera (B7c). */
describe('AccessApprovalsClient.listPending', () => {
  let http: HttpTestingController;
  let client: AccessApprovalsClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(AccessApprovalsClient);
  });
  afterEach(() => http.verify());

  const fila = (id: string) => ({
    id,
    tenantId: 't',
    kind: 'ACTION',
    status: 'PENDING',
    approverKind: 'DOCTOR',
    createdAt: '2026-11-03T10:00:00Z',
    expiresAt: '2026-11-04T10:00:00Z',
    summary: 's',
  });

  it('pide de a 100 y sigue el cursor hasta que no hay más páginas, juntando todo', () => {
    let resultado: SupportApprovalList | undefined;
    client.listPending().subscribe((r) => (resultado = r));
    const primera = http.expectOne((r) => r.url === '/approvals/pending');
    expect(primera.request.params.get('limit')).toBe('100');
    expect(primera.request.params.has('cursor')).toBe(false);
    primera.flush({ items: [fila('a1'), fila('a2')], count: 2, nextCursor: 'c-2' });
    const segunda = http.expectOne(
      (r) => r.url === '/approvals/pending' && r.params.get('cursor') === 'c-2',
    );
    segunda.flush({ items: [fila('a3')], count: 1 });
    expect(resultado!.items.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(resultado!.count).toBe(3);
  });

  it('con una sola página no pide más', () => {
    let resultado: SupportApprovalList | undefined;
    client.listPending().subscribe((r) => (resultado = r));
    http.expectOne((r) => r.url === '/approvals/pending').flush({ items: [], count: 0 });
    expect(resultado).toEqual({ items: [], count: 0 });
  });
});
