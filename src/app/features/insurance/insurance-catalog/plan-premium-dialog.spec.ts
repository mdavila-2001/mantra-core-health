import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { Plan } from '../../../core/data-access/insurance/insurance.types';
import { PlanPremiumDialog } from './plan-premium-dialog';

/**
 * La prima de lista mensual de un plan (denominador del loss ratio). Acepta un
 * importe no negativo con hasta dos decimales, o vacío para quitarla (viaja
 * `null`). Un error de la API se muestra con su mensaje y el diálogo sigue
 * abierto.
 */

const PLAN = { id: 'pl-1', name: 'Plan Oro', monthlyPremiumAmount: '150.00' } as unknown as Plan;

describe('PlanPremiumDialog', () => {
  let fixture: ComponentFixture<PlanPremiumDialog>;
  let updatePlanPremium: ReturnType<typeof vi.fn>;
  let guardados: (string | null)[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = (): HTMLInputElement => root().querySelector<HTMLInputElement>('[data-testid="plan-premium-amount"]')!;
  const guardar = (): HTMLButtonElement =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Guardar prima')!;

  async function pintar(): Promise<void> {
    fixture = TestBed.createComponent(PlanPremiumDialog);
    fixture.componentRef.setInput('plan', PLAN);
    guardados = [];
    fixture.componentInstance.saved.subscribe((v) => guardados.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function escribir(texto: string): Promise<void> {
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    updatePlanPremium = vi.fn(() => of({}));
    TestBed.configureTestingModule({ providers: [{ provide: InsuranceClient, useValue: { updatePlanPremium } }] });
  });

  it('parte de la prima actual del plan y nombra el plan', async () => {
    await pintar();
    expect(campo().value).toBe('150.00');
    expect(root().textContent).toContain('Plan: Plan Oro');
  });

  it('guarda el importe nuevo y lo emite', async () => {
    await pintar();
    await escribir('199.9');
    guardar().click();
    await fixture.whenStable();
    expect(updatePlanPremium).toHaveBeenCalledWith('pl-1', { monthlyPremiumAmount: '199.9' });
    expect(guardados).toEqual(['199.9']);
  });

  it('vacío quita la prima: viaja null', async () => {
    await pintar();
    await escribir('');
    guardar().click();
    await fixture.whenStable();
    expect(updatePlanPremium).toHaveBeenCalledWith('pl-1', { monthlyPremiumAmount: null });
  });

  it.each(['-5', '10.123', 'diez'])('«%s» no se manda y se explica', async (malo) => {
    await pintar();
    await escribir(malo);
    guardar().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(updatePlanPremium).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Ingrese un importe no negativo con hasta dos decimales.');
  });

  it('un error de la API muestra su mensaje y no emite saved', async () => {
    updatePlanPremium.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'VALIDATION_FAILED', message: 'La prima excede el tope.' } })),
    );
    await pintar();
    await escribir('9999');
    guardar().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(guardados).toEqual([]);
    expect(root().textContent).toContain('La prima excede el tope.');
  });
});
