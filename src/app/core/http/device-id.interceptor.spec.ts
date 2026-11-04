import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { deviceIdInterceptor, deviceKey } from './device-id.interceptor';

describe('deviceIdInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('alovida.device-id');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([deviceIdInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('sends the same stable key on every login', () => {
    http.post('/api/iam/auth/login', {}).subscribe();
    http.post('/api/iam/auth/login', {}).subscribe();
    const [first, second] = backend.match('/api/iam/auth/login');
    expect(first!.request.headers.get('X-Device-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(second!.request.headers.get('X-Device-Id')).toBe(first!.request.headers.get('X-Device-Id'));
    expect(deviceKey()).toBe(first!.request.headers.get('X-Device-Id'));
  });

  it('leaves every other request alone', () => {
    http.get('/api/iam/me/devices').subscribe();
    expect(backend.expectOne('/api/iam/me/devices').request.headers.has('X-Device-Id')).toBe(false);
  });
});
