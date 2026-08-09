import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { provideRouter } from '@angular/router';

import { authGuard, TENANT_SELECTION_ROUTE } from './auth.guard';
import { LOGIN_ROUTE } from '../http/auth.interceptor';
import { SessionStore } from './session.store';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

const UN_TENANT = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const DOS_TENANTS = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1', 't-2'] });

/** El guard no usa ni la ruta ni el estado: se le pasan vacíos. */
const RUTA = {} as ActivatedRouteSnapshot;
const ESTADO = {} as RouterStateSnapshot;

describe('authGuard · el estado S1 del M34', () => {
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  const ejecutar = (): boolean | UrlTree =>
    TestBed.runInInjectionContext(() => authGuard(RUTA, ESTADO)) as boolean | UrlTree;

  it('sin sesión manda al login', () => {
    const resultado = ejecutar();

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe(LOGIN_ROUTE);
  });

  it('con sesión y varias organizaciones sin elegir manda al selector', () => {
    session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });

    const resultado = ejecutar();

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe(TENANT_SELECTION_ROUTE);
  });

  it('con la organización ya elegida deja pasar', () => {
    session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });
    session.selectTenant('t-2');

    expect(ejecutar()).toBe(true);
  });

  it('con una sola organización deja pasar sin preguntar', () => {
    session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

    expect(ejecutar()).toBe(true);
  });

  it('un token ilegible se trata como no tener sesión', () => {
    session.start({ accessToken: 'no-es-un-jwt', refreshToken: 'r-1' });

    const resultado = ejecutar();

    expect(router.serializeUrl(resultado as UrlTree)).toBe(LOGIN_ROUTE);
  });

  it('decide sin consultar a la API: autorizar ocurre antes de pedir datos', () => {
    // No hay HttpTestingController en este módulo de prueba a propósito: si el
    // guard intentara una petición, fallaría por falta de proveedor. Que pase
    // demuestra que decide solo con el token en memoria, que es la razón de que
    // S1 y S2 sean estados distintos.
    session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

    expect(ejecutar()).toBe(true);
  });
});
