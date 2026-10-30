import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { operation, page, processSummary } from '../portal.fixture';
import { OperationsPage } from './operations-page';

const RUTA = '/superadmin/portal/systems/operations';

describe('OperationsPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(url = RUTA): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/systems/operations', component: OperationsPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, OperationsPage);
    http
      .expectOne((r) => r.url === '/admin/portal/flujos' && r.params.get('limit') === '200')
      .flush(page([processSummary()]));
  }

  function listado() {
    return http.expectOne((r) => r.url === '/admin/portal/operaciones');
  }

  function texto(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => http.verify());

  it('lista cada operación con su método, ruta, riesgo y sólo las señales de atención', async () => {
    await abrir();
    listado().flush(page([operation()]));
    harness.detectChanges();

    const tabla = harness.routeNativeElement!.querySelector('[data-testid="portal-operations-table"]')!;
    expect(tabla.textContent).toContain('/scheduling/slots');
    expect(tabla.textContent).toContain('Riesgo bajo');
    expect(tabla.textContent).toContain('Sin pruebas');
    // `EVENTO` describe, no alerta: no va en la columna de atención.
    expect(tabla.textContent).not.toContain('Emite eventos');
    const enlace = tabla.querySelector<HTMLAnchorElement>('[data-testid="portal-operation-link"]')!;
    expect(enlace.getAttribute('href')).toBe(`${RUTA}/SchedulingController_listSlots`);
  });

  it('pide la lista con los filtros de la URL y sin claves vacías', async () => {
    await abrir(`${RUTA}?riesgo=ALTO&senal=SIN_PRUEBAS&q=slots`);
    const req = listado();
    expect(req.request.params.get('riesgo')).toBe('ALTO');
    expect(req.request.params.get('senal')).toBe('SIN_PRUEBAS');
    expect(req.request.params.get('q')).toBe('slots');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('modulo')).toBe(false);
    req.flush(page([]));
  });

  it('descarta un código que la API no acepta en vez de mandarlo y recibir un 400', async () => {
    await abrir(`${RUTA}?riesgo=FOO&metodo=TRACE`);
    const req = listado();
    expect(req.request.params.has('riesgo')).toBe(false);
    expect(req.request.params.has('metodo')).toBe(false);
    req.flush(page([]));
  });

  it('sin resultados con filtros, ofrece quitar los filtros', async () => {
    await abrir(`${RUTA}?riesgo=ALTO`);
    listado().flush(page([]));
    harness.detectChanges();
    expect(texto()).toContain('Ninguna operación coincide con los filtros elegidos.');
    expect(texto()).toContain('Ver todas las operaciones');
  });

  it('las opciones de módulo salen de los procesos del inventario, no de una lista escrita a mano', async () => {
    await abrir();
    listado().flush(page([operation()]));
    const pantalla = harness.routeDebugElement!.componentInstance as unknown as {
      filterDefs(): readonly { key: string; options: readonly { value: string; label: string }[] }[];
    };
    const modulo = pantalla.filterDefs().find((f) => f.key === 'modulo')!;
    expect(modulo.options).toEqual([{ value: 'scheduling', label: 'Módulo 41 — Agenda' }]);
  });
});
