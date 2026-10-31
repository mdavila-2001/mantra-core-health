import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import { SIMULACION_CON_CAMBIOS } from '../simulator.fixtures';
import { SimulationResult } from './simulation-result';

describe('SimulationResult', () => {
  let fixture: ComponentFixture<SimulationResult>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  async function pintar(result: SimulateAccessResponse, ownScenarios = 0): Promise<void> {
    fixture = TestBed.createComponent(SimulationResult);
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('ownScenarios', ownScenarios);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const muchos = (n: number): SimulateAccessResponse => ({
    ...SIMULACION_CON_CAMBIOS,
    scenarios: Array.from({ length: n }, (_, i) => ({
      label: `Caso ${i}`,
      change: 'NEWLY_DENIED',
      before: { effect: 'PERMIT', allowed: true, reason: 'ALLOWED' },
      after: { effect: 'DENY', allowed: false, reason: 'TIME_WINDOW' },
    })),
    limits: { scenarioCount: n, truncated: true },
  });

  it('la comparación acepta el sinónimo NEWLY_PERMITTED y dice el motivo del «después» con palabras', async () => {
    await pintar({
      ...SIMULACION_CON_CAMBIOS,
      scenarios: [
        {
          label: 'Cobrar',
          change: 'NEWLY_PERMITTED' as never,
          before: { effect: 'DENY', allowed: false, reason: 'ACTION_NOT_GRANTED' },
          after: { effect: 'PERMIT', allowed: true, reason: 'ALLOWED' },
        },
        SIMULACION_CON_CAMBIOS.scenarios[2]!,
      ],
    });
    expect(byId('caso-0')!.textContent).toContain('Ahora sí puede');
    expect(byId('caso-1')!.textContent).toContain('No puede · Falta anticipación para esa cita.');
  });

  it('pagina los casos de a 25 y avisa si el servidor recortó la lista', async () => {
    await pintar(muchos(60));
    expect(host().querySelectorAll('[data-testid="simulacion-casos"] tbody tr').length).toBe(25);
    expect(byId('simulacion-ver-mas')!.textContent).toContain('35 restantes');
    byId('simulacion-ver-mas')!.click();
    fixture.detectChanges();
    expect(host().querySelectorAll('[data-testid="simulacion-casos"] tbody tr').length).toBe(50);
    expect(byId('simulacion-limites')!.textContent).toContain('hubo más y no se incluyeron todos');
  });

  it('solo los casos propios ofrecen «¿Por qué?» y lo piden por su posición', async () => {
    await pintar(SIMULACION_CON_CAMBIOS, 1);
    expect(byId('caso-por-que-0')).not.toBeNull();
    expect(byId('caso-por-que-1')).toBeNull();
    const pedidos: number[] = [];
    fixture.componentInstance.explainScenario.subscribe((i) => pedidos.push(i));
    byId('caso-por-que-0')!.click();
    expect(pedidos).toEqual([0]);
  });

  it('el puntaje explica por qué pesa y lo que baja se dice «baja»', async () => {
    await pintar({
      ...SIMULACION_CON_CAMBIOS,
      governance: {
        ...SIMULACION_CON_CAMBIOS.governance,
        needsFourEyes: { required: false, reasons: [] },
        privilegeScore: { before: 50, after: 40, delta: -10 },
      },
    });
    expect(byId('simulacion-puntaje')!.textContent).toContain('baja 10');
    expect(byId('simulacion-puntaje')!.textContent).toContain('dinero o datos de pacientes');
    expect(byId('simulacion-cuatro-ojos')).toBeNull();
  });
});
