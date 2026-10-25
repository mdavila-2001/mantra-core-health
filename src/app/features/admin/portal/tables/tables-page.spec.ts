import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { page, tableSheet, tableSummary } from '../portal.fixture';
import { toColumnRow } from './table-columns';
import { TableDetailPage } from './table-detail-page';
import { TablesPage } from './tables-page';

const LISTA = '/superadmin/portal/catalog/tables';

describe('TablesPage y TableDetailPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/catalog/tables', component: TablesPage },
          { path: 'superadmin/portal/catalog/tables/:schema/:table', component: TableDetailPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  function documento(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  it('aplica el schema y el estado del ORM de la URL; `appendOnly` viaja como booleano', async () => {
    await harness.navigateByUrl(`${LISTA}?schema=scheduling&orm=DIVERGE&appendOnly=false`, TablesPage);
    const req = http.expectOne((r) => r.url === '/admin/portal/catalogo/tablas');
    expect(req.request.params.get('schema')).toBe('scheduling');
    expect(req.request.params.get('orm')).toBe('DIVERGE');
    expect(req.request.params.get('appendOnly')).toBe('false');
    req.flush(page([tableSummary()]));
    harness.detectChanges();

    expect(documento().querySelector('[data-testid="portal-tables-schema"]')?.textContent).toContain('scheduling');
    const enlace = documento().querySelector('[data-testid="portal-table-link"]')!;
    expect(enlace.getAttribute('href')).toBe(`${LISTA}/scheduling/slots`);
  });

  it('enlaza el catálogo vivo, que es otra fuente', async () => {
    await harness.navigateByUrl(LISTA, TablesPage);
    http.expectOne((r) => r.url === '/admin/portal/catalogo/tablas').flush(page([]));
    harness.detectChanges();
    const vivo = [...documento().querySelectorAll('a')].find((a) => a.textContent?.includes('catálogo vivo'));
    expect(vivo?.getAttribute('href')).toBe('/superadmin/data-catalog');
  });

  it('la ficha muestra propósito, gobierno sin inventar y el enlace a su linaje', async () => {
    await harness.navigateByUrl(`${LISTA}/scheduling/slots`, TableDetailPage);
    http.expectOne('/admin/portal/catalogo/tablas/scheduling/slots').flush(tableSheet());
    harness.detectChanges();
    const ficha = documento().querySelector('[data-testid="portal-table-detail"]')!;
    expect(ficha.textContent).toContain('Cupos de atención ofrecidos.');
    expect(ficha.textContent).toContain('Borrador curado por dominio');
    expect(ficha.textContent).toContain('Sin fuente');
    expect(ficha.textContent).toContain('Sólo admite altas (append-only)');
    const linaje = [...ficha.querySelectorAll('a')].find((a) => a.textContent?.includes('lineage'))!;
    expect(linaje.getAttribute('href')).toBe('/superadmin/portal/lineage?tabla=scheduling.slots');
  });

  it('las relaciones llevan a la ficha de la otra tabla', async () => {
    await harness.navigateByUrl(`${LISTA}/scheduling/slots?vista=relaciones`, TableDetailPage);
    http.expectOne('/admin/portal/catalogo/tablas/scheduling/slots').flush(tableSheet());
    harness.detectChanges();
    const relaciones = documento().querySelector('[data-testid="portal-table-relations"]')!;
    const destino = [...relaciones.querySelectorAll('a')].find((a) => a.textContent?.includes('scheduling.resources'))!;
    expect(destino.getAttribute('href')).toBe(`${LISTA}/scheduling/resources`);
    expect(relaciones.textContent).toContain('Clave foránea declarada');
  });
});

describe('table-columns', () => {
  it('arma la fila de una columna con su referencia y sin inventar descripción', () => {
    const fila = toColumnRow(tableSheet().columnas[0]!);
    expect(fila.keys).toEqual(['FK']);
    expect(fila.references).toBe('scheduling.resources.id');
    expect(fila.nullable).toBe('Obligatoria');
    expect(toColumnRow({ ...tableSheet().columnas[0]!, descripcion: null }).description).toBe('Sin descripción');
  });
});
