import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { OrderReferralClient } from '../../../core/data-access/diagnostics/order-referral.client';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { rowActionsOf } from './diagnostic-orders.actions';
import type { PatientOrderRow } from './diagnostic-orders.types';
import { OrderReferralLine } from './order-referral-line/order-referral-line';
import { ReferralResponse } from './referral-response';

const row = (extra: Partial<PatientOrderRow> = {}): PatientOrderRow =>
  ({ id: 'o-1', type: 'LAB', stateCode: 'ST-PENDING', hasResult: false, preparation: null, insuranceSettlement: null, appointment: null, bookable: true, referral: null, ...extra }) as PatientOrderRow;
const referral = (status: 'PENDING' | 'ACCEPTED' | 'REJECTED') => ({ status, performerName: 'Laboratorio Central', requestedByName: 'Dra. Quispe' });
const codes = (r: PatientOrderRow) => rowActionsOf(r).map((a) => a.code);

describe('rowActionsOf: QR and referral decisions', () => {
  it.each(['LAB', 'IMAGING'] as const)('an open %s order offers the QR', (type) => {
    expect(codes(row({ type }))).toContain('mostrar-qr');
  });

  it('a completed order, a procedure or «other» do not offer the QR (nobody gets it again)', () => {
    expect(codes(row({ stateCode: 'ST-COMPLETED' }))).not.toContain('mostrar-qr');
    expect(codes(row({ type: 'PROCEDURE' }))).not.toContain('mostrar-qr');
    expect(codes(row({ type: 'OTHER' }))).not.toContain('mostrar-qr');
  });

  it('a pending referral puts accept and reject first', () => {
    expect(codes(row({ referral: referral('PENDING') })).slice(0, 2)).toEqual(['aceptar-derivacion', 'rechazar-derivacion']);
  });

  it.each(['ACCEPTED', 'REJECTED'] as const)('a %s referral leaves nothing to decide', (status) => {
    expect(codes(row({ referral: referral(status) }))).not.toContain('aceptar-derivacion');
  });

  it('«Reservar hora» only when the row is bookable (no result, no appointment yet)', () => {
    expect(codes(row({ bookable: true }))).toContain('reservar');
    expect(codes(row({ bookable: false }))).not.toContain('reservar');
  });

  it('every action keeps a text label (never an icon alone)', () => {
    expect(rowActionsOf(row({ referral: referral('PENDING'), hasResult: true })).every((a) => a.label.length > 0)).toBe(true);
  });
});

describe('ReferralResponse', () => {
  const toasts = { success: vi.fn(), error: vi.fn() };
  let respondToReferral: ReturnType<typeof vi.fn>;
  const done = vi.fn();

  function service(): ReferralResponse {
    toasts.success.mockReset();
    toasts.error.mockReset();
    done.mockReset();
    TestBed.configureTestingModule({
      providers: [ReferralResponse, { provide: ToastService, useValue: toasts }, { provide: OrderReferralClient, useValue: { respondToReferral } }],
    });
    return TestBed.inject(ReferralResponse);
  }

  it('accepting says the center can now see the order, then reloads', () => {
    respondToReferral = vi.fn(() => of({ orderId: 'o-1', status: 'ACCEPTED', performerName: 'Laboratorio Central' }));
    service().respond('o-1', 'accept', done);
    expect(respondToReferral).toHaveBeenCalledExactlyOnceWith('o-1', 'accept');
    expect(toasts.success).toHaveBeenCalledWith('Aceptó la derivación. Laboratorio Central ya puede ver su orden.');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('rejecting says the center will not see it', () => {
    respondToReferral = vi.fn(() => of({ orderId: 'o-1', status: 'REJECTED', performerName: 'Laboratorio Central' }));
    service().respond('o-1', 'reject', done);
    expect(toasts.success).toHaveBeenCalledWith('Rechazó la derivación. El centro no verá su orden.');
  });

  it('a 409 shows the server message and still reloads, so the list shows what the server has', () => {
    respondToReferral = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409, error: { statusCode: 409, code: 'CONFLICT', message: 'Esa derivación ya está resuelta.' } })));
    const svc = service();
    svc.respond('o-1', 'accept', done);
    expect(toasts.error).toHaveBeenCalledWith('Esa derivación ya está resuelta.');
    expect(done).toHaveBeenCalledTimes(1);
    expect(svc.busy()).toBe(false);
  });
});

describe('OrderReferralLine', () => {
  function render(value: ReturnType<typeof referral> | null): string {
    const fixture = TestBed.createComponent(OrderReferralLine);
    fixture.componentRef.setInput('referral', value);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('says each state in words and shows nothing without a referral', () => {
    expect(render(referral('PENDING'))).toContain('Dra. Quispe la deriva a Laboratorio Central. Espera su aceptación.');
    expect(render(referral('ACCEPTED'))).toContain('Derivada a Laboratorio Central.');
    expect(render(referral('REJECTED'))).toContain('Rechazó la derivación a Laboratorio Central.');
    expect(render(null).trim()).toBe('');
  });
});
