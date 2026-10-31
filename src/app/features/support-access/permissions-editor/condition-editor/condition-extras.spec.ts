import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { SupportCondition } from '../../../../core/data-access/access-governance/conditions.types';
import { ConditionExtras } from './condition-extras';

/**
 * Las condiciones extra de un permiso delegado: topes de monto y controles
 * (pedir motivo, reautenticación, aprobación). El componente no guarda: emite
 * la condición resultante. Encender un control lo crea con valores seguros por
 * omisión; apagar el único que había deja la condición vacía (`undefined`), no
 * un objeto vacío que la API leería como «hay condición».
 */
describe('ConditionExtras', () => {
  let fixture: ComponentFixture<ConditionExtras>;
  let emitidas: (SupportCondition | undefined)[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(section: 'amount' | 'controls', condition?: SupportCondition): void {
    fixture = TestBed.createComponent(ConditionExtras);
    fixture.componentRef.setInput('section', section);
    fixture.componentRef.setInput('condition', condition);
    emitidas = [];
    fixture.componentInstance.conditionChange.subscribe((c) => emitidas.push(c));
    fixture.detectChanges();
  }

  function interruptor(testid: string, valor: boolean): void {
    const input = root().querySelector<HTMLInputElement>(`[data-testid="${testid}"] input[role="switch"]`)!;
    input.checked = valor;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function escribir(testid: string, texto: string): Promise<void> {
    const campo = root().querySelector<HTMLInputElement>(`[data-testid="${testid}"]`)!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('encender los topes de monto crea uno seguro: Bs 500 por operación y si se pasa, no dejar', () => {
    pintar('amount');
    expect(root().querySelector('[data-testid="cond-amount-op"]')).toBeNull();
    interruptor('cond-amount', true);
    expect(emitidas.at(-1)).toEqual(expect.objectContaining({ amount: { currency: 'BOB', perTransactionMax: 500, onExceed: 'DENY' } }));
  });

  it('con tope: editar el máximo emite el entero; vaciarlo lo quita', async () => {
    pintar('amount', { amount: { currency: 'BOB', perTransactionMax: 500, onExceed: 'DENY' } } as SupportCondition);
    expect(root().querySelector<HTMLInputElement>('[data-testid="cond-amount-op"]')!.value).toBe('500');
    await escribir('cond-amount-op', '750.9');
    expect((emitidas.at(-1) as unknown as { amount: { perTransactionMax: number } }).amount.perTransactionMax).toBe(750);
    await escribir('cond-amount-day', '');
    expect((emitidas.at(-1) as unknown as { amount: object }).amount).not.toHaveProperty('perDayMax');
  });

  it('apagar el único control deja la condición vacía (undefined)', () => {
    pintar('amount', { amount: { currency: 'BOB', perTransactionMax: 500, onExceed: 'DENY' } } as SupportCondition);
    interruptor('cond-amount', false);
    expect(emitidas.at(-1)).toBeUndefined();
  });

  it.each([
    ['cond-reason', 'requireReason', { minLength: 10 }],
    ['cond-stepup', 'stepUp', { maxAgeMinutes: 10 }],
    ['cond-approval', 'approval', { by: 'DOCTOR', ttlMinutes: 60 }],
  ])('encender %s agrega la obligación %s con su valor por omisión', (testid, clave, inicial) => {
    pintar('controls');
    interruptor(testid, true);
    expect((emitidas.at(-1) as unknown as { obligations: Record<string, unknown> }).obligations[clave]).toEqual(inicial);
  });
});
