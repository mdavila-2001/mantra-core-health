import { TestBed } from '@angular/core/testing';

import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { BookingPaymentStates } from './booking-payment-states';

function state(label: string, markedAt: string): PaymentStateInfo {
  return {
    state: label === 'Pagada' ? 'PAID' : 'PENDING',
    label,
    conceptId: `c-${label}`,
    insuranceUsed: false,
    markedByUserId: 'u-1',
    markedAt: new Date(markedAt),
  };
}

describe('BookingPaymentStates', () => {
  let states: BookingPaymentStates;

  beforeEach(() => {
    states = TestBed.inject(BookingPaymentStates);
  });

  it('sin nada anotado devuelve lo que trajo la cita, también si es `null`', () => {
    const read = state('Pendiente de pago', '2026-10-27T10:00:00.000Z');

    expect(states.resolve('b-1', read)).toBe(read);
    expect(states.resolve('b-1', null)).toBeNull();
  });

  it('lo anotado gana sobre una lectura más vieja', () => {
    const paid = state('Pagada', '2026-10-28T10:00:00.000Z');
    states.record('b-1', paid);

    expect(states.resolve('b-1', null)).toBe(paid);
    expect(states.resolve('b-1', state('Pendiente de pago', '2026-10-27T10:00:00.000Z'))).toBe(paid);
  });

  it('una lectura más nueva vuelve a mandar: otra persona lo cambió después', () => {
    states.record('b-1', state('Pagada', '2026-10-28T10:00:00.000Z'));
    const newer = state('Pendiente de pago', '2026-10-28T11:00:00.000Z');

    expect(states.resolve('b-1', newer)).toBe(newer);
  });

  it('lo anotado de una cita no toca a otra', () => {
    states.record('b-1', state('Pagada', '2026-10-28T10:00:00.000Z'));

    expect(states.resolve('b-2', null)).toBeNull();
  });
});
