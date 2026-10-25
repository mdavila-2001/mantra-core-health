import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../core/auth/session.store';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { MedicalGroupsList } from './medical-groups-list';
import {
  CATALOG_STUB,
  listItem,
  ME,
  PROFILES_STUB,
  tokenFor,
} from './medical-groups.testing';

const RUTA = '/schedule/medical-groups';

describe('MedicalGroupsList', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'schedule/medical-groups', component: MedicalGroupsList }]),
        { provide: ProfilesClient, useValue: PROFILES_STUB },
        { provide: ServicesCatalogClient, useValue: CATALOG_STUB },
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: tokenFor({ sub: 'u-1', sid: 's-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: ME }),
      refreshToken: 'r-1',
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const tabRequest = (tab: string) => (r: { url: string; params: { get(k: string): string | null } }) =>
    r.url === '/medical-groups' && r.params.get('tab') === tab;

  async function open(items: unknown[], tab = 'historico'): Promise<HTMLElement> {
    await harness.navigateByUrl(RUTA, MedicalGroupsList);
    http.expectOne(tabRequest(tab)).flush({ items, nextCursor: null });
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('S2: mientras llega el listado muestra la carga y no una tabla vacía', async () => {
    await harness.navigateByUrl(RUTA, MedicalGroupsList);
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).not.toContain('Todavía no participó');
    http.expectOne(tabRequest('historico')).flush({ items: [], nextCursor: null });
  });

  it('pinta una fila por grupo con su estado y el lugar', async () => {
    const el = await open([
      listItem({ id: 'a', locationText: 'Quirófano 2', status: 'SCHEDULED', pendingMembersCount: 0 }),
      listItem({ id: 'b', locationText: 'Sala 7', status: 'PENDING_TEAM' }),
    ]);

    const text = el.textContent ?? '';
    expect(text).toContain('Quirófano 2');
    expect(text).toContain('Sala 7');
    expect(text).toContain('Programado');
    expect(text).toContain('Esperando al equipo');
  });

  it('S3: sin grupos ofrece crear el primero', async () => {
    const el = await open([]);

    expect(el.textContent).toContain('Todavía no participó en ningún grupo médico.');
    const accion = el.querySelector<HTMLAnchorElement>('a[href="/schedule/medical-groups/new"]');
    expect(accion).not.toBeNull();
  });

  it('el encabezado ofrece «Nuevo grupo médico» hacia el alta', async () => {
    const el = await open([]);

    const nuevo = el.querySelector<HTMLAnchorElement>('[data-testid="medical-groups-new"]');
    expect(nuevo?.getAttribute('href')).toBe('/schedule/medical-groups/new');
  });

  it('una invitación sin responder ofrece «Responder» y lleva a la pestaña del equipo', async () => {
    const el = await open([listItem({ id: 'rec', isCreator: false, status: 'PENDING_TEAM' })]);

    const enlace = el.querySelector<HTMLAnchorElement>('[data-testid="medical-group-open-rec"]');
    expect(enlace?.textContent?.trim()).toBe('Responder');
    expect(enlace?.getAttribute('href')).toBe('/schedule/medical-groups/rec?pestana=equipo');
  });

  it('un grupo propio ofrece «Abrir» sin pestaña', async () => {
    const el = await open([listItem({ id: 'mio', isCreator: true })]);

    const enlace = el.querySelector<HTMLAnchorElement>('[data-testid="medical-group-open-mio"]');
    expect(enlace?.textContent?.trim()).toBe('Abrir');
    expect(enlace?.getAttribute('href')).toBe('/schedule/medical-groups/mio');
  });

  it('cambiar de pestaña vuelve a pedir el listado con el `tab` correspondiente', async () => {
    const el = await open([listItem()]);

    const pestanas = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(pestanas.map((p) => p.textContent?.trim())).toEqual([
      'Histórico',
      'Solicitudes enviadas',
      'Solicitudes recibidas',
    ]);
    pestanas[2]!.click();
    harness.detectChanges();

    http.expectOne(tabRequest('recibidas')).flush({ items: [], nextCursor: null });
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.textContent).toContain('No tiene invitaciones a un grupo médico por responder.');
  });

  it('S9: un error del servidor muestra el ID de la petición y permite reintentar', async () => {
    await harness.navigateByUrl(RUTA, MedicalGroupsList);
    http.expectOne(tabRequest('historico')).flush(
      { code: 'INTERNAL', message: 'boom', correlationId: 'req-42', timestamp: '', path: '' },
      { status: 500, statusText: 'x' },
    );
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('req-42');

    const reintentar = Array.from(el.querySelectorAll('button')).find((b) =>
      /reintentar/i.test(b.textContent ?? ''),
    );
    expect(reintentar).toBeDefined();
    reintentar!.click();
    http.expectOne(tabRequest('historico')).flush({ items: [], nextCursor: null });
  });

  it('«Ver más grupos» aparece sólo cuando hay otra página y trae la siguiente', async () => {
    await harness.navigateByUrl(RUTA, MedicalGroupsList);
    http.expectOne(tabRequest('historico')).flush({ items: [listItem({ id: 'a' })], nextCursor: 'c2' });
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    const mas = el.querySelector<HTMLButtonElement>('[data-testid="medical-groups-more"]');
    expect(mas).not.toBeNull();
    mas!.click();

    const req = http.expectOne((r) => r.url === '/medical-groups' && r.params.get('cursor') === 'c2');
    req.flush({ items: [listItem({ id: 'b' })], nextCursor: null });
    harness.detectChanges();
    expect(el.querySelector('[data-testid="medical-groups-more"]')).toBeNull();
  });
});
