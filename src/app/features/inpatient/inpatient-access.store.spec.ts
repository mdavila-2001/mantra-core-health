import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../core/auth/session.store';
import type { InfrastructureAccess } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { verificarHttp } from '../../../testing/maqueta-de-internacion';
import { InpatientAccessStore } from './inpatient-access.store';

/** M5: el acceso sigue a `userId|activeTenantId`, con cancelación; S1 mientras no se sabe. */
describe('InpatientAccessStore', () => {
  const userId = signal<string | null>('u-1');
  const tenant = signal<string | null>('t-1');
  const tipo = signal<string | null>('HOSPITAL');
  const acceso = (u: string, actions: string[] = [], grants: object[] = []): InfrastructureAccess =>
    ({ userId: u, tenantId: 't', sites: [{ siteId: 's1', practiceId: 'p', code: 'S1', name: 'Sede', timeZone: 'America/La_Paz', roles: [], globalRoles: [], actions, grants }] }) as InfrastructureAccess;

  function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStore, useValue: { userId, activeTenantId: tenant, activeTenantType: tipo } },
      ],
    });
    return { store: TestBed.inject(InpatientAccessStore), http: TestBed.inject(HttpTestingController) };
  }

  afterEach(() => {
    verificarHttp();
    userId.set('u-1');
    tenant.set('t-1');
  });

  it('S1 hasta que la API responde; no pregunta hasta que una pantalla lo pide', () => {
    const { store, http } = montar();
    TestBed.tick();
    http.expectNone('/practice/infrastructure-access/me');
    expect(store.state().status).toBe('route-auth-pending');
    store.ensure();
    TestBed.tick();
    http.expectOne('/practice/infrastructure-access/me').flush(acceso('u-1', ['f2.board.read']));
    expect(store.state().status).toBe('ready');
    expect(store.can('s1', 'f2.board.read')).toBe(true);
    store.ensure();
    TestBed.tick();
    http.expectNone('/practice/infrastructure-access/me');
  });

  it('M5: al cambiar de organización vuelve a S1, cancela lo que estaba en vuelo y pide de nuevo', () => {
    const { store, http } = montar();
    store.ensure();
    TestBed.tick();
    const primero = http.expectOne('/practice/infrastructure-access/me');
    tenant.set('t-2');
    TestBed.tick();
    expect(primero.cancelled).toBe(true);
    expect(store.state().status).toBe('route-auth-pending');
    http.expectOne('/practice/infrastructure-access/me').flush(acceso('u-1', ['f3.census.read']));
    expect(store.can('s1', 'f3.census.read')).toBe(true);
    userId.set('u-2');
    TestBed.tick();
    expect(store.sites()).toEqual([]);
    http.expectOne('/practice/infrastructure-access/me').flush(acceso('u-2'));
  });

  it('las acciones de las asignaciones de unidad/espacio cuentan para ofrecer la pantalla', () => {
    const { store, http } = montar();
    store.ensure();
    TestBed.tick();
    http.expectOne('/practice/infrastructure-access/me').flush(acceso('u-1', [], [{ scope: 'UNIT', role: 'NURSE', clinicalUnitId: 'u', careSpaceId: null, actions: ['f2.board.read'] }]));
    expect(store.pickSite(null, 'f2.board.read')?.siteId).toBe('s1');
    expect(store.can('s1', 'f3.adt.place')).toBe(false);
    expect(store.isHospital()).toBe(true);
  });

  it('S9: un error del acceso queda con su requestId y `reload` vuelve a preguntar', () => {
    const { store, http } = montar();
    store.ensure();
    TestBed.tick();
    http.expectOne('/practice/infrastructure-access/me').flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-me-1' }, { status: 500, statusText: 'Error' });
    expect(store.state()).toMatchObject({ status: 'error', requestId: 'req-me-1' });
    store.reload();
    TestBed.tick();
    http.expectOne('/practice/infrastructure-access/me').flush(acceso('u-1'));
    expect(store.state().status).toBe('ready');
  });
});
