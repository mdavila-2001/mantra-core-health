import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { graph, page, processSummary } from '../portal.fixture';
import { ProcessDiagramPage } from './process-diagram-page';
import { buildLanes, summarize } from './process-graph.model';

const RUTA = '/superadmin/portal/systems/flows/diagram';

describe('ProcessDiagramPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(url = RUTA): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/systems/flows/diagram', component: ProcessDiagramPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, ProcessDiagramPage);
    http.expectOne((r) => r.url === '/admin/portal/flujos').flush(page([processSummary()]));
    harness.detectChanges();
  }

  afterEach(() => http.verify());

  it('sin proceso elegido no pide nada y dice qué hacer', async () => {
    await abrir();
    http.expectNone((r) => r.url.endsWith('/grafo'));
    expect(harness.routeNativeElement!.textContent).toContain('Elija un proceso arriba para ver su diagrama.');
  });

  it('con `?flujo=` dibuja los carriles del proceso', async () => {
    await abrir(`${RUTA}?flujo=scheduling`);
    http.expectOne('/admin/portal/flujos/scheduling/grafo').flush(graph());
    harness.detectChanges();
    const diagrama = harness.routeNativeElement!.querySelector('[data-testid="portal-process-graph"]')!;
    expect(diagrama.querySelectorAll('[data-testid="portal-graph-lane"]')).toHaveLength(2);
    expect(diagrama.textContent).toContain('Ofrecer cupos');
    expect(diagrama.textContent).toContain('Sin etapa asignada');
    expect(diagrama.textContent).toContain('Actúa: SCHEDULING_ADMIN');
  });

  it('un proceso que no existe es un «no encontrado», no un diagrama vacío', async () => {
    await abrir(`${RUTA}?flujo=nada`);
    http
      .expectOne('/admin/portal/flujos/nada/grafo')
      .flush({ code: 'NOT_FOUND', message: 'No existe ese proceso' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[data-testid="portal-process-graph"]')).toBeNull();
  });
});

describe('process-graph.model', () => {
  it('ordena las operaciones por etapa y junta al final las que ninguna contiene', () => {
    const lanes = buildLanes(graph());
    expect(lanes.map((l) => l.label)).toEqual(['Ofrecer cupos', 'Sin etapa asignada']);
    const [crear] = lanes[0]!.operations;
    expect(crear!.actors).toEqual(['SCHEDULING_ADMIN']);
    expect(crear!.tables.ESCRIBE.map((t) => t.qualified)).toEqual(['scheduling.slots']);
    expect(crear!.tables.LEE).toEqual([]);
    expect(lanes[1]!.operations[0]!.tables.LEE[0]).toEqual({
      qualified: 'scheduling.slots',
      schema: 'scheduling',
      table: 'slots',
    });
  });

  it('cuenta nodos y aristas por tipo', () => {
    const { nodes, edges } = summarize(graph());
    expect(nodes).toEqual({ ETAPA: 1, OPERACION: 2, ACTOR: 1, TABLA: 1 });
    expect(edges['ESCRIBE']).toBe(1);
  });
});
