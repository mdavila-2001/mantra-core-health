import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PoliciesPage } from './policies-page';

const SCREEN = '/superadmin/portal/governance/policies';
const URL = '/admin/governance/policies';

const writePolicy = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'WRITE',
  code: 'W-APPEND',
  name: 'Sólo agregar',
  stateCode: 'ACTIVE',
  stateLabel: 'Activo',
  attributes: {
    insertMode: 'Permitido',
    updateMode: 'Prohibido',
    deleteMode: 'Prohibido',
    requiresReason: true,
    dualControl: false,
  },
  updatedAt: '2026-10-01T14:00:00.000Z',
};
const retentionNoPeriod = {
  id: '00000000-0000-4000-8000-000000000002',
  type: 'RETENTION',
  code: 'RET-X',
  name: null,
  stateCode: null,
  stateLabel: null,
  attributes: { retentionPeriodDays: null, disposition: null },
  updatedAt: null,
};
const byType = [
  { type: 'WRITE', total: 1 },
  { type: 'RETENTION', total: 1 },
  { type: 'ANONYMIZATION', total: 0 },
  { type: 'CLASSIFICATION', total: 0 },
  { type: 'RESIDENCY', total: 0 },
];

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

  it('dibuja cada política con su control en palabras, y dice «sin declarar» donde nadie declaró', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush({
        items: [writePolicy, retentionNoPeriod],
        nextCursor: null,
        limit: 50,
        total: 2,
        byType,
      });
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector(
      '[data-testid="portal-policies-table"]',
    )!;
    expect(table.textContent).toContain('W-APPEND');
    expect(table.textContent).toContain(
      'Alta: Permitido · Cambio: Prohibido · Baja: Prohibido · exige motivo',
    );
    expect(table.textContent).toContain('Sin plazo declarado · al vencer: Sin declarar');
    expect(table.textContent).toContain('Sin fecha de cambio');
    // 0 no es «sin datos»: el tipo existe y no tiene políticas.
    const metrics = harness.routeNativeElement!.querySelector(
      '[data-testid="portal-policies-metrics"]',
    )!;
    expect(metrics.textContent).toContain('Anonimización');
  });

  it('el código enlaza a la ficha de la política', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush({ items: [writePolicy], nextCursor: null, limit: 50, total: 1, byType });
    harness.detectChanges();
    const link = harness.routeNativeElement!.querySelector(
      '[data-testid="portal-policy-link"]',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`${SCREEN}/${writePolicy.id}`);
  });

  it('manda a la API los filtros de la URL y descarta un tipo que la API no conoce', async () => {
    await open(`${SCREEN}?type=RETENTION&q=ret`);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('type')).toBe('RETENTION');
    expect(req.request.params.get('q')).toBe('ret');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ items: [], nextCursor: null, limit: 50, total: 0, byType });
  });

  it('un tipo inventado en la URL no llega a la API', async () => {
    await open(`${SCREEN}?type=OTRO`);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.has('type')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50, total: 0, byType });
  });

  it('sin políticas y sin filtros explica por qué y ofrece una salida; con filtros ofrece quitarlos', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush({ items: [], nextCursor: null, limit: 50, total: 0, byType });
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay políticas de gobierno registradas');
    expect(text()).toContain('Ver los campos con datos personales');
  });

  it('con filtros y sin resultados ofrece quitar los filtros', async () => {
    await open(`${SCREEN}?q=nada`);
    http
      .expectOne((r) => r.url === URL)
      .flush({ items: [], nextCursor: null, limit: 50, total: 0, byType });
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
