import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { CensusDayView } from '../../../core/data-access/adt/adt.types';
import { chooseSelectOption } from '../../../../testing/select';
import { AdjustDialog } from './adjust-dialog';

/**
 * El ajuste de un campo del censo diario. El número original se conserva y el
 * ajuste viaja con su motivo: sin motivo, o con un valor que no es un entero
 * ≥ 0, no se manda. Un día abierto (sin id) no se puede ajustar.
 */

function dia(id: string | null = 'cd-1'): CensusDayView & { unitName: string } {
  return {
    id,
    unitId: 'u-1',
    date: '2026-10-30',
    unitName: 'Medicina interna',
    adjustedTotals: { admissions: 4, discharges: 2 },
  } as unknown as CensusDayView & { unitName: string };
}

describe('AdjustDialog', () => {
  let fixture: ComponentFixture<AdjustDialog>;
  let adjustCensus: ReturnType<typeof vi.fn>;
  let guardados: number;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  async function pintar(day = dia()): Promise<void> {
    fixture = TestBed.createComponent(AdjustDialog);
    fixture.componentRef.setInput('day', day);
    guardados = 0;
    fixture.componentInstance.saved.subscribe(() => (guardados += 1));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(selector: string, texto: string): Promise<void> {
    const campo = root().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function ajustar(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    adjustCensus = vi.fn(() => of({}));
    TestBed.configureTestingModule({ providers: [{ provide: AdtClient, useValue: { adjustCensus } }] });
  });

  it('dice la unidad y cuánto vale hoy el campo elegido', async () => {
    await pintar();
    expect(root().textContent).toContain('Medicina interna · el número original se conserva');
    expect(root().textContent).toContain('Hoy vale 4.');
    await chooseSelectOption(fixture, root().querySelector('[data-testid="adjust-field"]')!, 'Egresos');
    fixture.detectChanges();
    expect(root().textContent).toContain('Hoy vale 2.');
  });

  it('sin valor ni motivo no manda nada y explica ambos', async () => {
    await pintar();
    await ajustar();
    expect(adjustCensus).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Un entero mayor o igual a cero.');
    expect(root().textContent).toContain('Todo ajuste exige un motivo.');
  });

  it('un valor negativo o con decimales no se acepta', async () => {
    await pintar();
    await escribir('[data-testid="adjust-reason"] textarea', 'Recuento manual');
    for (const malo of ['-1', '2.5']) {
      await escribir('[data-testid="adjust-value"] input', malo);
      await ajustar();
    }
    expect(adjustCensus).not.toHaveBeenCalled();
  });

  it('válido: manda campo, valor numérico y motivo recortado, y emite saved', async () => {
    await pintar();
    await escribir('[data-testid="adjust-value"] input', '5');
    await escribir('[data-testid="adjust-reason"] textarea', '  Ingreso tardío no registrado  ');
    await ajustar();
    expect(adjustCensus).toHaveBeenCalledWith('cd-1', { fieldCode: 'admissions', newValue: 5, reasonText: 'Ingreso tardío no registrado' });
    expect(guardados).toBe(1);
  });

  it('un día abierto (sin id) no se ajusta', async () => {
    await pintar(dia(null));
    await escribir('[data-testid="adjust-value"] input', '5');
    await escribir('[data-testid="adjust-reason"] textarea', 'motivo');
    await ajustar();
    expect(adjustCensus).not.toHaveBeenCalled();
  });

  it('un rechazo de la API se muestra y no emite saved', async () => {
    adjustCensus.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    await pintar();
    await escribir('[data-testid="adjust-value"] input', '5');
    await escribir('[data-testid="adjust-reason"] textarea', 'motivo');
    await ajustar();
    expect(guardados).toBe(0);
    expect(root().querySelector('app-view-state-host')).not.toBeNull();
  });
});
