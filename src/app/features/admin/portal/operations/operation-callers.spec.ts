import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { mapRow, operation, page } from '../portal.fixture';
import { OperationCallers } from './operation-callers';

describe('OperationCallers', () => {
  let fixture: ComponentFixture<OperationCallers>;
  let http: HttpTestingController;
  const op = operation({ id: 'SchedulingController_listSlots', ruta: '/scheduling/slots', modulo: 'scheduling', metodo: 'GET' });
  const MAP = '/admin/portal/flujos/mapa';

  function montar(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OperationCallers);
    fixture.componentRef.setInput('operation', op);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  function pedido() {
    return http.expectOne((r) => r.url === MAP);
  }
  function responder(items: ReturnType<typeof mapRow>[]): void {
    pedido().flush(page(items));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('pide el mapa acotado por ruta, módulo y método y no pide nada más', () => {
    montar();
    const req = pedido();
    expect(req.request.params.get('q')).toBe('/scheduling/slots');
    expect(req.request.params.get('modulo')).toBe('scheduling');
    expect(req.request.params.get('metodo')).toBe('GET');
    expect(req.request.params.get('limit')).toBe('200');
    req.flush(page([]));
  });

  it('mientras llega el mapa muestra la carga y no un vacío', () => {
    const el = montar();
    expect(el.querySelector('[data-testid="portal-operation-callers-list"]')).toBeNull();
    expect(el.textContent).not.toContain('Ningún cliente');
    pedido().flush(page([]));
  });

  it('muestra los clientes del front que la llaman, buscando la fila por id y no por ruta', () => {
    const el = montar();
    responder([
      mapRow({ id: 'SchedulingController_listSlotsOther', llamadaPor: ['OtroClient'] }),
      mapRow({ id: op.id, llamadaPor: ['SchedulingClient', 'AgendaFacade'] }),
    ]);
    const list = el.querySelector('[data-testid="portal-operation-callers-list"]')!;
    expect(list.textContent).toContain('SchedulingClient');
    expect(list.textContent).toContain('AgendaFacade');
    expect(list.textContent).not.toContain('OtroClient');
  });

  it('una ruta que ningún cliente llama lo dice y ofrece ver las que están así', () => {
    const el = montar();
    responder([mapRow({ id: op.id, llamadaPor: [] })]);
    expect(el.textContent).toContain('Ningún cliente del frontend la llama.');
    expect(el.textContent).toContain('Ver las rutas sin cliente');
  });

  it('«sin dato» no se presenta como «nadie la llama»', () => {
    const el = montar();
    responder([mapRow({ id: op.id, llamadaPor: null })]);
    expect(el.textContent).toContain('Sin dato');
    expect(el.textContent).not.toContain('Ningún cliente del frontend la llama.');
  });

  it('si el mapa no trae la operación lo dice con una salida', () => {
    const el = montar();
    responder([mapRow({ id: 'OtraController_x', llamadaPor: ['X'] })]);
    expect(el.textContent).toContain('El mapa de rutas no trae esta operación');
    expect(el.textContent).toContain('Ver el mapa del módulo');
  });

  it('sin permiso (403) no inventa datos y lo dice', () => {
    const el = montar();
    pedido().flush({ code: 'ROLE_INSUFFICIENT', message: 'No' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="portal-operation-callers-list"]')).toBeNull();
    expect(el.textContent).not.toContain('Ningún cliente');
    expect(el.querySelector('[role="alert"], [role="status"], app-empty-state, app-alert')).not.toBeNull();
  });

  it('un fallo del servidor se puede reintentar y el reintento vuelve a pedir el mapa', () => {
    const el = montar();
    pedido().flush({ code: 'INTERNAL', message: 'x', correlationId: 'c-1' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    const retry = [...el.querySelectorAll('button')].find((b) => /reintentar/i.test(b.textContent ?? ''));
    expect(retry).toBeDefined();
    retry!.click();
    responder([mapRow({ id: op.id, llamadaPor: ['SchedulingClient'] })]);
    expect(el.textContent).toContain('SchedulingClient');
  });
});
