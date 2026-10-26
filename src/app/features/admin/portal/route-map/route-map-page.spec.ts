import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { mapRow, page, processSummary } from '../portal.fixture';
import { RouteMapPage } from './route-map-page';

const RUTA = '/superadmin/portal/systems/flows';

describe('RouteMapPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(url = RUTA): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/systems/flows', component: RouteMapPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, RouteMapPage);
    http.expectOne((r) => r.url === '/admin/portal/flujos').flush(page([processSummary()]));
  }

  afterEach(() => http.verify());

  it('pide el mapa con la señal de la URL (el enlace «escriben sin roles» del centro)', async () => {
    await abrir(`${RUTA}?senal=ESCRIBE_SIN_ROLES`);
    const req = http.expectOne((r) => r.url === '/admin/portal/flujos/mapa');
    expect(req.request.params.get('senal')).toBe('ESCRIBE_SIN_ROLES');
    req.flush(page([mapRow()]));
    harness.detectChanges();

    const tabla = harness.routeNativeElement!.querySelector('[data-testid="portal-route-map-table"]')!;
    expect(tabla.textContent).toContain('Escribe sin @Roles');
    expect(tabla.textContent).toContain('Ningún cliente del frontend');
    expect(tabla.textContent).toContain('Riesgo alto');
  });

  it('cada proceso de una ruta lleva a su diagrama', async () => {
    await abrir();
    http.expectOne((r) => r.url === '/admin/portal/flujos/mapa').flush(page([mapRow()]));
    harness.detectChanges();
    const enlace = [...harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('a')].find(
      (a) => a.textContent?.trim() === 'Agenda',
    )!;
    expect(enlace.getAttribute('href')).toBe('/superadmin/portal/systems/flows/diagram?flujo=scheduling');
  });

  it('distingue «sin dato» de «ningún cliente la llama»', async () => {
    await abrir();
    http.expectOne((r) => r.url === '/admin/portal/flujos/mapa').flush(page([mapRow({ llamadaPor: null })]));
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Sin dato');
  });
});
