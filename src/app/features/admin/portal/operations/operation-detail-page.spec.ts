import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { billingTables, mapRow, operationDetail, page, tree } from '../portal.fixture';
import { nodeOutcome, nodeText } from './decision-tree';
import { OperationDetailPage } from './operation-detail-page';

const BASE = '/superadmin/portal/systems/operations';
const ID = 'SchedulingController_listSlots';

describe('OperationDetailPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/systems/operations/:id', component: OperationDetailPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${BASE}/${ID}${query}`, OperationDetailPage);
  }

  function responder(arbol: 'ok' | 'sin-arbol' = 'ok', detalle = operationDetail()): void {
    http.expectOne(`/admin/portal/operaciones/${ID}`).flush(detalle);
    const req = http.expectOne(`/admin/portal/operaciones/${ID}/arbol`);
    if (arbol === 'ok') req.flush(tree());
    else req.flush({ code: 'NOT_FOUND', message: 'La operación no tiene árbol de decisión' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
  }

  function texto(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => http.verify());

  it('pide la ficha y el árbol de la operación de la dirección', async () => {
    await abrir();
    responder();
    expect(texto()).toContain('Listar cupos');
    expect(texto()).toContain('Muestra los cupos libres de una agenda.');
    expect(texto()).toContain('Riesgo bajo');
  });

  it('abre la pestaña que dice `?vista=` y muestra el contrato', async () => {
    await abrir('?vista=contrato');
    responder();
    const contrato = harness.routeNativeElement!.querySelector('[data-testid="portal-operation-contract"]');
    expect(contrato?.textContent).toContain('from (query)');
  });

  it('sin árbol en el inventario lo dice como vacío con salida, no como error', async () => {
    await abrir('?vista=arbol');
    responder('sin-arbol');
    expect(texto()).toContain('El inventario no trae un árbol de decisión para esta operación.');
    expect(texto()).toContain('Ver el contrato de la operación');
  });

  it('dibuja el árbol con las dos ramas de una condición', async () => {
    await abrir('?vista=arbol');
    responder();
    const arbol = harness.routeNativeElement!.querySelector('[data-testid="portal-decision-tree"]')!;
    expect(arbol.textContent).toContain('Si se cumple');
    expect(arbol.textContent).toContain('Si no se cumple');
    expect(arbol.textContent).toContain('Si no se cumple: 401 UNAUTHENTICATED');
  });

  it('en Resumen dice cuántas tablas escribe y cuántas lee', async () => {
    await abrir();
    responder('ok', operationDetail({ datos: billingTables() }));
    expect(texto()).toContain('Tablas afectadas');
    expect(texto()).toContain('Escribe 2 tablas y lee 3 tablas (4 distintas)');
  });

  it('en Datos separa lo que escribe de lo que lee y pinta fuente, confianza y cadena de llamadas', async () => {
    await abrir('?vista=datos');
    responder('ok', operationDetail({ datos: billingTables() }));
    const datos = harness.routeNativeElement!.querySelector('[data-testid="portal-operation-data"]')!;
    expect(datos.querySelector('[data-testid="portal-tables-writes"]')!.textContent!.trim()).toBe('2');
    expect(datos.querySelector('[data-testid="portal-tables-reads"]')!.textContent!.trim()).toBe('3');
    expect(datos.textContent).toContain('Acceso en src/modules/billing/repositories/bills.repository.ts:177');
    expect(datos.textContent).toContain('BillsService.register');
    expect(datos.textContent).toContain('Confianza: Por SQL');
  });

  it('en Acceso pide quién la llama sólo al abrir esa pestaña y muestra los clientes', async () => {
    await abrir('?vista=acceso');
    responder();
    const req = http.expectOne((r) => r.url === '/admin/portal/flujos/mapa');
    expect(req.request.params.get('q')).toBe('/scheduling/slots');
    req.flush(page([mapRow({ id: ID, llamadaPor: ['SchedulingClient'] })]));
    harness.detectChanges();
    expect(texto()).toContain('Quién la llama desde el frontend');
    expect(texto()).toContain('SchedulingClient');
  });

  it('la pestaña «Ciclo de la petición» muestra las 21 etapas y avisa que es común a la API', async () => {
    await abrir('?vista=ciclo');
    responder();
    const ciclo = harness.routeNativeElement!.querySelector('[data-testid="portal-operation-cycle"]')!;
    expect(ciclo.querySelectorAll('.cycle__stage')).toHaveLength(21);
    expect(ciclo.textContent).toContain('Ciclo común de la API, no de esta operación');
    expect(ciclo.textContent).toContain('src/common/auth/roles.guard.ts:59');
  });

  it('sin pedir la pestaña del ciclo no se dibuja (los paneles inactivos no existen)', async () => {
    await abrir();
    responder();
    expect(harness.routeNativeElement!.querySelector('[data-testid="portal-operation-cycle"]')).toBeNull();
  });

  it('si la ficha no existe lo dice como no encontrado y no pinta pestañas', async () => {
    await abrir();
    http
      .expectOne(`/admin/portal/operaciones/${ID}`)
      .flush({ code: 'NOT_FOUND', message: 'Operación no encontrada en el inventario' }, { status: 404, statusText: 'Not Found' });
    http.expectOne(`/admin/portal/operaciones/${ID}/arbol`).flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[data-testid="portal-operation-detail"]')).toBeNull();
  });

  it('sin permiso (403) en la ficha no pinta datos', async () => {
    await abrir();
    http.expectOne(`/admin/portal/operaciones/${ID}`).flush({ code: 'ROLE_INSUFFICIENT', message: 'No' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`/admin/portal/operaciones/${ID}/arbol`).flush({ code: 'ROLE_INSUFFICIENT', message: 'No' }, { status: 403, statusText: 'Forbidden' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[data-testid="portal-operation-detail"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('[data-testid="portal-operation-data"]')).toBeNull();
  });
});

describe('decision-tree: lectura de un nodo', () => {
  it('usa el texto del generador y, si falta, lo que el nodo nombra', () => {
    expect(nodeText({ tipo: 'EFECTO', tabla: 'scheduling.slots', operacion: 'ESCRIBE' })).toBe(
      'ESCRIBE scheduling.slots',
    );
    expect(nodeText({ tipo: 'LLAMADA' })).toBe('Paso sin descripción');
  });

  it('dice con qué termina un paso o qué pasa si falla', () => {
    expect(nodeOutcome({ tipo: 'RESPUESTA', estado: 201 })).toBe('201');
    expect(nodeOutcome({ tipo: 'ERROR', estado: 404, codigo: 'NOT_FOUND' })).toBe('404 NOT_FOUND');
    expect(nodeOutcome({ tipo: 'LLAMADA' })).toBeNull();
  });
});
