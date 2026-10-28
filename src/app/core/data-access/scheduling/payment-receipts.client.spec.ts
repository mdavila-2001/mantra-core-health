import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PaymentReceiptsClient } from './payment-receipts.client';

const LISTA = '/scheduling/bookings/bk-1/payment-receipts';

/** Un comprobante tal como lo manda la API, con sus `null`. */
const WIRE = {
  id: 'rc-1',
  bookingId: 'bk-1',
  fileId: 'f-1',
  mimeType: 'image/png',
  originalName: null,
  amount: '150.00',
  paidAt: null,
  note: null,
  uploadedAt: '2026-10-27T14:00:00.000Z',
  uploadedBy: { userId: 'u-1', displayName: 'Ana Pérez' },
  status: 'PENDING',
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
};

describe('PaymentReceiptsClient', () => {
  let client: PaymentReceiptsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PaymentReceiptsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sube sólo los campos que trae, con la fecha en ISO', () => {
    const paidAt = new Date('2026-10-27T13:00:00.000Z');
    client.upload('bk-1', { fileId: 'f-1', paidAt }).subscribe();

    const req = http.expectOne(LISTA);
    expect(req.request.method).toBe('POST');
    // Un opcional ausente no viaja: `forbidNonWhitelisted` lo rechaza.
    expect(req.request.body).toEqual({ fileId: 'f-1', paidAt: paidAt.toISOString() });
    req.flush(WIRE);
  });

  it('lee la lista con fechas y sin los null del contrato', () => {
    let leidos: unknown;
    client.list('bk-1').subscribe((items) => (leidos = items));

    http.expectOne(LISTA).flush([
      {
        ...WIRE,
        status: 'REJECTED',
        reviewedAt: '2026-10-27T15:00:00.000Z',
        rejectionReason: 'Ilegible',
      },
    ]);

    const [comprobante] = leidos as readonly Record<string, unknown>[];
    expect(comprobante!['uploadedAt']).toEqual(new Date(WIRE.uploadedAt));
    expect(comprobante!['reviewedAt']).toEqual(new Date('2026-10-27T15:00:00.000Z'));
    expect(comprobante!['rejectionReason']).toBe('Ilegible');
    expect('originalName' in comprobante!).toBe(false);
    expect('paidAt' in comprobante!).toBe(false);
    expect('reviewedBy' in comprobante!).toBe(false);
  });

  it('baja el archivo por la ruta de la cita, como blob', () => {
    client.content('bk-1', 'rc-1').subscribe();

    const req = http.expectOne(`${LISTA}/rc-1/content`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x'], { type: 'image/png' }));
  });

  it('confirma y devuelve el pago de la cita con su fecha', () => {
    let pago: unknown;
    client.confirm('bk-1', 'rc-1').subscribe((r) => (pago = r.paymentState));

    const req = http.expectOne(`${LISTA}/rc-1/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      receipt: { ...WIRE, status: 'CONFIRMED' },
      paymentState: {
        state: 'PAID',
        label: 'Pagada',
        conceptId: 'c-1',
        insuranceUsed: false,
        markedByUserId: 'u-2',
        markedAt: '2026-10-27T15:00:00.000Z',
      },
    });

    expect((pago as { markedAt: Date }).markedAt).toEqual(new Date('2026-10-27T15:00:00.000Z'));
  });

  it('rechaza mandando el motivo', () => {
    client.reject('bk-1', 'rc-1', 'No se lee el monto').subscribe();

    const req = http.expectOne(`${LISTA}/rc-1/reject`);
    expect(req.request.body).toEqual({ reason: 'No se lee el monto' });
    req.flush({ ...WIRE, status: 'REJECTED', rejectionReason: 'No se lee el monto' });
  });
});
