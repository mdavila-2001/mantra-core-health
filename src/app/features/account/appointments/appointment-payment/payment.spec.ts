import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import { BookingPaymentReceipts } from '../booking-payment-receipts/booking-payment-receipts';
import { AppointmentPaymentBadge, AppointmentReceiptUpload } from './payment';

/**
 * El pago de un turno en «Mis citas»: la insignia de estado (con el monto sólo
 * si se facturó) y el botón que abre la subida de comprobante, que se ofrece
 * sólo en un turno confirmado o con llegada y mientras no esté pagado.
 */

function estado(partial: Partial<PaymentStateInfo> = {}): PaymentStateInfo {
  return {
    state: 'PENDING',
    label: 'Pago pendiente',
    conceptId: 'c-1',
    insuranceUsed: false,
    markedByUserId: 'u-1',
    markedAt: new Date('2026-10-30T12:00:00Z'),
    ...partial,
  };
}

/** El panel real habla con la API; acá basta con saber qué recibe. */
@Component({ selector: 'app-booking-payment-receipts', template: 'panel', changeDetection: ChangeDetectionStrategy.OnPush })
class PanelDeComprobantes {
  readonly bookingId = input.required<string>();
  readonly statusCode = input('');
  readonly knownPaymentState = input<PaymentStateInfo | undefined>(undefined);
}

describe('AppointmentPaymentBadge', () => {
  let fixture: ComponentFixture<AppointmentPaymentBadge>;

  function pintar(paymentState: PaymentStateInfo | undefined): HTMLElement {
    fixture = TestBed.createComponent(AppointmentPaymentBadge);
    fixture.componentRef.setInput('paymentState', paymentState);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sin estado de pago no pinta nada', () => {
    expect(pintar(undefined).querySelector('[data-testid="appointment-payment-badge"]')).toBeNull();
  });

  it('pendiente: insignia de aviso con el rótulo de la API y sin monto', () => {
    const badge = pintar(estado()).querySelector('[data-testid="appointment-payment-badge"]');

    expect(badge?.textContent?.trim()).toBe('Pago pendiente');
    expect(badge?.classList.contains('badge--warning')).toBe(true);
    expect(badge?.textContent).not.toContain('·');
  });

  it('pagado y facturado: insignia de éxito con el monto cobrado en bolivianos', () => {
    const badge = pintar(estado({ state: 'PAID', label: 'Pagado', amountPaid: 150, currencyCode: 'BOB' })).querySelector(
      '[data-testid="appointment-payment-badge"]',
    );

    expect(badge?.classList.contains('badge--success')).toBe(true);
    expect(badge?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Pagado · 150,00 Bs');
  });

  it('un monto cero o no finito no se muestra', () => {
    for (const amountPaid of [0, Number.NaN]) {
      const texto = pintar(estado({ state: 'PAID', label: 'Pagado', amountPaid })).textContent ?? '';
      expect(texto).not.toContain('·');
    }
  });
});

describe('AppointmentReceiptUpload', () => {
  let fixture: ComponentFixture<AppointmentReceiptUpload>;

  beforeEach(() => {
    TestBed.overrideComponent(AppointmentReceiptUpload, {
      remove: { imports: [BookingPaymentReceipts] },
      add: { imports: [PanelDeComprobantes] },
    });
  });

  function pintar(statusCode: string, paymentState?: PaymentStateInfo): HTMLElement {
    fixture = TestBed.createComponent(AppointmentReceiptUpload);
    fixture.componentRef.setInput('bookingId', 'b-1');
    fixture.componentRef.setInput('statusCode', statusCode);
    fixture.componentRef.setInput('paymentState', paymentState);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each(['scheduling:BOOKING_CONFIRMED', 'BOOKING_CHECKED_IN'])('se ofrece en un turno %s sin pagar', (codigo) => {
    expect(pintar(codigo, estado()).querySelector('[data-testid="appointment-receipt-upload"]')).not.toBeNull();
  });

  it.each(['scheduling:BOOKING_PENDING', 'BOOKING_CANCELLED', ''])('no se ofrece en un turno %s', (codigo) => {
    expect(pintar(codigo).querySelector('[data-testid="appointment-receipt-upload"]')).toBeNull();
  });

  it('no se ofrece si el turno ya está pagado', () => {
    const root = pintar('BOOKING_CONFIRMED', estado({ state: 'PAID', label: 'Pagado' }));
    expect(root.querySelector('[data-testid="appointment-receipt-upload"]')).toBeNull();
  });

  it('el botón abre y cierra el panel, y lo anuncia con aria-expanded/aria-controls', () => {
    const root = pintar('BOOKING_CONFIRMED', estado());
    const boton = root.querySelector<HTMLElement>('[data-testid="appointment-receipt-upload-toggle"]')!;

    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('app-booking-payment-receipts')).toBeNull();

    boton.click();
    fixture.detectChanges();
    const panel = root.querySelector('app-booking-payment-receipts');
    expect(panel).not.toBeNull();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe(panel!.id);
    expect(boton.textContent).toContain('Ocultar el comprobante');

    boton.click();
    fixture.detectChanges();
    expect(root.querySelector('app-booking-payment-receipts')).toBeNull();
    expect(boton.textContent).toContain('Subir comprobante');
  });
});
