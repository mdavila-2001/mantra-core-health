import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { API_BASE_URL } from '../../../../../core/data-access/api';
import type { SimulatedCharge } from '../../../../../core/data-access/billing-simulated/billing-simulated.types';
import type { FacturacionSimulada } from '../../../../../core/mock/billing-sim/facturacion-simulada';
import { motorDePrueba } from '../../../../billing/billing.spec-fixtures';
import { bs, centavos, cobradoDeCobro, deCentavos, saldoDeCobro } from '../../../../billing/cobros-en-pantalla';
import { CobrosDelPaciente } from './cobros-del-paciente';

/**
 * «Pagos» con la facturación simulada, contra respuestas del mismo motor que
 * atiende la maqueta. Lo que fijan estas pruebas:
 *
 * 1. **Se leen sólo los cobros de esta persona** (`?patientProfileId=`).
 * 2. **El tipo de servicio decide qué se abre**: con reconsultas, la tabla del
 *    plan; de una sola instancia, directamente el modal de la factura.
 * 3. **Las cifras suman en centavos** lo pagado —notas de venta incluidas— y
 *    el saldo.
 * 4. **«No podés» no es «no hay nada»**: un 403 no se disfraza de vacío.
 */
describe('CobrosDelPaciente', () => {
  let fixture: ComponentFixture<CobrosDelPaciente>;
  let http: HttpTestingController;
  let motor: FacturacionSimulada;

  function montar(patientProfileId: string): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CobrosDelPaciente);
    fixture.componentRef.setInput('patientProfileId', patientProfileId);
    fixture.detectChanges();
  }

  function responder(patientProfileId: string): readonly SimulatedCharge[] {
    const suyos = motor.listarCobros().filter((c) => c.patientProfileId === patientProfileId);
    const lectura = http.expectOne((r) => r.url === '/billing/simulated/charges');
    expect(lectura.request.params.get('patientProfileId')).toBe(patientProfileId);
    lectura.flush({ items: suyos, count: suyos.length, simulated: true });
    http.expectOne('/billing/simulated/catalogs').flush(motor.catalogos());
    http.expectOne('/billing/simulated/status').flush(motor.estadoFiscal());
    fixture.detectChanges();
    return suyos;
  }

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function botonDe(cobro: SimulatedCharge): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-cobro-id="${cobro.id}"]`);
  }

  beforeEach(() => {
    motor = motorDePrueba();
  });

  afterEach(() => http.verify());

  it('lista los servicios de la persona con lo esperado y lo pagado, y suma en centavos', () => {
    const conPlan = motor.listarCobros().find((c) => c.plan !== null)!;
    montar(conPlan.patientProfileId);
    const suyos = responder(conPlan.patientProfileId);

    expect(fixture.nativeElement.querySelectorAll('[data-cobro-id]').length).toBe(suyos.length);
    const suma = (f: (c: SimulatedCharge) => string) => bs(deCentavos(suyos.reduce((s, c) => s + centavos(f(c)), 0)));
    expect(el('cobros-pagado')?.textContent?.trim()).toBe(suma(cobradoDeCobro));
    expect(el('cobros-saldo')?.textContent?.trim()).toBe(suma(saldoDeCobro));
    // El plan sembrado tiene saldo: el total por cobrar no puede ser cero.
    expect(el('cobros-saldo')?.textContent).not.toContain('Bs 0,00');
  });

  it('un servicio con reconsultas abre la tabla del plan, no el modal de la factura', () => {
    const conPlan = motor.listarCobros().find((c) => c.plan !== null)!;
    montar(conPlan.patientProfileId);
    responder(conPlan.patientProfileId);

    expect(botonDe(conPlan).textContent).toContain('Ver plan de pagos');
    botonDe(conPlan).click();
    fixture.detectChanges();

    expect(el('plan-de-pagos')).not.toBeNull();
    expect(el('factura-simulada')).toBeNull();
    expect(el('cobros-tabla')).toBeNull();
  });

  it('un servicio de una sola instancia abre directamente el modal de la factura', () => {
    const unico = motor.listarCobros().find((c) => c.plan === null && c.source === 'CONSULTATION' && c.payment === null)!;
    montar(unico.patientProfileId);
    responder(unico.patientProfileId);

    expect(botonDe(unico).textContent).toContain('Cobrar y facturar');
    botonDe(unico).click();
    fixture.detectChanges();

    expect(el('factura-simulada')).not.toBeNull();
    expect(el('plan-de-pagos')).toBeNull();
  });

  it('volver del plan devuelve la lista', () => {
    const conPlan = motor.listarCobros().find((c) => c.plan !== null)!;
    montar(conPlan.patientProfileId);
    responder(conPlan.patientProfileId);
    botonDe(conPlan).click();
    fixture.detectChanges();

    el('cobros-volver')!.click();
    fixture.detectChanges();
    expect(el('cobros-tabla')).not.toBeNull();
  });

  it('sin cobros lo dice con la próxima acción, y no inventa cifras', () => {
    montar('persona-sin-cobros');
    responder('persona-sin-cobros');

    expect(el('cobros-vacio')?.textContent).toContain('Aparecen acá cuando se atiende una cita');
    expect(el('cobros-cifras')).toBeNull();
  });

  it('un 403 dice que no se puede operar, no que no hay cobros', () => {
    montar('p-1');
    http
      .expectOne((r) => r.url === '/billing/simulated/charges')
      .flush({ code: 'FORBIDDEN', message: 'Tu rol no permite operar la facturación' }, { status: 403, statusText: 'Forbidden' });
    // `forkJoin` cancela las otras dos lecturas al primer error: sólo se
    // responde lo que siga abierto.
    for (const r of http.match((req) => req.url.startsWith('/billing/simulated/'))) {
      if (!r.cancelled) r.flush(r.request.url.endsWith('/catalogs') ? motor.catalogos() : motor.estadoFiscal());
    }
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No podés operar los cobros');
    expect(el('cobros-vacio')).toBeNull();
  });
});
