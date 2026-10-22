import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { RefreshTokenStorage } from '../auth/refresh-token.storage';
import { SessionStore } from '../auth/session.store';
import { TENANT_SELECTION_ROUTE } from '../auth/tenant-selection-route';
import { REFRESH_COOKIE_MODE } from '../data-access/api';
import { authInterceptor, LOGIN_ROUTE } from './auth.interceptor';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma-no-verificada`;
}

const DOS_TENANTS = makeToken({ sub: 'u-1', roles: ['USER'], tenants: ['t-1', 't-2'] });
const UN_TENANT = makeToken({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'] });
const VENCIDO = makeToken({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'], exp: 1 });

class RouterEspia {
  readonly navegaciones: string[] = [];
  navigateByUrl(url: string): Promise<boolean> {
    this.navegaciones.push(url);
    return Promise.resolve(true);
  }
}

class AlmacenEspia {
  limpiezas = 0;
  clear(): void {
    this.limpiezas += 1;
  }
  read(): string | null {
    return null;
  }
  write(): void {
    /* no-op */
  }
}

function montar(cookie = false) {
  const router = new RouterEspia();
  const almacen = new AlmacenEspia();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: Router, useValue: router },
      { provide: RefreshTokenStorage, useValue: almacen },
      { provide: REFRESH_COOKIE_MODE, useValue: cookie },
    ],
  });
  return {
    router,
    almacen,
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
    session: TestBed.inject(SessionStore),
  };
}

describe('authInterceptor · sesión y tenant (BR-04)', () => {
  it('TENANT_REQUIRED (403) con varias organizaciones abre el selector, no el muro', () => {
    const { http, backend, session, router } = montar();
    session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });

    let error: unknown;
    http.get('/scheduling/resources').subscribe({ error: (e: unknown) => (error = e) });
    backend.expectOne('/scheduling/resources').flush(
      { code: 'FORBIDDEN', message: 'x', details: { reason: 'TENANT_REQUIRED' } },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(router.navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    expect(error).toBeDefined();
    // La sesión sigue en pie.
    expect(session.isAuthenticated()).toBe(true);
    backend.verify();
  });

  it('el 422 con TENANT_REQUIRED (requireTenantId) también abre el selector', () => {
    const { http, backend, session, router } = montar();
    session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });

    http.get('/insurance/claims').subscribe({ error: () => undefined });
    backend.expectOne('/insurance/claims').flush(
      { code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'TENANT_REQUIRED' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(router.navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    backend.verify();
  });

  it('un 403 común (rol insuficiente) NO abre el selector', () => {
    const { http, backend, session, router } = montar();
    session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });

    http.get('/administration/x').subscribe({ error: () => undefined });
    backend.expectOne('/administration/x').flush(
      { code: 'FORBIDDEN', message: 'Rol insuficiente' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(router.navegaciones).toEqual([]);
    backend.verify();
  });

  it('cuando la sesión termina se limpia también lo guardado (antes quedaba el refresh token)', () => {
    const { http, backend, session, router, almacen } = montar();
    // Sin refresh token no hay nada que renovar: el 401 termina la sesión.
    session.start({ accessToken: UN_TENANT, refreshToken: '' });

    http.get('/clinical/encounters').subscribe({ error: () => undefined });
    backend.expectOne('/clinical/encounters').flush(null, { status: 401, statusText: 'x' });

    expect(session.isAuthenticated()).toBe(false);
    expect(almacen.limpiezas).toBe(1);
    expect(router.navegaciones).toEqual([LOGIN_ROUTE]);
    backend.verify();
  });

  it('si el refresco da 429 la sesión NO se cierra ni se limpia', () => {
    const { http, backend, session, router, almacen } = montar();
    session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

    let fallo = false;
    http.get('/clinical/encounters').subscribe({ error: () => (fallo = true) });
    backend.expectOne('/clinical/encounters').flush(null, { status: 401, statusText: 'x' });
    backend
      .expectOne('/iam/auth/token/refresh')
      .flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(fallo).toBe(true);
    expect(session.isAuthenticated()).toBe(true);
    expect(almacen.limpiezas).toBe(0);
    expect(router.navegaciones).toEqual([]);
    backend.verify();
  });

  it('el refresco con la red caída (status 0) tampoco desloguea', () => {
    const { http, backend, session, router } = montar();
    session.start({ accessToken: VENCIDO, refreshToken: 'r-1' });

    http.get('/clinical/encounters').subscribe({ error: () => undefined });
    backend
      .expectOne('/iam/auth/token/refresh')
      .error(new ProgressEvent('error'), { status: 0 });

    expect(session.isAuthenticated()).toBe(true);
    expect(router.navegaciones).toEqual([]);
    backend.verify();
  });

  it('un refresco rechazado (401) sí termina la sesión y limpia lo guardado', () => {
    const { http, backend, session, router, almacen } = montar();
    session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

    http.get('/clinical/encounters').subscribe({ error: () => undefined });
    backend.expectOne('/clinical/encounters').flush(null, { status: 401, statusText: 'x' });
    backend.expectOne('/iam/auth/token/refresh').flush(null, { status: 401, statusText: 'x' });

    expect(session.isAuthenticated()).toBe(false);
    expect(almacen.limpiezas).toBe(1);
    expect(router.navegaciones).toEqual([LOGIN_ROUTE]);
    backend.verify();
  });

  it('en modo cookie un 401 se renueva aunque el store no tenga refresh token', () => {
    const { http, backend, session } = montar(true);
    session.start({ accessToken: UN_TENANT, refreshToken: '' });

    http.get('/clinical/encounters').subscribe();
    backend.expectOne('/clinical/encounters').flush(null, { status: 401, statusText: 'x' });

    const refresco = backend.expectOne('/iam/auth/token/refresh');
    expect(refresco.request.body).toEqual({});
    refresco.flush({ accessToken: UN_TENANT, refreshToken: '', expiresAt: '2026-08-01T12:00:00.000Z' });
    backend.expectOne('/clinical/encounters').flush({});
    backend.verify();
  });
});
