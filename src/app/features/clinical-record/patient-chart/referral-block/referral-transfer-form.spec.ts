import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { TransferIssue } from '../../../../core/data-access/referrals/referral-transfer.types';
import { emptyTransferDraft, type TransferDraft } from './referral-transfer.model';
import { ReferralTransferForm } from './referral-transfer-form';

/**
 * El traslado de una derivación (norma de referencia): sin traslado físico no
 * pide nada; con el paciente inestable o crítico explica por qué exige
 * ambulancia, personal de salud y aviso al receptor. Los errores se muestran
 * al tocar el campo o cuando el padre pide mostrarlos todos.
 */
describe('ReferralTransferForm', () => {
  let fixture: ComponentFixture<ReferralTransferForm>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const draft = (): TransferDraft => fixture.componentInstance.draft();

  function pintar(partial: Partial<TransferDraft> = {}, extra: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(ReferralTransferForm);
    fixture.componentRef.setInput('draft', { ...emptyTransferDraft(), ...partial });
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  function elegirRadio(grupo: string, rotulo: string): void {
    const label = Array.from(q(grupo)!.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo)!;
    const radio = label.querySelector('input')!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('sin traslado físico no pide medio ni signos, y lo explica', () => {
    pintar();
    expect(q('transfer-not-required')).not.toBeNull();
    expect(q('transfer-condition')).toBeNull();
    expect(q('transfer-vitals')).toBeNull();
  });

  it('activar el interruptor actualiza el borrador y despliega el formulario', () => {
    pintar();
    const interruptor = q('transfer-required')!.querySelector<HTMLInputElement>('input[role="switch"]')!;
    interruptor.checked = true;
    interruptor.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(draft().required).toBe(true);
    expect(q('transfer-condition')).not.toBeNull();
    expect(q('transfer-vitals')).not.toBeNull();
  });

  it('paciente estable: no hay explicación de ambulancia', () => {
    pintar({ required: true });
    elegirRadio('transfer-condition', 'Estable');

    expect(draft().departureCondition).toBe('STABLE');
    expect(q('transfer-unstable-why')).toBeNull();
  });

  it('paciente crítico: explica la norma y pide quién recibió el aviso', () => {
    pintar({ required: true });
    elegirRadio('transfer-condition', 'Crítico');

    expect(draft().departureCondition).toBe('CRITICAL');
    expect(q('transfer-unstable-why')?.textContent).toContain('ambulancia');
    expect(q('transfer-unstable-why')?.textContent).toContain('crítico');
    expect(root().querySelector('[data-testid="transfer-receiver-name"]')).not.toBeNull();
  });

  it('el parentesco y teléfono del acompañante sólo aparecen con un acompañante', () => {
    pintar({ required: true });
    expect(root().querySelector('[data-testid="transfer-companion-phone"]')).toBeNull();

    pintar({ required: true, companionName: 'María' });
    expect(root().querySelector('[data-testid="transfer-companion-phone"]')).not.toBeNull();
  });

  it('escribir un signo vital lo guarda como texto en su clave', async () => {
    pintar({ required: true });
    const campo = root().querySelector<HTMLInputElement>('[data-testid="transfer-vital-heartRate"]')!;
    campo.value = '88';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(draft().vitals.heartRate).toBe('88');
    expect(draft().vitals.glasgow).toBe('');
  });

  it('los errores sólo se ven cuando el padre pide mostrarlos todos', () => {
    const issues: TransferIssue[] = [
      { rule: 'TRANSFER_INCOMPLETE', field: 'transportMode', message: 'Elija el medio de transporte.' },
    ];
    pintar({ required: true }, { issues });
    expect(root().textContent).not.toContain('Elija el medio de transporte.');

    pintar({ required: true }, { issues, showAll: true });
    expect(root().textContent).toContain('Elija el medio de transporte.');
  });
});
