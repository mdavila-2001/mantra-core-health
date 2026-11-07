import { HttpParams, HttpRequest, type HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { mockBackendInterceptor, MOCK_ROUTER_LOADER } from './mock-backend.interceptor';
import { MockRouter } from './mock-router';

/** The simulator must read the query the way the API does: from the URL itself and from HttpParams. */
describe('mock backend · query string', () => {
  const originalMockBackend = environment.mockBackend;
  const router = new MockRouter().get('/probe/:id', (request) => ({
    expires: request.query.get('expires'),
    signature: request.query.get('signature'),
    extra: request.query.get('extra'),
  }));

  beforeEach(() => {
    Object.assign(environment, { mockBackend: true });
    TestBed.configureTestingModule({ providers: [{ provide: MOCK_ROUTER_LOADER, useValue: () => Promise.resolve(router) }] });
  });
  afterEach(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  async function call(request: HttpRequest<unknown>): Promise<Record<string, string | null>> {
    const next = vi.fn();
    const events = TestBed.runInInjectionContext(() => mockBackendInterceptor(request, next));
    const response = (await firstValueFrom(events)) as HttpResponse<Record<string, string | null>>;
    expect(next).not.toHaveBeenCalled();
    return response.body as Record<string, string | null>;
  }

  it('reads a query embedded in the URL (a signed download link)', async () => {
    const body = await call(new HttpRequest('GET', '/probe/7?expires=123&signature=abc'));
    expect(body).toEqual({ expires: '123', signature: 'abc', extra: null });
  });

  it('keeps reading HttpParams', async () => {
    const body = await call(new HttpRequest('GET', '/probe/7', { params: new HttpParams().set('extra', 'x') }));
    expect(body).toEqual({ expires: null, signature: null, extra: 'x' });
  });

  it('merges both without duplicating a key given twice', async () => {
    const body = await call(new HttpRequest('GET', '/probe/7?expires=1&extra=url', { params: new HttpParams().set('extra', 'params') }));
    expect(body['expires']).toBe('1');
    expect(body['extra']).toBe('params');
  });
});
