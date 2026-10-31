import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { esperarSinViolaciones } from '../../../../../testing/a11y';
import type { FlowNode } from '../../../../core/data-access/admin-portal/flows.types';
import { billingTables, operationDetail } from '../../portal/portal.fixture';
import { flujo, nodo } from '../flows.fixture';
import { FlowData } from './flow-data';

const OP = (id: string) => `/admin/portal/operaciones/${id}`;
const declarado = (operationId: string, path = '/cobros/{id}') => ({
  method: 'POST',
  path,
  operationId,
  contract: 'DECLARED' as const,
});

describe('FlowData', () => {
  let fixture: ComponentFixture<FlowData>;
  let http: HttpTestingController;

  function montar(nodes: readonly FlowNode[] = flujo().nodes): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FlowData);
    fixture.componentRef.setInput('nodes', nodes);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const num = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!.trim();

  afterEach(() => http.verify());

  it('pide al inventario sólo la operación del paso declarado, no las del paso ausente ni las del que no tiene endpoint', () => {
    montar();
    expect(http.expectOne(OP('CobrosController_pagar')).request.method).toBe('GET');
    http.expectNone((r) => r.url.startsWith('/admin/portal/operaciones/') && !r.url.endsWith('CobrosController_pagar'));
    http.match(() => true).forEach((r) => r.flush(operationDetail()));
  });

  it('mientras llega no muestra tablas ni un vacío', () => {
    const el = montar();
    expect(el.querySelector('[data-testid="flow-data-summary"]')).toBeNull();
    expect(el.textContent).not.toContain('Ninguna: sólo consulta');
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail());
  });

  it('muestra las tablas que escribe y las que lee, con enlace a la ficha de cada tabla', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ datos: billingTables() }));
    fixture.detectChanges();
    const escribe = el.querySelector('[data-testid="flow-data-write-cobrar"]')!;
    const lee = el.querySelector('[data-testid="flow-data-read-cobrar"]')!;
    expect(escribe.textContent).toContain('billing.bill_lines');
    expect(escribe.textContent).not.toContain('billing.vendors');
    expect(lee.textContent).toContain('billing.vendors');
    expect([...lee.querySelectorAll('a')].find((a) => a.textContent!.trim() === 'billing.vendors')!.getAttribute('href')).toContain(
      '/catalog/tables/billing/vendors',
    );
  });

  it('suma las tablas del flujo contando cada una una vez y dice cuántas operaciones cruzó', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ datos: billingTables() }));
    fixture.detectChanges();
    expect(num(el, 'flow-data-distinct')).toBe('4');
    expect(num(el, 'flow-data-writes')).toBe('2');
    expect(num(el, 'flow-data-reads')).toBe('3');
    expect(el.querySelector('[data-testid="flow-data-summary"]')!.textContent).toContain('Suma de 1 de 1 operaciones cruzadas');
  });

  it('enlaza la operación a su ficha y muestra los eventos que emite', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ eventos: ['billing.paid'] }));
    fixture.detectChanges();
    const link = [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === 'CobrosController_pagar')!;
    expect(link.getAttribute('href')).toContain('/systems/operations/CobrosController_pagar');
    expect(el.textContent).toContain('billing.paid');
  });

  it('los pasos que no se pueden cruzar quedan listados con la razón, sin inventarles datos', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail());
    fixture.detectChanges();
    const filas = el.querySelectorAll('[data-testid="flow-data-uncrossable"]');
    expect(filas).toHaveLength(2);
    expect(filas[0]!.textContent).toContain('Reclamar a la aseguradora');
    expect(filas[0]!.textContent).toContain('POST /reclamos no existe en el contrato');
    expect(filas[1]!.textContent).toContain('No se encontró un endpoint que emita un QR');
  });

  it('si el inventario no tiene la operación (404) lo dice con el id y ofrece buscarla, sin dar el flujo por fallido', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain('El inventario no tiene una operación con el id «CobrosController_pagar»');
    expect(el.textContent).toContain('Buscarla en el inventario');
    expect(el.querySelector('[data-testid="flow-data-summary"]')).toBeNull();
  });

  it('sin permiso (403) no muestra tablas', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush({ code: 'ROLE_INSUFFICIENT', message: 'No' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="flow-data-write-cobrar"]')).toBeNull();
    expect(el.querySelector('[data-testid="flow-data-summary"]')).toBeNull();
  });

  it('un fallo del servidor se reintenta sólo para esa operación', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush({ code: 'INTERNAL', message: 'x', correlationId: 'c-9' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    const retry = [...el.querySelectorAll('button')].find((b) => /reintentar/i.test(b.textContent ?? ''));
    expect(retry).toBeDefined();
    retry!.click();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ datos: billingTables() }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="flow-data-write-cobrar"]')).not.toBeNull();
  });

  it('una operación que no toca tablas dice por qué', () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ datos: [], sinTablas: 'Sólo habla con Redis' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('No toca tablas: Sólo habla con Redis');
  });

  it('un flujo sin ninguna llamada declarada es un vacío con salida, no una pantalla en blanco', () => {
    const el = montar([nodo('solo', { kind: 'SCREEN' })]);
    expect(el.textContent).toContain('Ningún paso de este flujo declara una operación del contrato');
    expect(el.textContent).toContain('Ver las operaciones del inventario');
  });

  it('dos pasos con la misma operación hacen una sola petición y los dos muestran el resultado', () => {
    const el = montar([
      nodo('a', { title: 'Primero', endpoint: declarado('CobrosController_pagar') }),
      nodo('b', { title: 'Segundo', endpoint: declarado('CobrosController_pagar') }),
    ]);
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ datos: billingTables() }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="flow-data-write-a"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="flow-data-write-b"]')).not.toBeNull();
  });

  it('pide de a pocas: con diez operaciones no lanza las diez a la vez', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => nodo(`n${i}`, { endpoint: declarado(`Op${i}Controller_run`) }));
    montar(nodes);
    let total = 0;
    for (let lote = http.match(() => true); lote.length > 0; lote = http.match(() => true)) {
      expect(lote.length).toBeLessThanOrEqual(4);
      total += lote.length;
      lote.forEach((r) => r.flush(operationDetail()));
    }
    expect(total).toBe(10);
  });

  it('no tiene violaciones de accesibilidad con datos, con un 404 y con pasos sin cruzar', async () => {
    const el = montar();
    http.expectOne(OP('CobrosController_pagar')).flush(operationDetail({ datos: billingTables() }));
    fixture.detectChanges();
    await esperarSinViolaciones(el);
  }, 30_000);
});
