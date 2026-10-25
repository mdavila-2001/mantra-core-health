import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { MedicalGroupList } from './medical-group-list';

/**
 * El listado de grupos médicos. Lo que se fija:
 *
 * 1. Las tres pestañas son las tres lecturas de la API (`?tab=`), y cada una se
 *    lee la primera vez que se abre, no todas de entrada.
 * 2. La pestaña viaja en la URL, así que recargar deja a la persona donde estaba.
 * 3. Estados M34: S2 mientras carga, S3 con su próxima acción, S9 con el ID de
 *    la petición y reintento.
 */
describe('MedicalGroupList', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'g-1',
    serviceCatalogId: 's-1',
    serviceName: 'Colecistectomía laparoscópica',
    scheduledAt: '2099-11-05T14:00:00.000Z',
    locationText: 'Clínica Foianini, quirófano 2',
    status: 'PENDING_TEAM',
    isCreator: true,
    pendingMembersCount: 2,
    ...overrides,
  });

  const tabRequest = (tab: string) => (r: { url: string; params: { get(k: string): string | null } }) =>
    r.url === '/medical-groups' && r.params.get('tab') === tab;

  async function open(url = '/my-medical-groups'): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-medical-groups', component: MedicalGroupList }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, MedicalGroupList);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  afterEach(() => http.verify());

  it('abre en el histórico y lee sólo esa pestaña', async () => {
    const el = await open();

    http.expectOne(tabRequest('historico')).flush({ items: [row()], nextCursor: null });
    await settle();

    expect(el.textContent).toContain('Colecistectomía laparoscópica');
    expect(el.textContent).toContain('Clínica Foianini, quirófano 2');
    expect(el.textContent).toContain('2 invitaciones sin responder');
    http.expectNone(tabRequest('enviadas'));
    http.expectNone(tabRequest('recibidas'));
  });

  it('S2: mientras llega la lectura no muestra el vacío', async () => {
    const el = await open();

    expect(el.textContent).not.toContain('Todavía no creó ni integró');
    http.expectOne(tabRequest('historico')).flush({ items: [], nextCursor: null });
  });

  it('S3: un histórico vacío ofrece crear el primero', async () => {
    const el = await open();
    http.expectOne(tabRequest('historico')).flush({ items: [], nextCursor: null });
    await settle();

    expect(el.textContent).toContain('Todavía no creó ni integró ningún grupo médico.');
    expect(el.querySelector('a[href="/my-medical-groups/new"]')).not.toBeNull();
  });

  it('cada fila lleva a la consulta de su grupo', async () => {
    const el = await open();
    http.expectOne(tabRequest('historico')).flush({ items: [row({ id: 'g-9' })], nextCursor: null });
    await settle();

    const enlace = el.querySelector<HTMLAnchorElement>('[data-testid="medical-group-open"]');
    expect(enlace?.getAttribute('href')).toBe('/my-medical-groups/g-9');
  });

  it('abrir otra pestaña la lee por primera vez y la deja en la URL', async () => {
    const el = await open();
    http.expectOne(tabRequest('historico')).flush({ items: [row()], nextCursor: null });
    await settle();

    const pestanas = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(pestanas.map((p) => p.textContent?.trim())).toEqual([
      'Histórico de grupos',
      'Solicitudes enviadas',
      'Solicitudes recibidas',
    ]);
    pestanas[2]!.click();
    await settle();

    http.expectOne(tabRequest('recibidas')).flush({ items: [], nextCursor: null });
    await settle();
    expect(el.textContent).toContain('No tiene invitaciones por responder.');
    expect(TestBed.inject(Router).url).toBe('/my-medical-groups?tab=recibidas');
  });

  it('`?tab=enviadas` abre directo esa pestaña', async () => {
    await open('/my-medical-groups?tab=enviadas');

    http.expectOne(tabRequest('enviadas')).flush({ items: [row()], nextCursor: null });
    http.expectNone(tabRequest('historico'));
  });

  it('S9: un error del servidor muestra el ID de la petición y reintenta', async () => {
    const el = await open();
    http.expectOne(tabRequest('historico')).flush(
      { code: 'INTERNAL', message: 'boom', correlationId: 'req-42', timestamp: '', path: '' },
      { status: 500, statusText: 'x' },
    );
    await settle();

    expect(el.textContent).toContain('req-42');
    const reintentar = Array.from(el.querySelectorAll('button')).find((b) =>
      /reintentar/i.test(b.textContent ?? ''),
    );
    expect(reintentar).toBeDefined();
    reintentar!.click();
    http.expectOne(tabRequest('historico')).flush({ items: [], nextCursor: null });
  });
});
