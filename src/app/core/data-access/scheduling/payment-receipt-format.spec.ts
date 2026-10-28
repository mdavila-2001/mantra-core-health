import {
  describeReceipt,
  formatDayMonth,
  formatReceiptAmount,
  isPdfReceipt,
  PAYMENT_RECEIPT_STATUS_LABELS,
  PAYMENT_RECEIPT_STATUS_VARIANTS,
  receiptFileName,
} from './payment-receipt-format';

/** Mediodía UTC: el mismo día en cualquier zona horaria de ±10 h. */
const NOON_OCT_27 = new Date('2026-10-27T12:00:00.000Z');

describe('cómo se dice un comprobante de pago', () => {
  it('el monto va con coma decimal, dos decimales y la moneda visible', () => {
    expect(formatReceiptAmount('150.00')).toBe('150,00 Bs');
    expect(formatReceiptAmount('150.5')).toBe('150,50 Bs');
    expect(formatReceiptAmount('150')).toBe('150,00 Bs');
  });

  it('sin monto declarado no se inventa un cero', () => {
    expect(formatReceiptAmount(null)).toBeNull();
    expect(formatReceiptAmount('  ')).toBeNull();
  });

  it('el resumen nombra monto y día, y sin monto sólo el día', () => {
    expect(describeReceipt({ amount: '150.00', paidAt: NOON_OCT_27, uploadedAt: new Date() })).toBe(
      'comprobante de 150,00 Bs del 27/10',
    );
    expect(describeReceipt({ amount: null, paidAt: null, uploadedAt: NOON_OCT_27 })).toBe(
      'comprobante del 27/10',
    );
  });

  it('el día es día y mes, con dos cifras', () => {
    expect(formatDayMonth(new Date(2026, 2, 5, 12))).toBe('05/03');
  });

  it('las tres revisiones tienen palabra y tono, y los tres tonos son distintos', () => {
    expect(PAYMENT_RECEIPT_STATUS_LABELS).toEqual({
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmado',
      REJECTED: 'Rechazado',
    });
    expect(new Set(Object.values(PAYMENT_RECEIPT_STATUS_VARIANTS)).size).toBe(3);
  });

  it('el nombre de la descarga es el original, o uno con la extensión del formato', () => {
    expect(receiptFileName({ originalName: 'banco.pdf', mimeType: 'application/pdf' })).toBe('banco.pdf');
    expect(receiptFileName({ originalName: null, mimeType: 'image/jpeg' })).toBe('comprobante-de-pago.jpg');
  });

  it('reconoce el PDF por su tipo', () => {
    expect(isPdfReceipt({ mimeType: 'application/pdf' })).toBe(true);
    expect(isPdfReceipt({ mimeType: 'image/webp' })).toBe(false);
  });
});
