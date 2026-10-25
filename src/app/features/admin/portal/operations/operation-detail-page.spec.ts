import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { operationDetail, tree } from '../portal.fixture';
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

  function responder(arbol: 'ok' | 'sin-arbol' = 'ok'): void {
    http.expectOne(`/admin/portal/operaciones/${ID}`).flush(operationDetail());
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
