import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import { PaymentReceiptRow } from './payment-receipt-row';

const RECEIPT: PaymentReceipt = {
  id: 'r-1',
  bookingId: 'b-1',
  fileId: 'f-1',
  mimeType: 'image/jpeg',
  originalName: 'foto.jpg',
  amount: '150.00',
  paidAt: new Date('2026-10-27T12:00:00.000Z'),
  note: null,
  uploadedAt: new Date('2026-10-27T13:00:00.000Z'),
  uploadedBy: { userId: 'u-paciente', displayName: 'Ana Pérez' },
  status: 'PENDING',
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
};

describe('PaymentReceiptRow', () => {
  let fixture: ComponentFixture<PaymentReceiptRow>;

  function render(receipt: PaymentReceipt, extra: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(PaymentReceiptRow);
    fixture.componentRef.setInput('receipt', receipt);
    for (const [key, value] of Object.entries(extra)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('una pendiente ofrece confirmar y rechazar, con su insignia', () => {
    const row = render(RECEIPT);

    expect(row.querySelector('[data-testid="payment-receipt-status"]')?.textContent?.trim()).toBe('Pendiente');
    expect(row.querySelector('[data-testid="payment-receipt-confirm"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="payment-receipt-reject"]')).not.toBeNull();
  });

  it('confirmada o rechazada ya no ofrece acciones, y dice quién y por qué', () => {
    const confirmed = render({
      ...RECEIPT,
      status: 'CONFIRMED',
      reviewedBy: { userId: 'u-medica', displayName: 'Dra. Rojas' },
      reviewedAt: new Date('2026-10-28T12:00:00.000Z'),
    });
    expect(confirmed.querySelector('[data-testid="payment-receipt-confirm"]')).toBeNull();
    expect(confirmed.textContent).toContain('Confirmado por');
    expect(confirmed.textContent).toContain('Dra. Rojas');

    const rejected = render({ ...RECEIPT, status: 'REJECTED', rejectionReason: 'No se lee el monto' });
    expect(rejected.querySelector('[data-testid="payment-receipt-reject"]')).toBeNull();
    expect(rejected.querySelector('[data-testid="payment-receipt-rejection-reason"]')?.textContent).toBe(
      'No se lee el monto',
    );
  });

  it('sin monto lo dice, sin fecha de pago también', () => {
    const row = render({ ...RECEIPT, amount: null, paidAt: null });

    expect(row.textContent).toContain('Sin monto declarado');
    expect(row.textContent).toContain('No la indicó');
  });

  it('mientras se escribe el motivo, la fila guarda sus botones', () => {
    const row = render(RECEIPT, { reviewable: false });

    expect(row.querySelector('[data-testid="payment-receipt-confirm"]')).toBeNull();
  });

  it('la miniatura de una imagen es su archivo; sin él, un esqueleto; un PDF, su ícono', () => {
    const ready = render(RECEIPT, { file: { status: 'ready', url: 'blob:foto' } });
    expect(ready.querySelector('img')?.getAttribute('src')).toBe('blob:foto');

    const loading = render(RECEIPT);
    expect(loading.querySelector('app-skeleton')).not.toBeNull();

    const pdf = render({ ...RECEIPT, mimeType: 'application/pdf' });
    expect(pdf.querySelector('[data-kind="pdf"]')?.textContent).toContain('PDF');
  });

  it('cada botón emite lo suyo', () => {
    render(RECEIPT);
    const emitted: string[] = [];
    fixture.componentInstance.viewRequested.subscribe(() => emitted.push('view'));
    fixture.componentInstance.confirmRequested.subscribe(() => emitted.push('confirm'));
    fixture.componentInstance.rejectRequested.subscribe(() => emitted.push('reject'));
    const row = fixture.nativeElement as HTMLElement;

    row.querySelector<HTMLElement>('[data-testid="payment-receipt-view"]')!.click();
    row.querySelector<HTMLElement>('[data-testid="payment-receipt-confirm"]')!.click();
    row.querySelector<HTMLElement>('[data-testid="payment-receipt-reject"]')!.click();

    expect(emitted).toEqual(['view', 'confirm', 'reject']);
  });
});
