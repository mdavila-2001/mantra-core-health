import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../data-access/api';
import { SessionStore } from '../auth/session.store';
import { authInterceptor, isOwnOrigin } from './auth.interceptor';

/* La credencial es de esta API. Una dirección de otro origen (una URL firmada
   de un almacenamiento de objetos, un servicio de terceros) no recibe ni el
   `Authorization` ni el `X-Tenant-Id`. Si esto falla, el token de quien revisa
   viaja a un tercero, o una URL firmada deja de servir por una cabecera de más. */

function token(): string {
  const enc = (v: object): string => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'none' })}.${enc({ sub: 'u', sid: 's', roles: ['USER'], tenants: ['t-1'] })}.x`;
}

describe('isOwnOrigin', () => {
  const origen = 'https://app.mantra.test';

  it('las rutas relativas son de la API', () => {
    expect(isOwnOrigin('/admissions', '', origen)).toBe(true);
    expect(isOwnOrigin('iam/me', '', null)).toBe(true);
  });

  it('la raíz configurada es de la API, con el límite del segmento', () => {
    expect(isOwnOrigin('https://api.mantra.test/iam/me', 'https://api.mantra.test', origen)).toBe(true);
    expect(isOwnOrigin('https://api.mantra.test', 'https://api.mantra.test/', origen)).toBe(true);
    expect(isOwnOrigin('https://api.mantra.test.evil.com/iam', 'https://api.mantra.test', origen)).toBe(false);
    expect(isOwnOrigin('https://api.mantra.testx/iam', 'https://api.mantra.test', origen)).toBe(false);
  });

  it('el mismo origen de la página cuenta (el servidor vuelve absolutas las rutas relativas)', () => {
    expect(isOwnOrigin('https://app.mantra.test/iam/me', '', origen)).toBe(true);
    expect(isOwnOrigin('http://localhost:4000/iam/me', '', 'http://localhost:4000')).toBe(true);
  });

  it('otro origen, uno sin esquema útil o una dirección rota, no', () => {
    expect(isOwnOrigin('https://almacen.example.com/obj?X-Signature=abc', '', origen)).toBe(false);
    expect(isOwnOrigin('//almacen.example.com/obj', '', origen)).toBe(false);
    expect(isOwnOrigin('https://[roto', '', origen)).toBe(false);
    expect(isOwnOrigin('https://almacen.example.com/obj', '', null)).toBe(false);
  });
});

describe('authInterceptor: la credencial solo va a la API', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.mantra.test' },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({ accessToken: token(), refreshToken: 'r' });
  });

  afterEach(() => backend.verify());

  it('una ruta relativa lleva Authorization y X-Tenant-Id', () => {
    http.get('/admissions').subscribe();
    const req = backend.expectOne('/admissions');
    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
    expect(req.request.headers.get('X-Tenant-Id')).toBe('t-1');
    req.flush({});
  });

  it('una dirección bajo la raíz configurada también', () => {
    http.get('https://api.mantra.test/admissions').subscribe();
    const req = backend.expectOne('https://api.mantra.test/admissions');
    expect(req.request.headers.has('Authorization')).toBe(true);
    req.flush({});
  });

  it('una URL firmada de otro origen NO lleva Authorization ni X-Tenant-Id', () => {
    http.get('https://almacen.example.com/obj?X-Signature=abc').subscribe();
    const req = backend.expectOne('https://almacen.example.com/obj?X-Signature=abc');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    req.flush({});
  });

  it('un 401 de un tercero no cierra la sesión ni dispara un refresco', () => {
    const sesion = TestBed.inject(SessionStore);
    http.get('https://almacen.example.com/obj').subscribe({ error: () => undefined });
    backend.expectOne('https://almacen.example.com/obj').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(sesion.isAuthenticated()).toBe(true);
  });

  it('un host que solo empieza igual que la raíz tampoco recibe la credencial', () => {
    http.get('https://api.mantra.test.evil.com/x').subscribe();
    const req = backend.expectOne('https://api.mantra.test.evil.com/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
