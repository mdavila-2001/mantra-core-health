import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoardCell } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { chooseSelectOption } from '../../../../testing/select';
import { OpsCatalogStore } from '../ops-catalog.store';
import { IsolationDialog } from './isolation-dialog';

/**
 * Indicar o levantar el aislamiento de una cama. Motivo obligatorio; el
 * organismo sólo se pide si hay aislamiento y viaja sólo si se escribió. Si la
 * API dice que el local no es apto (`ISOLATION_ROOM_NOT_CAPABLE`), se explica
 * qué le falta en palabras, no con códigos.
 */

function celda(isolation = 'ISO_NONE'): BedBoardCell {
  return { id: 'cs-1', code: 'B-12', opsVersion: 2, isolation: { code: isolation } } as unknown as BedBoardCell;
}

const CATALOGO = {
  isolation: [
    { code: 'ISO_NONE', display: 'Sin aislamiento' },
    { code: 'ISO_CONTACT', display: 'Contacto' },
    { code: 'ISO_AIRBORNE', display: 'Aéreo' },
  ],
};

describe('IsolationDialog', () => {
  let fixture: ComponentFixture<IsolationDialog>;
  let changeIsolation: ReturnType<typeof vi.fn>;
  let guardados: string[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  async function pintar(cell = celda()): Promise<void> {
    fixture = TestBed.createComponent(IsolationDialog);
    fixture.componentRef.setInput('cell', cell);
    guardados = [];
    fixture.componentInstance.saved.subscribe((id) => guardados.push(id));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(id: string, texto: string): Promise<void> {
    const campo = q(id)!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function guardar(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    changeIsolation = vi.fn(() => of({ requestId: 'req-2' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: InfrastructureOpsClient, useValue: { changeIsolation } },
        { provide: OpsCatalogStore, useValue: { catalog: () => CATALOGO, ensure: vi.fn() } },
      ],
    });
  });

  it('sin motivo no guarda y lo pide', async () => {
    await pintar();
    await guardar();
    expect(changeIsolation).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Indique el motivo.');
  });

  it('guarda precaución, motivo y organismo recortados con la versión de la cama', async () => {
    await pintar();
    await escribir('isolation-organism', '  KPC  ');
    await escribir('isolation-reason', '  Cultivo positivo  ');
    await guardar();
    expect(changeIsolation).toHaveBeenCalledWith('cs-1', 2, { isolationCode: 'ISO_CONTACT', reasonText: 'Cultivo positivo', organismText: 'KPC' });
    expect(guardados).toEqual(['req-2']);
  });

  it('sin organismo no lo manda', async () => {
    await pintar();
    await escribir('isolation-reason', 'Sospecha');
    await guardar();
    expect(changeIsolation.mock.calls[0]![2]).not.toHaveProperty('organismText');
  });

  it('levantar un aislamiento oculta el organismo y avisa la limpieza terminal', async () => {
    await pintar(celda('ISO_CONTACT'));
    await chooseSelectOption(fixture, q('isolation-code')!, 'Sin aislamiento');
    fixture.detectChanges();
    expect(q('isolation-organism')).toBeNull();
    expect(root().textContent).toContain('limpieza terminal pendiente');
  });

  it('local no apto: explica en palabras lo que le falta', async () => {
    changeIsolation.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { reason: 'ISOLATION_ROOM_NOT_CAPABLE', details: { missing: ['NEGATIVE_PRESSURE', 'HVAC_VALIDATION'] } },
          }),
      ),
    );
    await pintar();
    await chooseSelectOption(fixture, q('isolation-code')!, 'Aéreo');
    await escribir('isolation-reason', 'TBC');
    await guardar();
    const faltan = Array.from(q('isolation-missing')!.querySelectorAll('li')).map((li) => li.textContent);
    expect(faltan).toEqual(['no tiene presión negativa', 'la validación de climatización no está vigente']);
    expect(guardados).toEqual([]);
  });
});
