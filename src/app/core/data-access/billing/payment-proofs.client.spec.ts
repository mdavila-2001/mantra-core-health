import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../api';
import { PaymentProofsClient } from './payment-proofs.client';
import { formatMinor } from './payment-proofs.types';

/** Verbos, rutas y cuerpos del contrato C-01. */
describe('PaymentProofsClient', () => {
  let client: PaymentProofsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    client = TestBed.inject(PaymentProofsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el paciente lee su contexto de pago y sube el comprobante', () => {
    client.paymentContext('c 1').subscribe();
    const ctx = http.expectOne('/billing/me/charges/c%201/payment-context');
    expect(ctx.request.method).toBe('GET');
    ctx.flush({});

    client.createProof('c1', { method: 'QR_TRANSFER', fileId: 'f1', amountMinor: 15000 }).subscribe();
    const post = http.expectOne('/billing/me/charges/c1/payment-proofs');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ method: 'QR_TRANSFER', fileId: 'f1', amountMinor: 15000 });
    post.flush({ id: 'p1', status: 'PENDING_REVIEW' });
  });

  it('el médico lista, acepta y rechaza con motivo', () => {
    client.proofsOfCharge('c1').subscribe();
    expect(http.expectOne('/billing/charges/c1/payment-proofs').request.method).toBe('GET');

    client.accept('p1').subscribe();
    const aceptar = http.expectOne('/billing/payment-proofs/p1/accept');
    expect(aceptar.request.method).toBe('POST');
    aceptar.flush({});

    client.reject('p1', 'Monto ilegible').subscribe();
    const rechazar = http.expectOne('/billing/payment-proofs/p1/reject');
    expect(rechazar.request.body).toEqual({ reason: 'Monto ilegible' });
    rechazar.flush({});
  });

  it('la imagen del comprobante se pide como blob por la ruta de billing', () => {
    client.proofImage('p 1').subscribe();
    const req = http.expectOne('/billing/payment-proofs/p%201/file');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x'], { type: 'image/png' }));
  });

  it('la tabla del prestador manda sólo los filtros presentes', () => {
    client.providerPaymentTable({ patientProfileId: 'pp1', limit: 20, cursor: null }).subscribe();
    const req = http.expectOne((r) => r.url === '/billing/me/provider-payment-table');
    expect(req.request.params.get('patientProfileId')).toBe('pp1');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], nextCursor: null, totals: { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } });
  });

  it('formatea unidades menores en bolivianos', () => {
    expect(formatMinor(15000)).toBe('Bs 150,00');
    expect(formatMinor(123456789)).toBe('Bs 1.234.567,89');
    expect(formatMinor(5)).toBe('Bs 0,05');
  });
});
