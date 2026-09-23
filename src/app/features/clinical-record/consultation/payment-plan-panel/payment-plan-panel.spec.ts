import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PaymentPlanPanel } from './payment-plan-panel';

function isoEnDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
}

function item(id: string, status: string, validUntil = isoEnDias(20)) {
  return {
    id,
    patientProfileId: 'p-1',
    serviceNameSnapshot: 'Ortodoncia',
    offeredPrice: 890,
    status,
    attentionDate: isoEnDias(-10),
    validUntil,
  };
}

function detalle(id: string, status: string) {
  return {
    ...item(id, status),
    practiceId: 'pr1',
    serviceCatalogId: 's1',
    paymentPlanInstallmentCount: 3,
    downPaymentAmount: 190,
    paymentFrequency: 'MONTHLY',
    installments: [
      { installmentNumber: 1, dueDate: isoEnDias(-5), amount: 233.34 },
      { installmentNumber: 2, dueDate: isoEnDias(25), amount: 233.33 },
      { installmentNumber: 3, dueDate: isoEnDias(55), amount: 233.33 },
    ],
  };
}

describe('PaymentPlanPanel', () => {
  let fixture: ComponentFixture<PaymentPlanPanel>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentPlanPanel);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('sin plan que corresponda, no dibuja nada', () => {
    http
      .expectOne((r) => r.url === '/quotations' && r.params.get('patientProfileId') === 'p-1')
      .flush([item('q-vieja', 'EXPIRED', isoEnDias(-1)), item('q-rechazada', 'REJECTED')]);
    fixture.detectChanges();

    expect(texto().trim()).toBe('');
  });

  it('con un plan en curso lo muestra con su próxima cuota, sin interés', () => {
    http.expectOne((r) => r.url === '/quotations').flush([item('q1', 'ACCEPTED')]);
    http.expectOne((r) => r.url === '/quotations/q1').flush(detalle('q1', 'ACCEPTED'));
    fixture.detectChanges();

    expect(texto()).toContain('Plan de pago');
    expect(texto()).toContain('Ortodoncia');
    expect(texto()).toContain('En curso');
    expect(texto()).toContain('3 cuotas mensuales sin interés');
    expect(texto()).toContain('anticipo 190,00');
    const proxima = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="consulta-plan-proxima-cuota"]',
    );
    expect(proxima?.textContent).toContain('233,33');
    expect(texto()).not.toMatch(/tasa/i);
  });

  it('un propuesto vencido no corresponde; uno aceptado sí, aunque su oferta haya vencido', () => {
    http
      .expectOne((r) => r.url === '/quotations')
      .flush([item('q-prop', 'SENT', isoEnDias(-3)), item('q-ok', 'ACCEPTED', isoEnDias(-3))]);
    http.expectOne((r) => r.url === '/quotations/q-ok').flush(detalle('q-ok', 'ACCEPTED'));
    http.expectNone((r) => r.url === '/quotations/q-prop');
    fixture.detectChanges();

    expect(texto()).toContain('En curso');
  });

  it('si la lectura falla, lo dice y deja reintentar', () => {
    http.expectOne((r) => r.url === '/quotations').flush(null, { status: 500, statusText: 'x' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos revisar si esta persona tiene un plan de pago.');
  });
});
