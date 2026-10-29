import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { firstValueFrom, of, throwError } from 'rxjs';

import { mockBackendInterceptor, MOCK_ROUTER_LOADER } from './mock-backend.interceptor';

describe('mock backend disabled', () => {
  const originalMockBackend = environment.mockBackend;
  const loadHandlers = vi.fn(() => { throw new Error('Real mode must not load handlers'); });
  beforeEach(() => {
    Object.assign(environment, { mockBackend: false });
    loadHandlers.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: MOCK_ROUTER_LOADER, useValue: loadHandlers }] });
  });
  afterEach(() => {
    expect(loadHandlers).not.toHaveBeenCalled();
    Object.assign(environment, { mockBackend: originalMockBackend });
  });

  it('delegates the exact request and observable without changing the response', async () => {
    const request = new HttpRequest('POST', '/charts/notes', { synthetic: true });
    const response = new HttpResponse({ status: 201, body: { id: 'synthetic-note' } });
    const stream = of(response);
    const next = vi.fn(() => stream);

    const result = TestBed.runInInjectionContext(() => mockBackendInterceptor(request, next));

    expect(next).toHaveBeenCalledExactlyOnceWith(request);
    expect(result).toBe(stream);
    expect(await firstValueFrom(result)).toBe(response);
    expect(response.headers.has('x-mock-backend')).toBe(false);
  });

  for (const status of [0, 400, 401, 409, 422, 500]) {
    it(`preserves the original HTTP ${status} error, body and headers`, async () => {
      const error = new HttpErrorResponse({
        status,
        url: '/charts/notes',
        headers: new HttpHeaders({ 'x-request-id': 'synthetic-request' }),
        error: { code: 'SYNTHETIC_FAILURE' },
      });
      const stream = throwError(() => error);
      const request = new HttpRequest('GET', '/charts/notes');
      const next = vi.fn(() => stream);

      const result = TestBed.runInInjectionContext(() => mockBackendInterceptor(request, next));

      expect(result).toBe(stream);
      expect(next).toHaveBeenCalledExactlyOnceWith(request);
      await expect(firstValueFrom(result)).rejects.toBe(error);
    });
  }
});
