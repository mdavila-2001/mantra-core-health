import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../auth/session.store';
import { SiteContextStore } from './site-context.store';

/**
 * H4 de la revisión: el contexto de sede está atado a la sesión (clave
 * `userId|tenant`), no se traga un 403 como S3, deja elegir la sede y se
 * olvida al cerrar sesión.
 */
describe('SiteContextStore', () => {
  let http: HttpTestingController;
  let store: SiteContextStore;
  let userId: WritableSignal<string | null>;
  let tenant: WritableSignal<string | null>;

  const access = (sites: { siteId: string; practiceId: string; code: string; name: string }[]) => ({
    userId: 'u-1',
    tenantId: 't-1',
    sites: sites.map((s) => ({ ...s, timeZone: null, roles: [], globalRoles: [], actions: ['f4.or.read'], grants: [] })),
  });

  const flushEffects = () => TestBed.tick();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const session = TestBed.inject(SessionStore);
    userId = signal<string | null>('u-1');
    tenant = signal<string | null>('t-1');
    Object.defineProperty(session, 'userId', { value: userId });
    Object.defineProperty(session, 'activeTenantId', { value: tenant });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SiteContextStore);
  });

  afterEach(() => http.verify());

  it('lee las sedes del reflejo de acceso y deja elegir otra que no sea la primera', () => {
    store.ensure();
    flushEffects();
    http.expectOne('/practice/infrastructure-access/me').flush(access([
      { siteId: 's-1', practiceId: 'p-1', code: 'SL-C', name: 'San Lucas Central' },
      { siteId: 's-2', practiceId: 'p-1', code: 'SL-N', name: 'San Lucas Norte' },
    ]));
    expect(store.siteId()).toBe('s-1');
    store.select('s-2');
    expect(store.siteId()).toBe('s-2');
    expect(store.practiceId()).toBe('p-1');
    store.select('otra');
    expect(store.siteId()).toBe('s-2');
  });

  it('sin /me (404) cae a las consolas; si todas niegan (403) es S5, no S3', () => {
    store.ensure();
    flushEffects();
    http.expectOne('/practice/infrastructure-access/me').flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    http.expectOne('/practices').flush([{ id: 'p-1' }, { id: 'p-2' }]);
    http.expectOne('/practices/p-1/organization').flush({ code: 'FORBIDDEN', message: 'No', correlationId: 'r' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne('/practices/p-2/organization').flush({ code: 'FORBIDDEN', message: 'No', correlationId: 'r' }, { status: 403, statusText: 'Forbidden' });
    expect(store.state().status).toBe('forbidden');
  });

  it('una consola que responde da sus sedes con su práctica', () => {
    store.ensure();
    flushEffects();
    http.expectOne('/practice/infrastructure-access/me').flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne('/practices').flush([{ id: 'p-1' }]);
    http.expectOne('/practices/p-1/organization').flush({ organization: { id: 'p-1', name: 'San Lucas' }, sites: [{ id: 's-1', code: 'SL', name: 'San Lucas' }], clinicalUnits: [], careSpaces: [], healthcareServices: [], staff: [], legalDocuments: [], inventory: [] });
    expect(store.site()).toEqual({ id: 's-1', practiceId: 'p-1', code: 'SL', name: 'San Lucas', actions: null });
  });

  it('cambiar de organización descarta lo leído y cancela la lectura en vuelo', () => {
    store.ensure();
    flushEffects();
    const first = http.expectOne('/practice/infrastructure-access/me');
    tenant.set('t-2');
    flushEffects();
    expect(first.cancelled).toBe(true);
    http.expectOne('/practice/infrastructure-access/me').flush(access([{ siteId: 's-9', practiceId: 'p-9', code: 'X', name: 'Otra' }]));
    expect(store.siteId()).toBe('s-9');
  });

  it('el personal se pide sólo con ensureDirectory, y clear() lo olvida todo', () => {
    store.ensure();
    flushEffects();
    http.expectOne('/practice/infrastructure-access/me').flush(access([{ siteId: 's-1', practiceId: 'p-1', code: 'SL', name: 'San Lucas' }]));
    http.expectNone('/practices/p-1/organization');
    store.ensureDirectory();
    flushEffects();
    http.expectOne('/practices/p-1/organization').flush({ organization: { id: 'p-1', name: 'SL' }, sites: [], clinicalUnits: [], careSpaces: [], healthcareServices: [], staff: [{ practitionerProfileId: 'pp-1', practitionerName: 'Dra. Pérez' }], legalDocuments: [], inventory: [] });
    expect(store.directory().status).toBe('ready');
    store.clear();
    expect(store.state().status).toBe('loading');
    expect(store.directory().status).toBe('loading');
    expect(store.site()).toBeNull();
  });
});
