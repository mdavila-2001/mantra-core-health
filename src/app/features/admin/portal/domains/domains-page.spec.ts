import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { lineage, page, term } from '../portal.fixture';
import { DomainsPage } from './domains-page';

const RUTA = '/superadmin/portal/catalog/domains';

describe('DomainsPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/catalog/domains', component: DomainsPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${RUTA}${query}`, DomainsPage);
    http.expectOne('/admin/portal/linaje').flush(lineage());
  }

  function documento(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('busca en el glosario con el término de la URL y enlaza sus tablas', async () => {
    await abrir('?q=PHI');
    const req = http.expectOne((r) => r.url === '/admin/portal/glosario');
    expect(req.request.params.get('q')).toBe('PHI');
    req.flush(page([term()]));
    harness.detectChanges();
    const tabla = documento().querySelector('[data-testid="portal-glossary-table"]')!;
    expect(tabla.textContent).toContain('Dato de salud identificable.');
    const enlace = [...tabla.querySelectorAll('a')].find((a) => a.textContent?.includes('clinical.observations'))!;
    expect(enlace.getAttribute('href')).toBe('/superadmin/portal/catalog/tables/clinical/observations');
  });

  it('sin coincidencias lo dice con el término buscado y ofrece volver', async () => {
    await abrir('?q=zzz');
    http.expectOne((r) => r.url === '/admin/portal/glosario').flush(page([]));
    harness.detectChanges();
    expect(documento().textContent).toContain('Ningún término coincide con «zzz».');
  });

  it('los dominios, del mayor al menor, llevan a sus tablas', async () => {
    await abrir('?vista=dominios');
    http.expectOne((r) => r.url === '/admin/portal/glosario').flush(page([term()]));
    harness.detectChanges();
    const enlaces = [...documento().querySelectorAll<HTMLAnchorElement>('[data-testid="portal-domain-link"]')];
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual(['Financiero y ERP', 'Agenda']);
    expect(enlaces[1]!.getAttribute('href')).toBe('/superadmin/portal/catalog/tables?q=Agenda');
  });
});
