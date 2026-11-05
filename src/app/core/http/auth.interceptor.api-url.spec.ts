import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { API_BASE_URL, isApiUrl } from '../data-access/api';
import { RefreshTokenStorage } from '../auth/refresh-token.storage';
import { SessionStore } from '../auth/session.store';
import { authInterceptor } from './auth.interceptor';

const encode = (value: object): string =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const TOKEN = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] })}.firma`;

/**
 * F9 (revisión de seguridad del front): la credencial de la sesión (`Authorization`) y la organización activa
 * (`X-Tenant-Id`) solo viajan a la API configurada. Un `HttpClient.get(urlPrefirmada)` hacia S3, un CDN o cualquier tercero
 * no debe filtrar el token ni intentar renovar la sesión si responde 401.
 */
describe('isApiUrl', () => {
  it('las rutas relativas son de la API cuando la raíz está vacía (las resuelve el proxy / el mismo origen)', () => {
    expect(isApiUrl('/scheduling/bookings', '')).toBe(true);
    expect(isApiUrl('/me/support-agenda?from=2026-10-01', '')).toBe(true);
  });

  it('una URL absoluta de otro origen no lo es, ni la que empieza con «//» (mismo esquema, otro anfitrión)', () => {
    expect(isApiUrl('https://bucket.s3.amazonaws.com/x?X-Amz-Signature=abc', '')).toBe(false);
    expect(isApiUrl('//evil.example.com/steal', '')).toBe(false);
    expect(isApiUrl('https://evil.example.com/me/x', '')).toBe(false);
  });

  it('con una raíz absoluta, solo es de la API lo que cuelga de ese origen exacto', () => {
    const raiz = 'https://api.example.com';
    expect(isApiUrl('https://api.example.com/me/x', raiz)).toBe(true);
    expect(isApiUrl('https://api.example.com:443/me/x', raiz)).toBe(true);
    expect(isApiUrl('https://api.example.com.evil.net/me/x', raiz)).toBe(false);
    expect(isApiUrl('https://api.example.com@evil.net/me/x', raiz)).toBe(false);
    expect(isApiUrl('http://api.example.com/me/x', raiz)).toBe(false);
    expect(isApiUrl('https://cdn.example.com/x', raiz)).toBe(false);
  });

  it('una URL que no se puede leer no es de la API (fail-closed)', () => {
    expect(isApiUrl('http://[::1', 'https://api.example.com')).toBe(false);
  });
});

describe('authInterceptor: solo adjunta la credencial a la API (F9)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionStore;
  const navegaciones: string[] = [];

  function montar(raiz: string): void {
    navegaciones.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: raiz },
        {
          provide: Router,
          useValue: {
            navigateByUrl: (url: string) => (navegaciones.push(url), Promise.resolve(true)),
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    TestBed.inject(RefreshTokenStorage).clear();
    session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
  }

  afterEach(() => {
    backend.verify();
    TestBed.inject(RefreshTokenStorage).clear();
  });

  it('una URL prefirmada de un tercero sale sin Authorization ni X-Tenant-Id', () => {
    montar('');
    http.get('https://bucket.s3.amazonaws.com/informe.pdf?X-Amz-Signature=abc').subscribe();
    const req = backend.expectOne((r) => r.url.startsWith('https://bucket.s3.amazonaws.com/'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    req.flush({});
  });

  it('el 401 de un tercero no renueva ni cierra la sesión de la persona', () => {
    montar('');
    let estado = 0;
    http
      .get('https://cdn.example.net/x')
      .subscribe({ error: (e: { status: number }) => (estado = e.status) });
    backend
      .expectOne('https://cdn.example.net/x')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(estado).toBe(401);
    expect(session.isAuthenticated()).toBe(true);
    expect(navegaciones).toEqual([]);
  });

  it('la API relativa sigue llevando la credencial', () => {
    montar('');
    http.get('/scheduling/bookings').subscribe();
    const req = backend.expectOne('/scheduling/bookings');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(req.request.headers.get('X-Tenant-Id')).toBe('t-1');
    req.flush({});
  });

  it('con raíz absoluta: la API lleva la credencial; un anfitrión que solo se le parece, no', () => {
    montar('https://api.example.com');
    http.get('https://api.example.com/scheduling/bookings').subscribe();
    const propia = backend.expectOne('https://api.example.com/scheduling/bookings');
    expect(propia.request.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    propia.flush({});

    http.get('https://api.example.com.evil.net/x').subscribe();
    const ajena = backend.expectOne('https://api.example.com.evil.net/x');
    expect(ajena.request.headers.has('Authorization')).toBe(false);
    ajena.flush({});
  });
});
