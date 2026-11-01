import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { NewOrderDialog } from './new-order-dialog';

/**
 * Pedir una limpieza para una cama. Sólo se ofrecen camas sin una orden de
 * limpieza abierta; sin cama elegida no se pide; la nota viaja sólo si se
 * escribió. Un rechazo de la API se muestra y no emite `saved`.
 */

function celda(id: string, code: string, abierta: string | null = null) {
  return { id, code, openCleaningOrderId: abierta, hygiene: { code: 'HYG_DIRTY' } };
}

describe('NewOrderDialog', () => {
  let fixture: ComponentFixture<NewOrderDialog>;
  let createCleaningOrder: ReturnType<typeof vi.fn>;
  let guardados: number;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const espacio = (): Element => root().querySelector('[data-testid="new-order-space"]')!;

  async function pintar(): Promise<void> {
    fixture = TestBed.createComponent(NewOrderDialog);
    fixture.componentRef.setInput('siteId', 'site-1');
    guardados = 0;
    fixture.componentInstance.saved.subscribe(() => (guardados += 1));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function pedir(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    createCleaningOrder = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: InfrastructureOpsClient,
          useValue: {
            getBedBoard: vi.fn(() => of({ units: [{ cells: [celda('c1', 'B-1'), celda('c2', 'B-2', 'ord-9')] }, { cells: [celda('c3', 'C-1')] }] })),
            createCleaningOrder,
          },
        },
      ],
    });
  });

  it('ofrece sólo camas sin orden de limpieza abierta', async () => {
    await pintar();
    const rotulos = await selectOptionLabels(fixture, espacio());
    expect(rotulos.map((r) => r.split(' · ')[0])).toEqual(['B-1', 'C-1']);
  });

  it('sin cama no pide y lo explica', async () => {
    await pintar();
    await pedir();
    expect(createCleaningOrder).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Elija el espacio.');
  });

  it('con cama pide con tipo y prioridad por omisión y sin nota, y emite saved', async () => {
    await pintar();
    await chooseSelectOption(fixture, espacio(), 0);
    await pedir();
    expect(createCleaningOrder).toHaveBeenCalledWith('site-1', {
      careSpaceId: 'c1',
      typeCode: 'CLEAN_ROUTINE',
      priorityCode: 'CLN_PRIO_ROUTINE',
    });
    expect(guardados).toBe(1);
  });

  it('la nota viaja recortada si se escribió', async () => {
    await pintar();
    await chooseSelectOption(fixture, espacio(), 1);
    const nota = root().querySelector('textarea')!;
    nota.value = '  derrame de sangre  ';
    nota.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await pedir();
    expect(createCleaningOrder).toHaveBeenCalledWith('site-1', expect.objectContaining({ careSpaceId: 'c3', note: 'derrame de sangre' }));
  });

  it('un rechazo de la API se muestra y no emite saved', async () => {
    createCleaningOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    await pintar();
    await chooseSelectOption(fixture, espacio(), 0);
    await pedir();
    expect(guardados).toBe(0);
    expect(root().querySelector('app-view-state-host')).not.toBeNull();
  });
});
