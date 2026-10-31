import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import type { NewPaymentState } from '../../../../core/data-access/scheduling/scheduling.types';
import { ManualPaymentState } from './manual-payment-state';

const PAID: PaymentStateInfo = {
  state: 'PAID',
  label: 'Pagada',
  conceptId: 'c-pagada',
  insuranceUsed: false,
  markedByUserId: 'u-1',
  markedAt: new Date('2026-10-27T10:00:00.000Z'),
};
const PARTIAL: PaymentStateInfo = {
  ...PAID,
  state: 'PARTIALLY_PAID',
  label: 'Parcialmente pagada',
};
const PENDING: PaymentStateInfo = { ...PAID, state: 'PENDING', label: 'Pendiente de pago' };

describe('ManualPaymentState · monto recibido', () => {
  function render(
    current: PaymentStateInfo | null,
    bookingId = 'b-1',
  ): { fixture: ComponentFixture<ManualPaymentState>; root: HTMLElement } {
    const fixture = TestBed.createComponent(ManualPaymentState);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('bookingId', bookingId);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  const q = (root: HTMLElement, id: string) =>
    root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const saveButton = (root: HTMLElement) => q(root, 'payment-amount-save') as HTMLButtonElement;

  function type(fixture: ComponentFixture<ManualPaymentState>, root: HTMLElement, text: string) {
    const input = q(root, 'payment-amount-input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('solo se ofrece con «Pagada» o «Parcialmente pagada»', () => {
    expect(q(render(PAID).root, 'payment-amount')).not.toBeNull();
    expect(q(render(PARTIAL).root, 'payment-amount')).not.toBeNull();
    expect(q(render(PENDING).root, 'payment-amount')).toBeNull();
    expect(q(render(null).root, 'payment-amount')).toBeNull();
    expect(q(render(PAID, '').root, 'payment-amount')).toBeNull();
  });

  it('ya no avisa «solo en este equipo»: el monto viaja al servidor (FAC-01)', () => {
    const { root } = render(PAID);

    expect(q(root, 'payment-amount-notice')).toBeNull();
    expect(root.textContent).not.toContain('Guardado solo en este equipo');
  });

  it('vacío es válido pero no guarda; lo inválido muestra el error en el campo', () => {
    const { fixture, root } = render(PAID);
    expect(saveButton(root).getAttribute('aria-disabled')).toBe('true');
    expect(root.textContent).not.toContain('Escriba un monto');

    for (const bad of ['0', '-5', 'abc', '10.123']) {
      type(fixture, root, bad);
      expect(saveButton(root).getAttribute('aria-disabled')).toBe('true');
      const described = q(root, 'payment-amount-input')?.getAttribute('aria-describedby');
      expect(described).toBeTruthy();
      expect(root.querySelector(`#${described}`)?.textContent).toContain('Escriba un monto');
    }
  });

  it('registra el pago con coma o punto: sale con el estado vigente y el seguro', () => {
    const { fixture, root } = render({ ...PARTIAL, insuranceUsed: true });
    const emitted: NewPaymentState[] = [];
    fixture.componentInstance.changed.subscribe((change) => emitted.push(change));

    type(fixture, root, '150,5');
    saveButton(root).click();
    fixture.detectChanges();

    expect(emitted).toEqual([
      { state: 'PARTIALLY_PAID', insuranceUsed: true, amountReceived: 150.5 },
    ]);
    expect(localStorage.length).toBe(0);
  });

  it('lo escrito queda si la API rechaza, y se borra cuando llega el estado nuevo', () => {
    const { fixture, root } = render(PARTIAL);
    type(fixture, root, '20');
    saveButton(root).click();
    fixture.detectChanges();
    expect((q(root, 'payment-amount-input') as HTMLInputElement).value).toBe('20');

    fixture.componentRef.setInput('current', { ...PARTIAL, amountPaid: 20, currencyCode: 'BOB' });
    fixture.detectChanges();
    expect((q(root, 'payment-amount-input') as HTMLInputElement).value).toBe('');
  });

  it('«Recibido» es lo que dice la API; sin monto facturado no aparece', () => {
    expect(q(render(PAID).root, 'payment-amount-saved')).toBeNull();

    const { root } = render({ ...PAID, amountPaid: 150.5, currencyCode: 'BOB' });
    expect(q(root, 'payment-amount-saved')?.textContent).toContain('Recibido: 150,50 Bs');
    expect(root.textContent).toContain('Registrar otro pago (Bs)');
  });
});
