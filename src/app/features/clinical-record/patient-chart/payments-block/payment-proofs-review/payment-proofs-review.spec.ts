import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { PaymentProof, ProviderPaymentRow } from '../../../../../core/data-access/billing/payment-proofs.types';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { PaymentProofsReview } from './payment-proofs-review';

const comprobante = (over: Partial<PaymentProof> = {}): PaymentProof => ({
  id: 'p1',
  chargeId: 'c1',
  patientProfileId: 'pp1',
  method: 'CASH',
  fileId: null,
  amountMinor: 15000,
  currency: 'BOB',
  status: 'PENDING_REVIEW',
  rejectionReason: null,
  reviewedAt: null,
  reviewedByUserId: null,
  createdAt: '2026-10-20T14:00:00.000Z',
  ...over,
});

const fila = (proof: PaymentProof | null): ProviderPaymentRow => ({
  chargeId: 'c1',
  startAt: '2026-10-20T13:00:00.000Z',
  patientProfileId: 'pp1',
  patientName: 'Ana',
  amountMinor: 15000,
  currency: 'BOB',
  patientAmountMinor: 15000,
  insurerAmountMinor: 0,
  coverageStatus: 'NO_COVERAGE',
  status: 'PENDING',
  proof,
  invoiced: false,
});

describe('PaymentProofsReview (C-01 · caja «Pagos»)', () => {
  let fixture: ComponentFixture<PaymentProofsReview>;
  let http: HttpTestingController;
  const dialogos = {
    confirm: vi.fn<() => Promise<boolean>>(),
    confirmWithReason: vi.fn<() => Promise<string | null>>(),
  };
  const avisos = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PaymentProofsReview],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DialogService, useValue: dialogos },
        { provide: ToastService, useValue: avisos },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentProofsReview);
    fixture.componentRef.setInput('patientProfileId', 'pp1');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const tabla = () => http.expectOne((r) => r.url.endsWith('/billing/me/provider-payment-table'));

  async function pintar(filas: ProviderPaymentRow[]): Promise<HTMLElement> {
    fixture.detectChanges();
    const req = tabla();
    expect(req.request.params.get('patientProfileId')).toBe('pp1');
    req.flush({ items: filas, nextCursor: null, totals: { sessions: filas.length, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } });
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('sin comprobantes: lo dice y explica qué va a aparecer', async () => {
    const raiz = await pintar([fila(null)]);
    expect(raiz.querySelector('[data-testid="comprobantes-vacio"]')).not.toBeNull();
  });

  it('aceptar: confirma, manda el POST una sola vez y recarga', async () => {
    const raiz = await pintar([fila(comprobante())]);
    dialogos.confirm.mockResolvedValue(true);
    raiz.querySelector<HTMLButtonElement>('[data-testid="comprobante-aceptar"]')!.click();
    await fixture.whenStable();
    const post = http.expectOne('/billing/payment-proofs/p1/accept');
    expect(post.request.method).toBe('POST');
    post.flush({ id: 'p1', status: 'ACCEPTED', chargeStatus: 'PAID' });
    tabla().flush({ items: [], nextCursor: null, totals: { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } });
    expect(avisos.success).toHaveBeenCalled();
  });

  it('rechazar exige motivo: si se cancela, no hay POST', async () => {
    const raiz = await pintar([fila(comprobante())]);
    dialogos.confirmWithReason.mockResolvedValue(null);
    raiz.querySelector<HTMLButtonElement>('[data-testid="comprobante-rechazar"]')!.click();
    await fixture.whenStable();
    http.expectNone('/billing/payment-proofs/p1/reject');
  });

  it('rechazar con motivo manda el motivo', async () => {
    const raiz = await pintar([fila(comprobante())]);
    dialogos.confirmWithReason.mockResolvedValue('Monto ilegible');
    raiz.querySelector<HTMLButtonElement>('[data-testid="comprobante-rechazar"]')!.click();
    await fixture.whenStable();
    const post = http.expectOne('/billing/payment-proofs/p1/reject');
    expect(post.request.body).toEqual({ reason: 'Monto ilegible' });
    post.flush({ id: 'p1', status: 'REJECTED', chargeStatus: 'PENDING' });
    tabla().flush({ items: [], nextCursor: null, totals: { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } });
  });

  it('carrera: si otro ya lo revisó (409 PROOF_NOT_PENDING), avisa y muestra el estado actual', async () => {
    const raiz = await pintar([fila(comprobante())]);
    dialogos.confirm.mockResolvedValue(true);
    raiz.querySelector<HTMLButtonElement>('[data-testid="comprobante-aceptar"]')!.click();
    await fixture.whenStable();
    http
      .expectOne('/billing/payment-proofs/p1/accept')
      .flush(
        { code: 'CONFLICT', message: 'ya revisado', details: { reason: 'PROOF_NOT_PENDING' }, timestamp: '', path: '' },
        { status: 409, statusText: 'Conflict' },
      );
    tabla().flush({ items: [], nextCursor: null, totals: { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } });
    expect(avisos.warning).toHaveBeenCalled();
  });

  it('la miniatura se pide por el comprobante (no por /common/files) y, si falla, dice «Sin imagen»', async () => {
    const raiz = await pintar([fila(comprobante({ method: 'QR_TRANSFER', fileId: 'f1' }))]);
    http.expectNone((r) => r.url.includes('/common/files'));
    http
      .expectOne('/billing/payment-proofs/p1/file')
      .flush(new Blob(['no'], { type: 'text/plain' }), { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Sin imagen');
    expect(raiz.querySelector('[data-testid="comprobante-aceptar"]')).not.toBeNull();
  });

  it('error accionable (S9): dice qué pasó, muestra el ID de petición y ofrece reintentar', async () => {
    fixture.detectChanges();
    tabla().flush(
      { code: 'INTERNAL_ERROR', message: 'x', correlationId: 'req-123', timestamp: '', path: '' },
      { status: 500, statusText: 'Error' },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="comprobantes-error"]')).not.toBeNull();
    expect(raiz.textContent).toContain('el resto de la consulta sigue funcionando');
    const reintentar = [...raiz.querySelectorAll('button')].find((b) => /reintentar/i.test(b.textContent ?? ''));
    reintentar!.click();
    tabla().flush({ items: [], nextCursor: null, totals: { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 } });
  });

  it('la miniatura abre la captura en grande', async () => {
    const raiz = await pintar([fila(comprobante({ method: 'QR_TRANSFER', fileId: 'f1' }))]);
    http.expectOne('/billing/payment-proofs/p1/file').flush(new Blob(['png'], { type: 'image/png' }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(raiz.querySelector('[data-testid="comprobante-ampliar"]')).not.toBeNull();
    });
    raiz.querySelector<HTMLButtonElement>('[data-testid="comprobante-ampliar"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Comprobante de pago');
  });

  it('un comprobante ya revisado no ofrece acciones y muestra el motivo', async () => {
    const raiz = await pintar([fila(comprobante({ status: 'REJECTED', rejectionReason: 'No coincide' }))]);
    expect(raiz.querySelector('[data-testid="comprobante-aceptar"]')).toBeNull();
    expect(raiz.textContent).toContain('Motivo: No coincide');
    expect(raiz.textContent).toContain('Rechazado');
  });
});
