import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SpaceBillingClient } from '../../../core/data-access/space-billing/space-billing.client';
import type { ChargeCapture } from '../../../core/data-access/space-billing/space-billing.types';
import { CaseCharges } from './case-charges';

/**
 * El cargo de uso de quirófano de un caso. Sin encuentro todavía no hay cargo
 * (se devenga al cerrar el caso) y no se consulta nada. Con encuentro se
 * muestran sólo los cargos `OR_TIME` de ESTE caso, con su importe calculado; una
 * tarifa faltante se dice («Sin tarifa vigente»), no se inventa un precio.
 */

function cargo(partial: Partial<ChargeCapture> = {}): ChargeCapture {
  return {
    id: 'ch-1',
    encounterId: 'enc-1',
    source: 'OR_TIME',
    sourceRefId: 'case-1',
    serviceDate: '2026-10-30',
    careSpaceId: 'or-1',
    bedCategoryConceptId: null,
    spaceTariffId: 't-1',
    quantity: '3',
    unitPrice: '150.50',
    costCenterId: 'cc-1',
    status: 'CHG_PENDING',
    idempotencyKey: 'k-1',
    minutes: 95,
    ...partial,
  } as ChargeCapture;
}

describe('CaseCharges', () => {
  let fixture: ComponentFixture<CaseCharges>;
  let getPendingCharges: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  async function pintar(encounterId: string | null): Promise<void> {
    fixture = TestBed.createComponent(CaseCharges);
    fixture.componentRef.setInput('caseId', 'case-1');
    fixture.componentRef.setInput('encounterId', encounterId);
    fixture.componentRef.setInput('roomLabel', 'Quirófano 2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    getPendingCharges = vi.fn(() =>
      of([
        cargo(),
        cargo({ id: 'ch-otro-caso', sourceRefId: 'case-9' }),
        cargo({ id: 'ch-cama', source: 'BED_DAY' as ChargeCapture['source'] }),
        cargo({ id: 'ch-otro-encuentro', encounterId: 'enc-2' }),
      ]),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SpaceBillingClient, useValue: { getPendingCharges } }] });
  });

  it('sin encuentro explica cuándo se genera y no consulta', async () => {
    await pintar(null);
    expect(root().textContent).toContain('El cargo de quirófano todavía no se generó');
    expect(root().querySelector('a')?.getAttribute('href')).toBe('/administration/services-catalog?tab=space-tariffs');
    expect(getPendingCharges).not.toHaveBeenCalled();
  });

  it('con encuentro muestra sólo el cargo de quirófano de este caso, con su importe', async () => {
    await pintar('enc-1');
    expect(getPendingCharges).toHaveBeenCalledWith('enc-1');
    const filas = root().querySelectorAll('[data-testid="case-charge"]');
    expect(filas).toHaveLength(1);
    const texto = filas[0]!.textContent!;
    expect(texto).toContain('Pendiente de revisión');
    expect(texto).toContain('Quirófano 2');
    expect(texto).toContain('1 h 35 min');
    expect(texto).toContain('150.50');
    expect(texto).toContain('451.50');
  });

  it('una tarifa faltante se dice, sin importe inventado', async () => {
    getPendingCharges.mockReturnValue(of([cargo({ unitPrice: null, costCenterId: null })]));
    await pintar('enc-1');
    const texto = root().querySelector('[data-testid="case-charge"]')!.textContent!;
    expect(texto).toContain('Sin tarifa vigente');
    expect(texto).toContain('Sin centro de costo');
    expect(texto).not.toContain('NaN');
  });

  it('sin cargos para el caso, lo dice', async () => {
    getPendingCharges.mockReturnValue(of([cargo({ sourceRefId: 'otro' })]));
    await pintar('enc-1');
    expect(root().querySelector('[data-testid="case-charge"]')).toBeNull();
    expect(root().textContent).toContain('El caso todavía no tiene cargo de quirófano.');
  });

  it('un error de la API no se pinta como «sin cargos»', async () => {
    getPendingCharges.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await pintar('enc-1');
    expect(root().textContent).not.toContain('El caso todavía no tiene cargo de quirófano.');
    expect(root().querySelector('[data-testid="case-charge"]')).toBeNull();
  });
});
