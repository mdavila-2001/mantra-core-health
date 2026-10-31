import { describe, expect, it } from 'vitest';

import { nodo } from '../flows.fixture';
import { planFlowOperations } from './flow-operations';

const declarado = (operationId: string | null) => ({
  method: 'POST',
  path: '/cobros/{id}',
  operationId,
  contract: 'DECLARED' as const,
});

describe('planFlowOperations', () => {
  it('cruza sólo los pasos que llaman a la API con un endpoint declarado y con operationId', () => {
    const plan = planFlowOperations([
      nodo('a', { endpoint: declarado('CobrosController_pagar') }),
      nodo('b', { kind: 'DECISION', endpoint: declarado('IgnoradoController_x') }),
      nodo('c', { kind: 'SCREEN' }),
    ]);
    expect(plan.calls.map((c) => c.operationId)).toEqual(['CobrosController_pagar']);
    expect(plan.uncrossable).toEqual([]);
  });

  it('un endpoint ausente del contrato y un paso sin endpoint no se cruzan, y dicen por qué', () => {
    const plan = planFlowOperations([
      nodo('x', { title: 'Reclamar', endpoint: { method: 'POST', path: '/reclamos', operationId: null, contract: 'MISSING' } }),
      nodo('y', { title: 'Emitir QR', gap: 'No hay endpoint que emita un QR.' }),
      nodo('z', { title: 'Sin nada' }),
    ]);
    expect(plan.calls).toEqual([]);
    expect(plan.uncrossable.map((u) => [u.step, u.reason])).toEqual([
      ['Reclamar', 'POST /reclamos no existe en el contrato de la API que se está leyendo.'],
      ['Emitir QR', 'No hay endpoint que emita un QR.'],
      ['Sin nada', 'El paso no declara un endpoint.'],
    ]);
  });

  it('un endpoint DECLARED sin operationId tampoco se cruza: no se adivina el id', () => {
    const plan = planFlowOperations([nodo('q', { endpoint: declarado(null) })]);
    expect(plan.calls).toEqual([]);
    expect(plan.uncrossable).toHaveLength(1);
  });

  it('dos pasos que llaman a la misma operación piden el inventario una sola vez', () => {
    const plan = planFlowOperations([
      nodo('a', { endpoint: declarado('CobrosController_pagar') }),
      nodo('b', { endpoint: declarado('CobrosController_pagar') }),
    ]);
    expect(plan.calls).toHaveLength(2);
    expect(plan.operationIds).toEqual(['CobrosController_pagar']);
  });

  it('sin nodos no hay nada que cruzar', () => {
    expect(planFlowOperations([])).toEqual({ calls: [], uncrossable: [], operationIds: [] });
  });
});
