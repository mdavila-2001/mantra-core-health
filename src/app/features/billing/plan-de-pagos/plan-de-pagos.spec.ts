import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import type { SimulatedCharge } from '../../../core/data-access/billing-simulated/billing-simulated.types';
import type { FacturacionSimulada } from '../../../core/mock/billing-sim/facturacion-simulada';
import { motorDePrueba } from '../billing.spec-fixtures';
import { PlanDePagos } from './plan-de-pagos';

/**
 * El plan de pagos de un servicio con reconsultas, contra el mismo motor que
 * atiende la maqueta. Lo que fijan estas pruebas:
 *
 * 1. **La tabla es la de la pizarra**: ítem, monto a cobrar, monto pagado y la
 *    nota de venta de cada pago.
 * 2. **Un pago va al endpoint de la instancia** con método y monto, y lo que
 *    se muestra después es lo que respondió el motor.
 * 3. **No se manda lo que va a volver con 422**: un monto mayor al saldo se
 *    dice antes y no sale ninguna petición.
 * 4. **Sin saldar no hay factura; saldado, sí.**
 */
describe('PlanDePagos', () => {
  let fixture: ComponentFixture<PlanDePagos>;
  let http: HttpTestingController;
  let motor: FacturacionSimulada;
  let cobro: SimulatedCharge;
  let actualizado: SimulatedCharge | null;
  let facturar: number;

  function montar(c: SimulatedCharge): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlanDePagos);
    fixture.componentRef.setInput('cobro', c);
    fixture.componentRef.setInput(
      'metodos',
      motor.catalogos().paymentMethods.map((m) => ({ value: m.codigo, label: m.descripcion })),
    );
    actualizado = null;
    facturar = 0;
    fixture.componentInstance.actualizado.subscribe((v) => (actualizado = v));
    fixture.componentInstance.facturar.subscribe(() => facturar++);
    fixture.detectChanges();
  }

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function botonDePago(etiqueta: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`button[aria-label="Registrar pago de ${etiqueta}"]`);
  }

  function escribirMonto(valor: string): void {
    const campo: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="plan-monto"]');
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    motor = motorDePrueba();
    // Un plan con la consulta pagada y las dos reconsultas con saldo.
    cobro = motor.listarCobros().find((c) => c.plan !== null && c.plan.instances[1]!.paidAmount === '0.00')!;
  });

  afterEach(() => http.verify());

  it('muestra cada instancia con lo esperado, lo pagado y su nota de venta', () => {
    montar(cobro);
    const texto = el('plan-tabla')!.textContent!;
    for (const instancia of cobro.plan!.instances) expect(texto).toContain(instancia.label);
    expect(texto).toContain(cobro.plan!.instances[0]!.salesNotes[0]!.number);
    expect(el('plan-saldo')?.textContent).not.toContain('Bs 0,00');
    // La consulta pagada no ofrece otro pago; las reconsultas, sí.
    expect(botonDePago('Consulta inicial')).toBeNull();
    expect(botonDePago('Reconsulta 1')).not.toBeNull();
  });

  it('registra el pago de una instancia en su endpoint y emite lo que respondió el motor', () => {
    montar(cobro);
    const reconsulta = cobro.plan!.instances[1]!;
    botonDePago('Reconsulta 1').click();
    fixture.detectChanges();
    escribirMonto('80.00');
    el('plan-confirmar-pago')!.click();
    fixture.detectChanges();

    const req = http.expectOne(`/billing/simulated/charges/${cobro.id}/instances/${reconsulta.id}/payments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ methodCode: 1, amount: '80.00' });
    const r = motor.registrarPagoDeInstancia(cobro.id, reconsulta.id, req.request.body);
    if (!r.ok) throw new Error(r.error.message);
    req.flush(r.value);
    fixture.detectChanges();

    expect(actualizado?.plan?.instances[1]?.paidAmount).toBe('80.00');
    expect(actualizado?.plan?.instances[1]?.salesNotes[0]?.number).toMatch(/^NV-\d{6}$/);
    expect(actualizado?.payment).toBeNull();
    expect(el('plan-formulario-de-pago')).toBeNull();
  });

  it('un monto mayor al saldo se dice antes, y no sale ninguna petición', () => {
    montar(cobro);
    botonDePago('Reconsulta 1').click();
    fixture.detectChanges();
    escribirMonto('999.00');
    el('plan-confirmar-pago')!.click();
    fixture.detectChanges();

    http.expectNone((r) => r.url.includes('/instances/'));
    expect(el('plan-formulario-de-pago')!.textContent).toContain('No puede superar el saldo');
  });

  it('con saldo no ofrece la factura; saldado, sí, y la pide al padre', () => {
    montar(cobro);
    expect(el('plan-generar-factura')).toBeNull();

    for (const instancia of cobro.plan!.instances.filter((i) => i.balance !== '0.00')) {
      motor.registrarPagoDeInstancia(cobro.id, instancia.id, { methodCode: 1, amount: instancia.balance });
    }
    fixture.componentRef.setInput('cobro', motor.cobro(cobro.id)!);
    fixture.detectChanges();

    expect(el('plan-saldado')).not.toBeNull();
    el('plan-generar-factura')!.click();
    expect(facturar).toBe(1);
  });
});
