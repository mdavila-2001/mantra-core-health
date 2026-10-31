import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PiiPage } from './pii-page';

const SCREEN = '/superadmin/portal/governance/pii';
const URL = '/admin/governance/pii-fields';

const summary = (over: object = {}) => ({
  fields: 2,
  tables: 2,
  approved: 1,
  withoutProtection: 1,
  bySensitivity: { PHI_IDENTIFIER: 1, SIN_NIVEL_EN_CATALOGO: 1 },
  bySource: { BOTH: 1, REGISTRY: 1 },
  ...over,
});
const sources = { catalogColumns: 900, registryFields: 2 };

const protectedField = {
  schemaName: 'iam',
  tableName: 'people',
  columnName: 'documento',
  sensitivity: 'PHI_IDENTIFIER',
  reviewStatus: 'APPROVED',
  source: 'BOTH',
  registry: {
    isPii: true,
    isPhi: false,
    classification: 'PERSONAL',
    maskingStrategy: 'MASK_LAST4',
    anonymizationRule: null,
  },
};
const registryOnly = {
  schemaName: 'clinical',
  tableName: 'patients',
  columnName: 'fecha_nacimiento',
  sensitivity: null,
  reviewStatus: null,
  source: 'REGISTRY',
  registry: {
    isPii: true,
    isPhi: false,
    classification: null,
    maskingStrategy: null,
    anonymizationRule: null,
  },
};

describe('PiiPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/pii', component: PiiPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PiiPage);
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

  afterEach(() => http.verify());

  it('dibuja cada campo con su nivel, su revisión, su fuente y su protección declarada', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush({
        items: [protectedField, registryOnly],
        nextCursor: null,
        limit: 50,
        total: 2,
        summary: summary(),
        sources,
      });
    harness.detectChanges();
    const table = root().querySelector('[data-testid="portal-pii-table"]')!;
    expect(table.textContent).toContain('documento');
    expect(table.textContent).toContain('iam.people');
    expect(table.textContent).toContain('Salud: identificador');
    expect(table.textContent).toContain('Enmascarado: MASK_LAST4');
    expect(table.textContent).toContain('Catálogo y registro');
    // Un campo que sólo marca el registro no inventa un nivel, y sin protección lo dice.
    expect(table.textContent).toContain('Sin nivel en el catálogo');
    expect(table.textContent).toContain('Ninguna declarada en el registro de gobierno');
    expect(root().querySelector('[data-testid="portal-pii-metrics"]')!.textContent).toContain(
      'Sin protección declarada',
    );
  });

  it('manda los filtros de la URL y descarta un nivel o esquema que la API rechazaría', async () => {
    await open(`${SCREEN}?sensitivity=PERSONAL&source=BOTH&schema=iam&q=doc`);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('sensitivity')).toBe('PERSONAL');
    expect(req.request.params.get('source')).toBe('BOTH');
    expect(req.request.params.get('schema')).toBe('iam');
    expect(req.request.params.get('q')).toBe('doc');
    req.flush({
      items: [],
      nextCursor: null,
      limit: 50,
      total: 0,
      summary: summary({ fields: 0 }),
      sources,
    });
  });

  it('un nivel público o un esquema con caracteres raros no llegan a la API', async () => {
    await open(`${SCREEN}?sensitivity=PUBLIC&schema=a;b`);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.has('sensitivity')).toBe(false);
    expect(req.request.params.has('schema')).toBe(false);
    req.flush({
      items: [],
      nextCursor: null,
      limit: 50,
      total: 0,
      summary: summary({ fields: 0 }),
      sources,
    });
  });

  it('sin campos explica por qué según las fuentes que informa la API', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush({
        items: [],
        nextCursor: null,
        limit: 50,
        total: 0,
        summary: summary({ fields: 0, tables: 0, approved: 0, withoutProtection: 0 }),
        sources: { catalogColumns: 0, registryFields: 0 },
      });
    harness.detectChanges();
    expect(text()).toContain(
      'el catálogo de datos no tiene columnas escaneadas y el registro de gobierno está vacío',
    );
  });

  it('con catálogo escaneado pero nada clasificado lo dice con la cuenta de columnas', async () => {
    await open();
    http
      .expectOne((r) => r.url === URL)
      .flush({
        items: [],
        nextCursor: null,
        limit: 50,
        total: 0,
        summary: summary({ fields: 0, tables: 0, approved: 0, withoutProtection: 0 }),
        sources,
      });
    harness.detectChanges();
    expect(text()).toContain('El catálogo tiene 900 columnas, ninguna clasificada');
  });
});
