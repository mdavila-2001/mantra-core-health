import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { SchemaSummary } from '../../../../core/data-access/admin-portal/data-catalog.types';
import { SchemasPage, toSchemaRow } from './schemas-page';

const RUTA = '/superadmin/portal/schemas';

const SCHEMA: SchemaSummary = {
  schemaName: 'scheduling',
  objects: 12,
  notObserved: 2,
  annotated: 4,
  approved: 1,
  description: {
    moduleNumber: 41,
    moduleCode: 'scheduling',
    title: 'Agenda',
    domain: 'Atención',
    business: 'Ofrece y reserva cupos.',
    system: '12 tablas',
    source: 'SALUD/Módulos/41.md',
  },
};

const COBERTURA = {
  modelVersion: 'v6.1.0',
  denominator: 0,
  declaredDebt: 0,
  lastScan: null,
  dimensions: {
    technical: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    semantic: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    ownership: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    sensitivity: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
    review: { status: 'UNKNOWN', covered: 0, denominator: 0, ratio: null },
  },
};

describe('SchemasPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/schemas', component: SchemasPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${RUTA}${query}`, SchemasPage);
    http.expectOne('/admin/catalog/schemas').flush([SCHEMA]);
    http.expectOne((r) => r.url === '/admin/catalog/coverage').flush(COBERTURA);
    harness.detectChanges();
  }

  function documento(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('muestra la versión del modelo y la deriva de cada schema con la base', async () => {
    await abrir();
    expect(documento().textContent).toContain('v6.1.0');
    const tabla = documento().querySelector('[data-testid="portal-schemas-table"]')!;
    expect(tabla.textContent).toContain('M41 · Agenda');
    expect(tabla.textContent).toContain('2 sin observar');
  });

  it('`?schema=` abre el cajón con lo que dice la bóveda y sus objetos', async () => {
    await abrir('?schema=scheduling');
    const req = http.expectOne((r) => r.url === '/admin/catalog/objects');
    expect(req.request.params.get('schema')).toBe('scheduling');
    req.flush({ items: [], nextCursor: null, limit: 25 });
    harness.detectChanges();
    const cajon = documento().querySelector('[data-testid="portal-schema-detail"]')!;
    expect(cajon.textContent).toContain('Ofrece y reserva cupos.');
    expect(cajon.textContent).toContain('El último escaneo no vio objetos en este schema.');
    const tablas = [...cajon.querySelectorAll('a')].find((a) => a.textContent?.includes('catálogo del modelo'))!;
    expect(tablas.getAttribute('href')).toBe('/superadmin/portal/catalog/tables?schema=scheduling');
  });
});

describe('toSchemaRow', () => {
  it('un schema que la bóveda no declara lo dice, no inventa un módulo', () => {
    expect(toSchemaRow({ ...SCHEMA, description: null }).module).toBe('Sin módulo en la bóveda');
  });
});
