import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoardCell, BlockKindCode } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { OpsCatalogStore } from '../ops-catalog.store';
import { BlockDialog } from './block-dialog';

/**
 * Bloquear una cama (clínico, administrativo, mantenimiento o cierre). Motivo
 * obligatorio; «Otro» exige detalle; mantenimiento exige fecha de fin. Si la
 * API responde que hay compromisos futuros en la ventana, se listan y sólo se
 * bloquea si la persona los reconoce explícitamente (`acknowledgeConflicts`).
 */

const CELDA = { id: 'cs-1', code: 'B-12', opsVersion: 6 } as unknown as BedBoardCell;
const MOTIVOS = [
  { code: 'BLOCK_RSN_LEAK', display: 'Filtración', kinds: ['BLOCK_MAINTENANCE', 'BLOCK_ADMIN'] },
  { code: 'BLOCK_RSN_OTHER', display: 'Otro', kinds: ['BLOCK_ADMIN', 'BLOCK_CLINICAL', 'BLOCK_MAINTENANCE'] },
  { code: 'BLOCK_RSN_ISO', display: 'Aislamiento', kinds: ['BLOCK_CLINICAL'] },
];

describe('BlockDialog', () => {
  let fixture: ComponentFixture<BlockDialog>;
  let changeAvailability: ReturnType<typeof vi.fn>;
  let guardados: string[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const motivo = (): Element => root().querySelector('[data-testid="block-reason"]')!;

  async function pintar(kind: BlockKindCode): Promise<void> {
    fixture = TestBed.createComponent(BlockDialog);
    fixture.componentRef.setInput('cell', CELDA);
    fixture.componentRef.setInput('kind', kind);
    guardados = [];
    fixture.componentInstance.saved.subscribe((id) => guardados.push(id));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function bloquear(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    changeAvailability = vi.fn(() => of({ requestId: 'req-1' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: InfrastructureOpsClient, useValue: { changeAvailability } },
        { provide: OpsCatalogStore, useValue: { catalog: () => ({ blockReasons: MOTIVOS }), ensure: vi.fn() } },
      ],
    });
  });

  it('el título sigue al tipo y sólo ofrece los motivos de ese tipo', async () => {
    await pintar('BLOCK_CLINICAL');
    expect(root().querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim()).toBe('Bloqueo clínico');
    expect(await selectOptionLabels(fixture, motivo())).toEqual(['Otro', 'Aislamiento']);
  });

  it('sin motivo no bloquea y lo pide', async () => {
    await pintar('BLOCK_ADMIN');
    await bloquear();
    expect(changeAvailability).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Elija el motivo del bloqueo.');
  });

  it('«Otro» exige el detalle', async () => {
    await pintar('BLOCK_ADMIN');
    await chooseSelectOption(fixture, motivo(), 'Otro');
    await bloquear();
    expect(changeAvailability).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Describa el motivo.');
  });

  it('bloqueo administrativo: manda la versión de la cama, el tipo y el motivo; emite el requestId', async () => {
    await pintar('BLOCK_ADMIN');
    await chooseSelectOption(fixture, motivo(), 'Filtración');
    await bloquear();
    expect(changeAvailability).toHaveBeenCalledWith('cs-1', 6, { action: 'block', kindCode: 'BLOCK_ADMIN', reasonCode: 'BLOCK_RSN_LEAK' });
    expect(guardados).toEqual(['req-1']);
  });

  it('mantenimiento sin fecha de fin no se manda', async () => {
    await pintar('BLOCK_MAINTENANCE');
    await chooseSelectOption(fixture, motivo(), 'Filtración');
    await bloquear();
    expect(changeAvailability).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Indique hasta cuándo.');
  });

  it('con compromisos futuros los lista y sólo reintenta si se reconocen', async () => {
    changeAvailability.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              reason: 'FUTURE_COMMITMENTS_CONFLICT',
              details: { conflicts: [{ id: 'case-12345678', kind: 'PROCEDURE_CASE', startsAt: null, nextAction: 'Reprogramar' }] },
            },
          }),
      ),
    );
    await pintar('BLOCK_ADMIN');
    await chooseSelectOption(fixture, motivo(), 'Filtración');
    await bloquear();
    const conflictos = root().querySelector('[data-testid="block-conflicts"]')!;
    expect(conflictos.textContent).toContain('Hay 1 compromiso(s)');
    expect(conflictos.textContent).toContain('Intervención case-123');
    expect(guardados).toEqual([]);

    const reconozco = conflictos.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    reconozco.checked = true;
    reconozco.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await bloquear();
    expect(changeAvailability).toHaveBeenLastCalledWith('cs-1', 6, expect.objectContaining({ acknowledgeConflicts: true }));
    expect(guardados).toEqual(['req-1']);
  });
});
