import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import { ReceivedAmountStore } from '../received-amount-store';
import { ManualPaymentState } from './manual-payment-state';

const PAID: PaymentStateInfo = {
  state: 'PAID',
  label: 'Pagada',
  conceptId: 'c-pagada',
  insuranceUsed: false,
  markedByUserId: 'u-1',
  markedAt: new Date('2026-10-27T10:00:00.000Z'),
};
const PARTIAL: PaymentStateInfo = { ...PAID, state: 'PARTIALLY_PAID', label: 'Parcialmente pagada' };
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

  it('el aviso de «solo en este equipo» está junto al campo', () => {
    const { root } = render(PAID);

    expect(q(root, 'payment-amount-notice')?.textContent).toContain(
      'Guardado solo en este equipo: todavía no se envía al servidor.',
    );
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

  it('guarda con coma o punto, muestra «Recibido» y permite cambiarlo', () => {
    const { fixture, root } = render(PAID);

    type(fixture, root, '150,5');
    saveButton(root).click();
    fixture.detectChanges();

    expect(TestBed.inject(ReceivedAmountStore).get('b-1')?.amount).toBe(150.5);
    expect(q(root, 'payment-amount-saved')?.textContent).toContain('Recibido: Bs 150,50');
    expect(q(root, 'payment-amount-notice')).not.toBeNull();

    (q(root, 'payment-amount-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((q(root, 'payment-amount-input') as HTMLInputElement).value).toBe('150.5');
  });

  it('si el navegador no deja guardar, lo dice en el campo', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('lleno');
    });
    const { fixture, root } = render(PAID);

    type(fixture, root, '20');
    saveButton(root).click();
    fixture.detectChanges();

    expect(root.textContent).toContain('No se pudo guardar en este navegador.');
  });
});
