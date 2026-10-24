import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import type { SimulatedCharge, SimulatedInvoice } from '../../../core/data-access/billing-simulated/billing-simulated.types';
import type { FacturacionSimulada } from '../../../core/mock/billing-sim/facturacion-simulada';
import { motorDePrueba } from '../billing.spec-fixtures';
import { FacturaSimuladaDialog } from './factura-simulada-dialog';

/**
 * El modal de la factura contra el SIAT simulado. Lo que fijan estas pruebas:
 *
 * 1. **Una sola instancia sin pagar**: registra el pago y enseguida emite la
 *    factura, en ese orden, y muestra el CUF y la respuesta del SIAT.
 * 2. **Un plan saldado** se factura sin volver a cobrar: sólo el comprador.
 * 3. **Con factura vigente** abre mostrándola: no se factura dos veces.
 * 4. **Un rechazo del motor se muestra con su mensaje**, sin fingir éxito.
 */
describe('FacturaSimuladaDialog', () => {
  let fixture: ComponentFixture<FacturaSimuladaDialog>;
  let http: HttpTestingController;
  let motor: FacturacionSimulada;
  let emitidas: SimulatedInvoice[];

  function montar(cobro: SimulatedCharge): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FacturaSimuladaDialog);
    fixture.componentRef.setInput('cobro', cobro);
    fixture.componentRef.setInput('catalogos', motor.catalogos());
    emitidas = [];
    fixture.componentInstance.emitida.subscribe((f) => emitidas.push(f));
    fixture.detectChanges();
  }

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function confirmar(): void {
    const pager = el('factura-formulario')!;
    const next = pager.querySelector<HTMLButtonElement>('[data-testid="paginated-form-continuar"]');
    if (next !== null) {
      expect(pager.querySelectorAll('app-input, app-select').length).toBeLessThanOrEqual(4);
      next.click();
      fixture.detectChanges();
    }
    expect(pager.querySelectorAll('app-input, app-select').length).toBeLessThanOrEqual(4);
    const formulario = pager.querySelector('form')!;
    formulario.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function responderFactura(cobroId: string): SimulatedInvoice {
    const req = http.expectOne(`/billing/simulated/charges/${cobroId}/invoices`);
    expect(req.request.method).toBe('POST');
    const r = motor.emitirFactura(cobroId, req.request.body, 'prueba');
    if (!r.ok) throw new Error(r.error.message);
    req.flush(r.value);
    fixture.detectChanges();
    return r.value;
  }

  beforeEach(() => {
    motor = motorDePrueba();
  });

  afterEach(() => http.verify());

  it('sin pagar: registra el pago y después emite la factura, y muestra el CUF', () => {
    const cobro = motor.listarCobros().find((c) => c.plan === null && c.payment === null && c.source === 'CONSULTATION')!;
    montar(cobro);
    expect(el('factura-total')?.textContent).toContain(cobro.total.split('.')[0]!);

    // Sin medio de pago no sale nada.
    confirmar();
    http.expectNone((r) => r.url.includes('/billing/simulated/'));

    fixture.componentInstance['formulario'].controls.methodCode.setValue(1);
    confirmar();
    const pago = http.expectOne(`/billing/simulated/charges/${cobro.id}/payment`);
    expect(pago.request.body).toEqual({ methodCode: 1 });
    const pagado = motor.registrarPago(cobro.id, 1);
    if (!pagado.ok) throw new Error(pagado.error.message);
    pago.flush(pagado.value);

    const factura = responderFactura(cobro.id);
    expect(factura.status).toBe('VALIDATED');
    expect(emitidas).toHaveLength(1);
    expect(el('factura-cuf')?.textContent).toContain(factura.cuf);
    expect(el('factura-respuesta-siat')?.textContent).toContain('908');
  });

  it('un plan saldado se factura sin volver a cobrar, por el total del servicio', () => {
    const conPlan = motor.listarCobros().find((c) => c.plan !== null)!;
    for (const i of conPlan.plan!.instances.filter((x) => x.balance !== '0.00')) {
      motor.registrarPagoDeInstancia(conPlan.id, i.id, { methodCode: 1, amount: i.balance });
    }
    const saldado = motor.cobro(conPlan.id)!;
    montar(saldado);
    expect(el('factura-notas-del-plan')?.textContent).toContain('NV-');

    confirmar();
    http.expectNone(`/billing/simulated/charges/${saldado.id}/payment`);
    const factura = responderFactura(saldado.id);
    expect(factura.cabecera['montoTotal']).toBe(saldado.total);
    expect(factura.detalle).toHaveLength(saldado.plan!.instances.length);
  });

  it('con factura vigente abre mostrándola, sin ofrecer otra', () => {
    const pagado = motor.listarCobros().find((c) => c.plan === null && c.payment !== null && c.source === 'CONSULTATION')!;
    const emitida = motor.emitirFactura(
      pagado.id,
      { buyer: { name: 'X', documentTypeCode: 1, documentNumber: '1234567' } },
      'prueba',
    );
    if (!emitida.ok) throw new Error(emitida.error.message);
    montar(motor.cobro(pagado.id)!);

    http.expectOne(`/billing/simulated/invoices/${emitida.value.id}`).flush(emitida.value);
    fixture.detectChanges();
    expect(el('factura-emitida')).not.toBeNull();
    expect(el('factura-formulario')).toBeNull();
    expect(el('factura-confirmar')).toBeNull();
  });

  it('si el motor rechaza, muestra su mensaje y no finge la factura', () => {
    const pagado = motor.listarCobros().find((c) => c.plan === null && c.payment !== null && c.source === 'CONSULTATION')!;
    montar(pagado);
    confirmar();
    http
      .expectOne(`/billing/simulated/charges/${pagado.id}/invoices`)
      .flush(
        { code: 'PRECONDITION_FAILED', message: 'El cobro todavía no está pagado', timestamp: '', path: '' },
        { status: 412, statusText: 'Precondition Failed' },
      );
    fixture.detectChanges();

    expect(el('factura-error')?.textContent).toContain('El cobro todavía no está pagado');
    expect(el('factura-emitida')).toBeNull();
    expect(emitidas).toHaveLength(0);
  });

  it('si el pago pasa y la factura falla, el reintento sólo factura: no vuelve a cobrar', () => {
    const cobro = motor.listarCobros().find((c) => c.plan === null && c.payment === null && c.source === 'CONSULTATION')!;
    montar(cobro);
    fixture.componentInstance['formulario'].controls.methodCode.setValue(1);
    confirmar();
    const pagado = motor.registrarPago(cobro.id, 1);
    if (!pagado.ok) throw new Error(pagado.error.message);
    http.expectOne(`/billing/simulated/charges/${cobro.id}/payment`).flush(pagado.value);
    http
      .expectOne(`/billing/simulated/charges/${cobro.id}/invoices`)
      .flush({ code: 'INTERNAL_ERROR', message: 'Caída del simulador', timestamp: '', path: '' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el('factura-error')).not.toBeNull();

    confirmar();
    http.expectNone(`/billing/simulated/charges/${cobro.id}/payment`);
    responderFactura(cobro.id);
    expect(el('factura-emitida')).not.toBeNull();
  });

  it('un 409 «ya estaba pagado» no traba el modal: el reintento sólo factura', () => {
    const cobro = motor.listarCobros().find((c) => c.plan === null && c.payment === null && c.source === 'CONSULTATION')!;
    montar(cobro);
    fixture.componentInstance['formulario'].controls.methodCode.setValue(1);
    confirmar();
    motor.registrarPago(cobro.id, 2); // lo pagó otra persona mientras tanto
    http
      .expectOne(`/billing/simulated/charges/${cobro.id}/payment`)
      .flush(
        { code: 'CONFLICT', message: 'El cobro ya está pagado', details: { reason: 'ALREADY_PAID' }, timestamp: '', path: '' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    expect(el('factura-error')?.textContent).toContain('ya estaba pagado');

    confirmar();
    http.expectNone(`/billing/simulated/charges/${cobro.id}/payment`);
    responderFactura(cobro.id);
    expect(el('factura-emitida')).not.toBeNull();
  });
});
