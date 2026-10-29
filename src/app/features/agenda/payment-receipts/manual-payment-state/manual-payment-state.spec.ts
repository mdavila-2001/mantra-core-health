import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type {
  NewPaymentState,
  PaymentStateInfo,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { ManualPaymentState } from './manual-payment-state';

const PARTIAL_WITH_INSURANCE: PaymentStateInfo = {
  state: 'PARTIALLY_PAID',
  label: 'Parcialmente pagada',
  conceptId: 'c-parcial',
  insuranceUsed: true,
  markedByUserId: 'u-1',
  markedAt: new Date('2026-10-27T10:00:00.000Z'),
};

describe('ManualPaymentState', () => {
  let fixture: ComponentFixture<ManualPaymentState>;
  let changes: NewPaymentState[];

  function render(current: PaymentStateInfo | null): HTMLElement {
    fixture = TestBed.createComponent(ManualPaymentState);
    fixture.componentRef.setInput('current', current);
    changes = [];
    fixture.componentInstance.changed.subscribe((change) => changes.push(change));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function button(root: HTMLElement, testid: string): HTMLButtonElement | null {
    return root.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
  }

  it('cambiar el estado conserva el seguro', () => {
    const root = render(PARTIAL_WITH_INSURANCE);

    button(root, 'payment-manual-PAID')!.click();

    expect(changes).toEqual([{ state: 'PAID', insuranceUsed: true }]);
  });

  it('alternar el seguro conserva el estado', () => {
    const root = render(PARTIAL_WITH_INSURANCE);

    button(root, 'payment-manual-insurance')!.click();

    expect(changes).toEqual([{ state: 'PARTIALLY_PAID', insuranceUsed: false }]);
  });

  it('el estado vigente no se vuelve a ofrecer, y sin estado no hay seguro que alternar', () => {
    const marked = render(PARTIAL_WITH_INSURANCE);
    expect(button(marked, 'payment-manual-PARTIALLY_PAID')?.getAttribute('aria-pressed')).toBe('true');

    const unmarked = render(null);
    expect(button(unmarked, 'payment-manual-insurance')).toBeNull();
    button(unmarked, 'payment-manual-PENDING')!.click();
    expect(changes).toEqual([{ state: 'PENDING', insuranceUsed: false }]);
  });
});
