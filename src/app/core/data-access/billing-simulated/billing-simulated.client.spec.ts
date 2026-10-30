import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../api';
import { BillingSimulatedClient } from './billing-simulated.client';

/** Verbos, rutas y cuerpos del contrato simulado (`billing-simulated.types.ts`). */
describe('BillingSimulatedClient', () => {
  let client: BillingSimulatedClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    client = TestBed.inject(BillingSimulatedClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee estado, catálogos, cobros, factura y bandeja con GET bajo /billing/simulated', () => {
    client.status().subscribe();
    client.catalogs().subscribe();
    client.charges().subscribe();
    client.invoice('f 1').subscribe();
    client.outbox().subscribe();
    for (const url of [
      '/billing/simulated/status',
      '/billing/simulated/catalogs',
      '/billing/simulated/charges',
      '/billing/simulated/invoices/f%201',
      '/billing/simulated/outbox',
    ]) {
      const req = http.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush({});
    }
  });

  it('lee los cobros de una persona con patientProfileId en la consulta', () => {
    client.chargesOfPatient('p 1').subscribe();
    const req = http.expectOne((r) => r.url === '/billing/simulated/charges');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('patientProfileId')).toBe('p 1');
    req.flush({ items: [], count: 0, simulated: true });
  });

  it('registra el pago de una instancia del plan con método y monto', () => {
    client.registerInstancePayment('c 1', 'i 2', { methodCode: 1, amount: '80.00' }).subscribe();
    const req = http.expectOne('/billing/simulated/charges/c%201/instances/i%202/payments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ methodCode: 1, amount: '80.00' });
    req.flush({});
  });

  it('registra el pago con el código de método', () => {
    client.registerPayment('c1', 3).subscribe();
    const req = http.expectOne('/billing/simulated/charges/c1/payment');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ methodCode: 3 });
    req.flush({});
  });

  it('emite la factura con comprador, descuento y directiva de simulación tal cual', () => {
    const input = {
      buyer: { name: 'Ana', documentTypeCode: 1, documentNumber: '123' },
      additionalDiscount: '5.00',
      simulation: { forceMessageCode: 1013 },
    };
    client.issueInvoice('c1', input).subscribe();
    const req = http.expectOne('/billing/simulated/charges/c1/invoices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({});
  });

  it('anula, revierte y encola el correo', () => {
    client.annul('f1', { reasonCode: 2 }).subscribe();
    client.revertAnnulment('f1').subscribe();
    client.emailInvoice('f1', 'a@b.test').subscribe();
    const anular = http.expectOne('/billing/simulated/invoices/f1/annulment');
    expect(anular.request.body).toEqual({ reasonCode: 2 });
    anular.flush({});
    http.expectOne('/billing/simulated/invoices/f1/annulment-reversal').flush({});
    const correo = http.expectOne('/billing/simulated/invoices/f1/email');
    expect(correo.request.body).toEqual({ to: 'a@b.test' });
    correo.flush({});
  });

  it('respeta la raíz de la API cuando está definida', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: 'https://api.ejemplo.test/' }],
    });
    const conRaiz = TestBed.inject(BillingSimulatedClient);
    const controlador = TestBed.inject(HttpTestingController);
    conRaiz.charges().subscribe();
    controlador.expectOne('https://api.ejemplo.test/billing/simulated/charges').flush({});
    controlador.verify();
  });
});
