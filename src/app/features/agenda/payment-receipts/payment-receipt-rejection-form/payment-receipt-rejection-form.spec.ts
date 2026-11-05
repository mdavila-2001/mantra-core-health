import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PaymentReceiptRejectionForm } from './payment-receipt-rejection-form';

/**
 * El motivo con que se rechaza un comprobante de pago. Lo lee el paciente para
 * saber qué volver a subir, así que es obligatorio (3 a 500 caracteres, sin
 * contar espacios de los bordes) y se envía recortado.
 */
describe('PaymentReceiptRejectionForm', () => {
  let fixture: ComponentFixture<PaymentReceiptRejectionForm>;
  let enviados: string[];
  let cancelados: number;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const area = (): HTMLTextAreaElement => root().querySelector('textarea')!;
  const boton = (id: string): HTMLButtonElement =>
    root().querySelector<HTMLButtonElement>(`[data-testid="payment-receipt-rejection-${id}"]`)!;

  async function pintar(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(PaymentReceiptRejectionForm);
    fixture.componentRef.setInput('receiptLabel', 'el comprobante del 27/10');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    enviados = [];
    cancelados = 0;
    fixture.componentInstance.submitted.subscribe((m) => enviados.push(m));
    fixture.componentInstance.cancelled.subscribe(() => (cancelados += 1));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(texto: string): Promise<void> {
    area().value = texto;
    area().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function enviar(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('se anuncia con el comprobante que rechaza', async () => {
    await pintar();
    expect(root().querySelector('form')?.getAttribute('aria-label')).toBe('Rechazar el comprobante del 27/10');
  });

  it('sin motivo no deja enviar; al intentarlo explica por qué', async () => {
    await pintar();
    expect(boton('submit').getAttribute('aria-disabled')).toBe('true');

    await enviar();
    expect(enviados).toEqual([]);
    expect(root().textContent).toContain('al menos 3 caracteres');
  });

  it('los espacios no cuentan: «  a  » sigue siendo corto', async () => {
    await pintar();
    await escribir('  ab  ');
    expect(boton('submit').getAttribute('aria-disabled')).toBe('true');
  });

  it('con motivo válido emite el texto recortado', async () => {
    await pintar();
    await escribir('   No se lee el monto   ');
    expect(boton('submit').getAttribute('aria-disabled')).toBe('false');

    await enviar();
    expect(enviados).toEqual(['No se lee el monto']);
  });

  it('bloqueado o enviando, no emite aunque el motivo sea válido', async () => {
    for (const inputs of [{ blocked: true }, { submitting: true }]) {
      await pintar(inputs);
      fixture.componentInstance['reason'].set('Motivo suficiente');
      fixture.detectChanges();
      await enviar();
      expect(enviados).toEqual([]);
      expect(boton('submit').getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('cancelar emite cancelled', async () => {
    await pintar();
    boton('cancel').click();
    expect(cancelados).toBe(1);
  });
});
