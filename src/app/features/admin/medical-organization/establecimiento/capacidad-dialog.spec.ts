import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type { InfrastructureCatalog } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { chooseSelectOption, selectOptionLabels } from '../../../../../testing/select';
import { CapacidadDialog } from './capacidad-dialog';

/**
 * Declarar la capacidad habilitada de un establecimiento (lo que dice la
 * resolución). Cantidad entera ≥ 0 y fecha obligatorias; el número de
 * resolución viaja `null` si quedó en blanco. Un rechazo se muestra.
 */

const CATALOGO = {
  regulatory: {
    capacityKind: [
      { code: 'CAP_BEDS_CENSABLE', display: 'Camas censables' },
      { code: 'CAP_OR', display: 'Quirófanos' },
    ],
  },
} as unknown as InfrastructureCatalog;

describe('CapacidadDialog', () => {
  let fixture: ComponentFixture<CapacidadDialog>;
  let declareCapacity: ReturnType<typeof vi.fn>;
  let guardados: unknown[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campos = (): HTMLInputElement[] => Array.from(root().querySelectorAll<HTMLInputElement>('form input'));

  async function pintar(): Promise<void> {
    fixture = TestBed.createComponent(CapacidadDialog);
    fixture.componentRef.setInput('siteId', 'site-1');
    fixture.componentRef.setInput('catalogo', CATALOGO);
    guardados = [];
    fixture.componentInstance.guardado.subscribe((d) => guardados.push(d));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function llenar(cantidad: string, fecha: string, resolucion = ''): Promise<void> {
    const [qty, asOf, res] = campos();
    for (const [campo, valor] of [[qty, cantidad], [asOf, fecha], [res, resolucion]] as const) {
      campo!.value = valor;
      campo!.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function declarar(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    declareCapacity = vi.fn(() => of({ id: 'dc-1' }));
    TestBed.configureTestingModule({ providers: [{ provide: InfrastructureClient, useValue: { declareCapacity } }] });
  });

  it('ofrece los tipos del catálogo regulatorio', async () => {
    await pintar();
    expect(await selectOptionLabels(fixture, root().querySelector('app-select')!)).toEqual(['Camas censables', 'Quirófanos']);
  });

  it('sin cantidad ni fecha no declara', async () => {
    await pintar();
    await declarar();
    expect(declareCapacity).not.toHaveBeenCalled();
  });

  it('declara con cantidad numérica, fecha y resolución recortada (o null)', async () => {
    await pintar();
    await chooseSelectOption(fixture, root().querySelector('app-select')!, 'Quirófanos');
    await llenar('4', '2026-10-01', '  RM-123/2026  ');
    await declarar();
    expect(declareCapacity).toHaveBeenCalledWith('site-1', { kindCode: 'CAP_OR', quantity: 4, asOf: '2026-10-01', resolutionNumber: 'RM-123/2026' });
    expect(guardados).toEqual([{ id: 'dc-1' }]);

    declareCapacity.mockClear();
    await llenar('0', '2026-10-01', '   ');
    await declarar();
    expect(declareCapacity).toHaveBeenCalledWith('site-1', expect.objectContaining({ quantity: 0, resolutionNumber: null }));
  });

  it('una cantidad negativa no se declara', async () => {
    await pintar();
    await llenar('-2', '2026-10-01');
    await declarar();
    expect(declareCapacity).not.toHaveBeenCalled();
  });

  it('un rechazo de la API se muestra y no emite', async () => {
    declareCapacity.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    await pintar();
    await llenar('4', '2026-10-01');
    await declarar();
    expect(guardados).toEqual([]);
    expect(root().querySelector('app-view-state-host')).not.toBeNull();
  });
});
