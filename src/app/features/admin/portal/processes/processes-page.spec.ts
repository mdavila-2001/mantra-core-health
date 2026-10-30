import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { page, processDetail, processSummary } from '../portal.fixture';
import { ProcessDetailPage } from './process-detail-page';
import { ProcessesPage } from './processes-page';

const LISTA = '/superadmin/portal/processes';

describe('ProcessesPage y ProcessDetailPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/processes', component: ProcessesPage },
          { path: 'superadmin/portal/processes/:code', component: ProcessDetailPage },
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

  it('lista los procesos con los filtros de la URL; un tipo desconocido no viaja', async () => {
    await harness.navigateByUrl(`${LISTA}?tipo=CRITICO&agrupacion=INVENTADA&q=agenda`, ProcessesPage);
    // El catálogo de módulos y el listado salen del mismo endpoint, con parámetros distintos.
    const pedidos = http.match((r) => r.url === '/admin/portal/flujos');
    const listado = pedidos.find((r) => r.request.params.get('limit') === '25')!;
    expect(listado.request.params.get('tipo')).toBe('CRITICO');
    expect(listado.request.params.get('q')).toBe('agenda');
    expect(listado.request.params.has('agrupacion')).toBe(false);
    for (const p of pedidos) p.flush(page([processSummary()]));
    harness.detectChanges();

    const tabla = documento().querySelector('[data-testid="portal-processes-table"]')!;
    expect(tabla.textContent).toContain('Módulo 41 — Agenda');
    expect(tabla.querySelector('a')!.getAttribute('href')).toBe(`${LISTA}/scheduling`);
  });

  it('la ficha muestra para qué sirve y salta al diagrama y a sus operaciones', async () => {
    await harness.navigateByUrl(`${LISTA}/scheduling`, ProcessDetailPage);
    http.expectOne('/admin/portal/flujos/scheduling').flush(processDetail());
    harness.detectChanges();

    const ficha = documento().querySelector('[data-testid="portal-process-detail"]')!;
    expect(ficha.textContent).toContain('Ofrece y reserva cupos de atención.');
    const enlaces = [...ficha.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/superadmin/portal/systems/flows/diagram?flujo=scheduling');
    expect(enlaces).toContain('/superadmin/portal/systems/operations?flujo=scheduling');
  });

  it('`?vista=etapas` abre las etapas con sus operaciones y las tablas que tocan', async () => {
    await harness.navigateByUrl(`${LISTA}/scheduling?vista=etapas`, ProcessDetailPage);
    http.expectOne('/admin/portal/flujos/scheduling').flush(processDetail());
    harness.detectChanges();
    const etapas = documento().querySelector('[data-testid="portal-process-stages"]')!;
    expect(etapas.textContent).toContain('Ofrecer cupos');
    expect(etapas.textContent).toContain('Crea un cupo');
    const tabla = [...etapas.querySelectorAll('a')].find((a) => a.textContent?.includes('scheduling.slots'))!;
    expect(tabla.getAttribute('href')).toBe('/superadmin/portal/catalog/tables/scheduling/slots');
  });

  it('`?vista=estados` marca los estados iniciales y finales', async () => {
    await harness.navigateByUrl(`${LISTA}/scheduling?vista=estados`, ProcessDetailPage);
    http.expectOne('/admin/portal/flujos/scheduling').flush(processDetail());
    harness.detectChanges();
    const maquinas = documento().querySelector('[data-testid="portal-process-machines"]')!;
    expect(maquinas.textContent).toContain('REQUESTED · inicial');
    expect(maquinas.textContent).toContain('CONFIRMED · final');
  });
});
