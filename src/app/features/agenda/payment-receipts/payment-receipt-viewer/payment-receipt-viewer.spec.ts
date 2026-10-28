import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import type { ReceiptFileState } from '../receipt-files';
import { PaymentReceiptViewer } from './payment-receipt-viewer';

const IMAGE: PaymentReceipt = {
  id: 'r-1',
  bookingId: 'b-1',
  fileId: 'f-1',
  mimeType: 'image/png',
  originalName: null,
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

describe('PaymentReceiptViewer', () => {
  let fixture: ComponentFixture<PaymentReceiptViewer>;

  function render(receipt: PaymentReceipt, file: ReceiptFileState | undefined): HTMLElement {
    fixture = TestBed.createComponent(PaymentReceiptViewer);
    fixture.componentRef.setInput('receipt', receipt);
    fixture.componentRef.setInput('file', file);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('una imagen se ve entera, con texto alternativo, y se descarga con nombre de reserva', () => {
    const root = render(IMAGE, { status: 'ready', url: 'blob:foto', previewable: true });

    const image = root.querySelector('img');
    expect(image?.getAttribute('src')).toBe('blob:foto');
    expect(image?.getAttribute('alt')).toBe('Comprobante de 150,00 Bs del 27/10');
    expect(root.querySelector('[data-testid="payment-receipt-download"]')?.getAttribute('download')).toBe(
      'comprobante-de-pago.png',
    );
  });

  it('un PDF se ve en un marco y avisa que se puede descargar', () => {
    const root = render(
      { ...IMAGE, mimeType: 'application/pdf' },
      { status: 'ready', url: 'blob:pdf', previewable: true },
    );

    expect(root.querySelector('iframe')).not.toBeNull();
    // Sin `sandbox`: con él, el visor de PDF de Chrome no dibuja nada.
    expect(root.querySelector('iframe')?.hasAttribute('sandbox')).toBe(false);
    expect(root.textContent).toContain('use «Descargar»');
  });

  it('sólo acepta una URL de objeto: con cualquier otra no dibuja nada', () => {
    for (const receipt of [IMAGE, { ...IMAGE, mimeType: 'application/pdf' }]) {
      const root = render(receipt, {
        status: 'ready',
        url: 'https://otro.sitio/comprobante',
        previewable: true,
      });

      expect(root.querySelector('iframe')).toBeNull();
      expect(root.querySelector('img')).toBeNull();
      expect(root.querySelector('[data-testid="payment-receipt-download"]')).toBeNull();
      expect(root.querySelector('[data-testid="payment-receipt-unpreviewable"]')).toBeNull();
    }
  });

  it('un formato que no se muestra no tiene vista previa: ofrece sólo «Descargar»', () => {
    const root = render(
      { ...IMAGE, mimeType: 'text/html', originalName: 'comprobante.html' },
      { status: 'ready', url: 'blob:otro', previewable: false },
    );

    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-testid="payment-receipt-download"]')?.getAttribute('href')).toBe('blob:otro');
    expect(root.querySelector('[data-testid="payment-receipt-unpreviewable"]')?.textContent).toContain(
      'Use «Descargar»',
    );
  });

  it('mientras baja no hay descarga que ofrecer; si falla, ofrece reintentar', () => {
    const loading = render(IMAGE, { status: 'loading' });
    expect(loading.querySelector('[data-testid="payment-receipt-download"]')).toBeNull();
    expect(loading.textContent).toContain('Abriendo el comprobante');

    const failed = render(IMAGE, { status: 'failed' });
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => (retried += 1));
    const retry = [...failed.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));
    retry?.click();
    expect(retried).toBe(1);
  });

  it('al abrirse lleva el foco a su título', async () => {
    fixture = TestBed.createComponent(PaymentReceiptViewer);
    // Sólo un elemento del documento puede recibir el foco.
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.componentRef.setInput('receipt', IMAGE);
    fixture.componentRef.setInput('file', { status: 'loading' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('h3'));
    (fixture.nativeElement as HTMLElement).remove();
  });
});
