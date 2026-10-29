import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { appointmentPaymentView } from './appointment-payment.view';

const PAID: PaymentStateInfo = {
  state: 'PAID',
  label: 'Pagada',
  conceptId: 'c-pagada',
  insuranceUsed: false,
  markedByUserId: 'u-medica',
  markedAt: new Date('2026-10-28T10:00:00.000Z'),
};

describe('appointmentPaymentView (H03)', () => {
  it('PAID: la etiqueta que manda la API, en tono de éxito', () => {
    expect(appointmentPaymentView(PAID)).toEqual({
      label: 'Pagada',
      tone: 'success',
      amountText: '',
    });
  });

  it('PARTIALLY_PAID y PENDING: aviso, con la etiqueta tal cual llega', () => {
    expect(
      appointmentPaymentView({ ...PAID, state: 'PARTIALLY_PAID', label: 'Pagada en parte' }),
    ).toMatchObject({ label: 'Pagada en parte', tone: 'warning' });
    expect(
      appointmentPaymentView({ ...PAID, state: 'PENDING', label: 'Etiqueta X' }),
    ).toMatchObject({
      label: 'Etiqueta X',
      tone: 'warning',
    });
  });

  it('sin paymentState no hay insignia: ausente no es «pendiente»', () => {
    expect(appointmentPaymentView(undefined)).toBeNull();
  });

  it('con amountPaid numérico suma «150,00 Bs»', () => {
    const view = appointmentPaymentView({
      ...PAID,
      amountPaid: 150,
      currencyCode: 'BOB',
    } as PaymentStateInfo);
    expect(view?.amountText).toBe('150,00 Bs');
  });

  it('sin monto, o con null, no dibuja ningún monto: nunca «0,00»', () => {
    expect(appointmentPaymentView(PAID)?.amountText).toBe('');
    const nulo = appointmentPaymentView({ ...PAID, amountPaid: null } as PaymentStateInfo);
    expect(nulo?.amountText).toBe('');
    expect(JSON.stringify(nulo)).not.toContain('0,00');
  });

  it('otra moneda: el número y su código', () => {
    const view = appointmentPaymentView({
      ...PAID,
      amountPaid: 20,
      currencyCode: 'USD',
    } as PaymentStateInfo);
    expect(view?.amountText).toBe('20,00 USD');
  });
});
