import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PoliciesPage } from './policies-page';

const SCREEN = '/superadmin/portal/governance/policies';
const URL = '/admin/governance/policies';

const writePolicy = {
  policyType: 'WRITE',
  id: '00000000-0000-4000-8000-000000000001',
  code: 'W-APPEND',
  name: 'Sólo agregar',
  state: 'ACTIVE',
  version: 3,
  updatedAt: '2026-10-01T14:00:00.000Z',
};
const retentionNoState = {
  policyType: 'RETENTION',
  id: '00000000-0000-4000-8000-000000000002',
  code: 'RET-X',
  name: null,
  state: null,
  version: 1,
  updatedAt: null,
};
const page = (items: object[]) => ({
  items,
  nextCursor: null,
  limit: 50,
  sort: 'code',
  order: 'asc',
});

describe('PoliciesPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/policies', component: PoliciesPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PoliciesPage);
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  afterEach(() => http.verify());

  it('dibuja cada política con su tipo, su estado y su versión, y dice «sin estado» donde nadie lo declaró', async () => {
    await open();
    http.expectOne((r) => r.url === URL).flush(page([writePolicy, retentionNoState]));
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector(
      '[data-testid="portal-policies-table"]',
    )!;
    expect(table.textContent).toContain('W-APPEND');
    expect(table.textContent).toContain('Escritura');
    expect(table.textContent).toContain('Activa');
    expect(table.textContent).toContain('Versión 3');
    expect(table.textContent).toContain('Retención');
    expect(table.textContent).toContain('Sin estado');
    expect(table.textContent).toContain('Sin fecha de cambio');
  });

  it('no inventa totales ni conteos por tipo: la API no los manda', async () => {
    await open();
    http.expectOne((r) => r.url === URL).flush(page([writePolicy]));
    harness.detectChanges();
    expect(
      harness.routeNativeElement!.querySelector('[data-testid="portal-policies-metrics"]'),
    ).toBeNull();
  });

  it('el código enlaza a la ficha de la política', async () => {
    await open();
    http.expectOne((r) => r.url === URL).flush(page([writePolicy]));
    harness.detectChanges();
    const link = harness.routeNativeElement!.querySelector(
      '[data-testid="portal-policy-link"]',
    ) as HTMLAnchorElement;
    // El tipo viaja con el id: la API encuentra la política por `/policies/:policyType/:id`.
    expect(link.getAttribute('href')).toBe(`${SCREEN}/${writePolicy.id}?tipo=WRITE`);
  });

  it('manda a la API los filtros de la URL y descarta un tipo que la API no conoce', async () => {
    await open(`${SCREEN}?type=RETENTION&q=ret`);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('type')).toBe('RETENTION');
    expect(req.request.params.get('q')).toBe('ret');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(page([]));
  });

  it('un tipo inventado en la URL no llega a la API', async () => {
    await open(`${SCREEN}?type=OTRO`);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.has('type')).toBe(false);
    req.flush(page([]));
  });

  it('sin políticas y sin filtros explica por qué y ofrece una salida; con filtros ofrece quitarlos', async () => {
    await open();
    http.expectOne((r) => r.url === URL).flush(page([]));
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay políticas de gobierno registradas');
    expect(text()).toContain('Ver los campos con datos personales');
  });

  it('con filtros y sin resultados ofrece quitar los filtros', async () => {
    await open(`${SCREEN}?q=nada`);
    http.expectOne((r) => r.url === URL).flush(page([]));
    harness.detectChanges();
    expect(text()).toContain('Ninguna política coincide con los filtros elegidos.');
    expect(text()).toContain('Quitar los filtros');
  });

  it('un 403 de la API se dice como falta de permiso, no como lista vacía', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'Prohibido', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();
    expect(text()).not.toContain('Todavía no hay políticas');
    expect(
      harness.routeNativeElement!.querySelector('[data-testid="portal-policies-table"]'),
    ).not.toBeNull();
  });
});
