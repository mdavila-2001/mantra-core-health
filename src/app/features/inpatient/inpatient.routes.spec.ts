import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { verificarHttp } from '../../../testing/maqueta-de-internacion';
import { inpatientChildGuard, inpatientRoutes } from './inpatient.routes';

/** LOW: las rutas hijas (ingreso, ficha) aplican `onlyForTenantTypes: ['HOSPITAL']` como el tablero. */
describe('inpatientChildGuard', () => {
  const tipo = signal<string | null>('HOSPITAL');
  function correr(): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionStore, useValue: { roles: signal(['STAFF']), tenants: signal(['t-1']), activeTenantType: tipo } }],
    });
    return TestBed.runInInjectionContext(() => inpatientChildGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as boolean | UrlTree;
  }
  afterEach(() => verificarHttp());

  it('en un hospital deja pasar', () => {
    tipo.set('HOSPITAL');
    expect(correr()).toBe(true);
  });

  it('en una clínica o una farmacia manda al panel', () => {
    for (const t of ['CLINIC', 'PHARMACY']) {
      TestBed.resetTestingModule();
      tipo.set(t);
      const r = correr();
      expect(r instanceof UrlTree ? r.toString() : r, t).toBe('/dashboard');
    }
  });

  it('las dos rutas hijas lo declaran', () => {
    const rutas = inpatientRoutes({ chunkFailed: () => class {} });
    for (const r of rutas) expect(r.canActivate, r.path).toContain(inpatientChildGuard);
  });
});
