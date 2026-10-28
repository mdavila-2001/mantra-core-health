import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PaymentReceiptsClient } from './payment-receipts.client';
import type { PaymentReceipt, PaymentReceiptConfirmation } from './payment-receipts.types';

const BOOKING = 'b-1';
const RECEIPTS_URL = `/scheduling/bookings/${BOOKING}/payment-receipts`;

/** Un comprobante como lo manda la API: instantes en texto, opcionales en `null`. */
const WIRE_RECEIPT = {
  id: 'r-1',
  bookingId: BOOKING,
  fileId: 'f-1',
  mimeType: 'image/png',
  originalName: 'transferencia.png',
  amount: '150.00',
  paidAt: '2026-10-27T14:00:00.000Z',
  note: 'Transferencia del banco',
  uploadedAt: '2026-10-27T15:00:00.000Z',
  uploadedBy: { userId: 'u-paciente', displayName: 'Ana Pérez' },
  status: 'PENDING',
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
} as const;

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

  it('list pide los comprobantes de la cita y convierte los instantes', () => {
    let received: readonly PaymentReceipt[] = [];
    client.list(BOOKING).subscribe((items) => (received = items));

    const req = http.expectOne(RECEIPTS_URL);
    expect(req.request.method).toBe('GET');
    req.flush([WIRE_RECEIPT]);

    expect(received).toHaveLength(1);
    expect(received[0]!.uploadedAt).toEqual(new Date(WIRE_RECEIPT.uploadedAt));
    expect(received[0]!.paidAt).toEqual(new Date(WIRE_RECEIPT.paidAt));
    // Lo nulo sigue nulo: la API lo declara presente, no ausente.
    expect(received[0]!.reviewedAt).toBeNull();
    expect(received[0]!.amount).toBe('150.00');
  });

  it('list los deja del más reciente al más viejo, venga como venga la respuesta', () => {
    let received: readonly PaymentReceipt[] = [];
    client.list(BOOKING).subscribe((items) => (received = items));

    http.expectOne(RECEIPTS_URL).flush([
      { ...WIRE_RECEIPT, id: 'r-medio', uploadedAt: '2026-10-27T15:00:00.000Z' },
      { ...WIRE_RECEIPT, id: 'r-viejo', uploadedAt: '2026-10-26T09:00:00.000Z' },
      { ...WIRE_RECEIPT, id: 'r-nuevo', uploadedAt: '2026-10-28T08:30:00.000Z' },
    ]);

    expect(received.map((receipt) => receipt.id)).toEqual(['r-nuevo', 'r-medio', 'r-viejo']);
  });

  it('upload manda sólo fileId cuando el paciente no completó nada más', () => {
    client.upload(BOOKING, { fileId: 'f-1' }).subscribe();

    const req = http.expectOne(RECEIPTS_URL);
    expect(req.request.method).toBe('POST');
    // `forbidNonWhitelisted`: un opcional vacío no puede viajar como clave.
    expect(req.request.body).toEqual({ fileId: 'f-1' });
    req.flush(WIRE_RECEIPT, { status: 201, statusText: 'Created' });
  });

  it('upload manda monto, fecha en ISO 8601 y nota cuando los hay', () => {
    const paidAt = new Date('2026-10-27T14:00:00.000Z');
    client
      .upload(BOOKING, { fileId: 'f-1', amount: '150.00', paidAt, note: 'Pagado por QR' })
      .subscribe();

    const req = http.expectOne(RECEIPTS_URL);
    expect(req.request.body).toEqual({
      fileId: 'f-1',
      amount: '150.00',
      paidAt: paidAt.toISOString(),
      note: 'Pagado por QR',
    });
    req.flush(WIRE_RECEIPT, { status: 201, statusText: 'Created' });
  });

  it('confirm devuelve el comprobante y el estado de pago de la cita', () => {
    let received: PaymentReceiptConfirmation | null = null;
    client.confirm(BOOKING, 'r-1').subscribe((value) => (received = value));

    const req = http.expectOne(`${RECEIPTS_URL}/r-1/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      receipt: { ...WIRE_RECEIPT, status: 'CONFIRMED', reviewedAt: '2026-10-28T10:00:00.000Z' },
      paymentState: {
        state: 'PAID',
        label: 'Pagada',
        conceptId: 'c-pagada',
        insuranceUsed: false,
        markedByUserId: 'u-medica',
        markedAt: '2026-10-28T10:00:00.000Z',
      },
    });

    const confirmation = received as PaymentReceiptConfirmation | null;
    expect(confirmation?.receipt.status).toBe('CONFIRMED');
    expect(confirmation?.receipt.reviewedAt).toEqual(new Date('2026-10-28T10:00:00.000Z'));
    expect(confirmation?.paymentState.state).toBe('PAID');
    expect(confirmation?.paymentState.markedAt).toBeInstanceOf(Date);
  });

  it('reject manda el motivo como `reason`', () => {
    client.reject(BOOKING, 'r-1', { reason: 'No se lee el monto' }).subscribe();

    const req = http.expectOne(`${RECEIPTS_URL}/r-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'No se lee el monto' });
    req.flush({ ...WIRE_RECEIPT, status: 'REJECTED', rejectionReason: 'No se lee el monto' });
  });

  it('content baja los bytes como Blob por la ruta de la cita', () => {
    let received: Blob | null = null;
    client.content(BOOKING, 'r-1').subscribe((blob) => (received = blob));

    const req = http.expectOne(`${RECEIPTS_URL}/r-1/content`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    expect((received as Blob | null)?.type).toBe('application/pdf');
  });

  it('escapa los identificadores en la ruta', () => {
    client.content('b/1', 'r?1').subscribe();

    const req = http.expectOne('/scheduling/bookings/b%2F1/payment-receipts/r%3F1/content');
    req.flush(new Blob([]));
  });
});
