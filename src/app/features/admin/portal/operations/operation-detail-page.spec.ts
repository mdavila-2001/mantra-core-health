import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { mapRow, operationDetail, page, tree } from '../portal.fixture';
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

  function responder(arbol: 'ok' | 'sin-arbol' = 'ok', mapa: 'con-fila' | 'sin-fila' | 'error' = 'con-fila'): void {
    http.expectOne(`/admin/portal/operaciones/${ID}`).flush(operationDetail());
    const req = http.expectOne(`/admin/portal/operaciones/${ID}/arbol`);
    if (arbol === 'ok') req.flush(tree());
    else req.flush({ code: 'NOT_FOUND', message: 'La operación no tiene árbol de decisión' }, { status: 404, statusText: 'Not Found' });
    // `llamadaPor` sólo vive en el mapa de rutas: la ficha lo pide por la ruta de la operación.
    const map = http.expectOne(
      (r) => r.url === '/admin/portal/flujos/mapa' && r.params.get('q') === '/scheduling/slots',
    );
    if (mapa === 'con-fila') map.flush(page([mapRow(), mapRow({ id: ID, metodo: 'GET', llamadaPor: ['SchedulingClient', 'AgendaPage'] })]));
    else if (mapa === 'sin-fila') map.flush(page([mapRow()]));
    else map.flush({ code: 'INTERNAL', message: 'falló' }, { status: 500, statusText: 'Internal Server Error' });
    harness.detectChanges();
  }

  function seccion(testId: string): HTMLElement | null {
    return harness.routeNativeElement!.querySelector(`[data-testid="${testId}"]`);
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

  it('en el resumen deriva controlador, función y tipo de operación de lo que trae la ficha', async () => {
    await abrir();
    responder();
    expect(texto()).toContain('SchedulingController');
    expect(texto()).toContain('listSlots');
    // Escribe en `slot_views`: no es sólo lectura aunque el método sea GET.
    expect(seccion('portal-operation-kind')?.textContent).toContain('Escribe en la base');
    expect(texto()).toContain('2 tablas: 1 leída · 1 escrita · 0 borradas');
  });

  it('«Tablas afectadas» separa lee/escribe, cuenta tablas y no filas, y muestra vía, fuente y confianza', async () => {
    await abrir('?vista=datos');
    responder();
    expect(seccion('portal-operation-tables-count')?.textContent).toContain('2 tablas: 1 leída · 1 escrita · 0 borradas');
    const lee = seccion('portal-operation-tables-LEE')!;
    expect(lee.querySelectorAll('li.data__table').length).toBe(1);
    expect(lee.textContent).toContain('scheduling.slots');
    expect(lee.textContent).toContain('SlotsService.list → SlotsRepository.find');
    expect(lee.textContent).toContain('SlotsRepository.countByDay');
    expect(lee.textContent).toContain('slots.repository.ts:12');
    expect(lee.textContent).toContain('slots.repository.ts:40');
    expect(lee.textContent).toContain('Confianza: Directa');
    expect(lee.textContent).toContain('Confianza: Por SQL');
    const escribe = seccion('portal-operation-tables-ESCRIBE')!;
    expect(escribe.textContent).toContain('scheduling.slot_views');
    expect(escribe.textContent).toContain('CREA');
    expect(escribe.textContent).toContain('Confianza: Por tipo');
    expect(seccion('portal-operation-tables-BORRA')).toBeNull();
    expect(lee.querySelector('a')?.getAttribute('href')).toBe('/superadmin/portal/catalog/tables/scheduling/slots');
    expect(texto()).toContain('scheduling.slots.viewed');
  });

  it('«Ciclo de la petición» marca con texto qué etapas aplican a esta operación y cuáles no se determinan', async () => {
    await abrir('?vista=ciclo');
    responder();
    const ciclo = seccion('portal-request-cycle')!;
    const etapas = [...ciclo.querySelectorAll('li.cycle__stage')];
    expect(etapas.length).toBe(21);
    expect(ciclo.querySelectorAll('[data-testid="portal-request-cycle-phase"]').length).toBe(8);
    const porNumero = (n: number) => etapas.find((e) => e.textContent?.includes(`Etapa ${n}`))!;
    expect(porNumero(7).getAttribute('data-applies')).toBe('APLICA');
    expect(porNumero(7).textContent).toContain('JWT Bearer');
    expect(porNumero(9).textContent).toContain('SCHEDULING_ADMIN, PRACTITIONER');
    expect(porNumero(3).getAttribute('data-applies')).toBe('NO_APLICA');
    expect(porNumero(3).textContent).toContain('No aplica');
    expect(porNumero(11).textContent).toContain('Sólo actúa en rutas @Public()');
    expect(porNumero(13).getAttribute('data-applies')).toBe('NO_DETERMINABLE');
    expect(porNumero(13).textContent).toContain('No determinable desde el inventario');
    expect(porNumero(17).textContent).toContain('no registra una transacción explícita');
    expect(porNumero(18).textContent).toContain('2 tablas');
    expect(porNumero(19).textContent).toContain('scheduling.slots.viewed');
    expect(porNumero(21).textContent).toContain('401 UNAUTHENTICATED, 403 FORBIDDEN');
    expect(porNumero(1).textContent).toContain('src/main.ts:162');
    expect(seccion('portal-request-cycle-count')?.textContent).toContain('no determinables desde el inventario');
  });

  it('«Respuestas» lista las respuestas posibles y quién la llama según el mapa de rutas', async () => {
    await abrir('?vista=respuestas');
    responder();
    const resp = seccion('portal-operation-responses')!;
    expect(resp.textContent).toContain('UNAUTHENTICATED');
    expect(resp.textContent).toContain('El rol está permitido · El tenant se resuelve y pertenece al actor');
    expect(resp.textContent).toContain('1 respuesta de éxito');
    expect(resp.textContent).toContain('2 respuestas de error');
    expect(seccion('portal-operation-callers')?.textContent).toContain('SchedulingClient');
    expect(seccion('portal-operation-callers')?.textContent).toContain('AgendaPage');
  });

  it('sin fila en el mapa, o con el mapa caído, «quién la llama» dice sin dato y la ficha sigue', async () => {
    await abrir('?vista=respuestas');
    responder('ok', 'sin-fila');
    expect(seccion('portal-operation-callers')?.textContent).toContain('Sin dato: el mapa de rutas no trae una fila');

    TestBed.resetTestingModule();
    await abrir('?vista=respuestas');
    responder('ok', 'error');
    expect(seccion('portal-operation-callers')?.textContent).toContain('Sin dato: no se pudo consultar el mapa de rutas');
    expect(texto()).toContain('Listar cupos');
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
