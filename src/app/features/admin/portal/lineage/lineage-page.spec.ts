import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { lineage, page, tableLineage, tableSummary } from '../portal.fixture';
import { LineagePage, lineageMetrics } from './lineage-page';
import { groupByEffect } from './table-lineage-drawer';

const RUTA = '/superadmin/portal/lineage';

describe('LineagePage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/lineage', component: LineagePage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${RUTA}${query}`, LineagePage);
    http.expectOne('/admin/portal/linaje').flush(lineage());
  }

  function documento(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('muestra el tamaño del grafo; un estado sin fuente no se pinta como número', async () => {
    await abrir();
    http.expectOne((r) => r.url === '/admin/portal/catalogo/tablas').flush(page([tableSummary()]));
    harness.detectChanges();
    const metricas = documento().querySelector('[data-testid="portal-lineage-metrics"]')!;
    expect(metricas.textContent).toContain('Tablas con datos personales');
    expect(metricas.textContent).toContain('Sin fuente');
  });

  it('`?tabla=` abre su linaje: primero lo que escribe y después lo que lee', async () => {
    await abrir('?tabla=scheduling.slots');
    http.expectOne((r) => r.url === '/admin/portal/catalogo/tablas').flush(page([tableSummary()]));
    http.expectOne('/admin/portal/linaje/tablas/scheduling/slots').flush(tableLineage());
    harness.detectChanges();
    const cajon = documento().querySelector('[data-testid="portal-table-lineage"]')!;
    const texto = cajon.textContent ?? '';
    expect(texto.indexOf('POST /scheduling/slots')).toBeLessThan(texto.indexOf('GET /scheduling/slots'));
    expect(texto).toContain('scheduling.resources');
    expect(texto).toContain('Ninguna tabla la apunta.');
  });

  it('una dirección sin `schema.tabla` no pide nada y dice que no la encontró', async () => {
    await abrir('?tabla=sinpunto');
    http.expectOne((r) => r.url === '/admin/portal/catalogo/tablas').flush(page([]));
    harness.detectChanges();
    http.expectNone((r) => r.url.startsWith('/admin/portal/linaje/tablas'));
  });
});

describe('lineage helpers', () => {
  it('agrupa por efecto con las escrituras primero', () => {
    expect(groupByEffect(tableLineage().operaciones).map((g) => g.effect)).toEqual(['ESCRIBE', 'LEE']);
  });

  it('nombra las métricas conocidas y deja las nuevas con su clave', () => {
    const metricas = lineageMetrics({ metricas: { tablas: 3, nueva: 1 }, dominios: [] });
    expect(metricas).toEqual([
      { key: 'tablas', label: 'Tablas', value: 3 },
      { key: 'nueva', label: 'nueva', value: 1 },
    ]);
  });
});
