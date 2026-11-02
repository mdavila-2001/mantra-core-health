import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { DischargeDialog } from './discharge-dialog';

/**
 * El diálogo de alta desde el tablero de camas: envuelve el formulario de
 * egreso, nombra la cama y reenvía lo que el formulario emite. «Cancelar»
 * del formulario cierra el diálogo.
 */
describe('DischargeDialog', () => {
  let fixture: ComponentFixture<DischargeDialog>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AdtClient, useValue: { discharge: vi.fn(() => of({ requestId: 'r' })) } }] });
    fixture = TestBed.createComponent(DischargeDialog);
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.componentRef.setInput('rowVersion', 3);
    fixture.componentRef.setInput('bedCode', 'B-12');
    fixture.componentRef.setInput('isolated', true);
    fixture.detectChanges();
  });

  it('nombra la cama y monta el formulario cancelable, con el aviso de aislamiento', () => {
    expect(root().querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim()).toBe('Dar de alta');
    expect(root().textContent).toContain('Paciente de la cama B-12.');
    expect(root().querySelector('[data-testid="discharge-form"]')).not.toBeNull();
    expect(root().textContent).toContain('con limpieza terminal');
  });

  it('«Cancelar» del formulario cierra el diálogo', () => {
    let cerrado = 0;
    fixture.componentInstance.closed.subscribe(() => (cerrado += 1));
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancelar')!.click();
    expect(cerrado).toBe(1);
  });
});
