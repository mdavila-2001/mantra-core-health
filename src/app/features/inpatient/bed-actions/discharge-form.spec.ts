import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { chooseSelectOption } from '../../../../testing/select';
import { DischargeForm } from './discharge-form';

/**
 * El egreso de un paciente internado: exige tipo de egreso, no admite una hora
 * futura, manda la versión de la estadía (If-Match) y la observación sólo si se
 * escribió. Avisa al padre cuándo está ocupado y con qué requestId terminó.
 */
describe('DischargeForm', () => {
  let fixture: ComponentFixture<DischargeForm>;
  let discharge: ReturnType<typeof vi.fn>;
  let guardados: string[];
  let ocupado: boolean[];

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  async function pintar(extra: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(DischargeForm);
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.componentRef.setInput('rowVersion', 7);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    guardados = [];
    ocupado = [];
    fixture.componentInstance.saved.subscribe((id) => guardados.push(id));
    fixture.componentInstance.busy.subscribe((b) => ocupado.push(b));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function enviar(): Promise<void> {
    q('discharge-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    discharge = vi.fn(() => of({ requestId: 'req-9' }));
    TestBed.configureTestingModule({ providers: [{ provide: AdtClient, useValue: { discharge } }] });
  });

  it('sin tipo de egreso no envía y lo pide', async () => {
    await pintar();
    await enviar();

    expect(discharge).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Elija el tipo de egreso.');
  });

  it('con tipo de egreso envía a la estadía con su versión y emite el requestId', async () => {
    await pintar();
    await chooseSelectOption(fixture, q('discharge-disposition')!, 'Alta a domicilio');
    await enviar();

    expect(discharge).toHaveBeenCalledTimes(1);
    const [encounterId, rowVersion, cuerpo] = discharge.mock.calls[0]!;
    expect(encounterId).toBe('enc-1');
    expect(rowVersion).toBe(7);
    expect(cuerpo.dischargeDispositionCode).toBe('DISP_HOME');
    expect(Number.isNaN(Date.parse(cuerpo.occurredAt))).toBe(false);
    expect(cuerpo).not.toHaveProperty('reasonText');
    expect(guardados).toEqual(['req-9']);
    expect(ocupado).toEqual([true, false]);
  });

  it('una hora de egreso futura se rechaza sin llamar a la API', async () => {
    await pintar();
    await chooseSelectOption(fixture, q('discharge-disposition')!, 'Fallecimiento');
    (fixture.componentInstance as unknown as { occurredAt: { set(d: Date): void } }).occurredAt.set(
      new Date(Date.now() + 3_600_000),
    );
    fixture.detectChanges();
    await enviar();

    expect(discharge).not.toHaveBeenCalled();
    expect(root().textContent).toContain('El egreso no puede ser en el futuro.');
  });

  it('un rechazo de la API se muestra y libera el formulario', async () => {
    discharge.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    await pintar();
    await chooseSelectOption(fixture, q('discharge-disposition')!, 'Alta a domicilio');
    await enviar();

    expect(q('discharge-failure')).not.toBeNull();
    expect(guardados).toEqual([]);
    expect(ocupado).toEqual([true, false]);
    expect(q('discharge-submit')!.getAttribute('aria-disabled')).toBe('false');
  });

  it('en aislamiento avisa la limpieza terminal; cancelable ofrece cancelar', async () => {
    await pintar({ isolated: true, cancellable: true });
    let cancelados = 0;
    fixture.componentInstance.cancelled.subscribe(() => (cancelados += 1));

    expect(root().textContent).toContain('con limpieza terminal');
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancelar')!.click();
    expect(cancelados).toBe(1);
  });

  it('sin cancelable no hay botón Cancelar', async () => {
    await pintar();
    expect(Array.from(root().querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Cancelar')).toBe(false);
  });
});
