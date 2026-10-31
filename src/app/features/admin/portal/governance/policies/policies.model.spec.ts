import { policyControl, policyFacts, policyQuery, policyState } from './policies.model';

describe('policies.model', () => {
  it('policyControl no inventa un plazo de retención ni un cero', () => {
    expect(
      policyControl({
        type: 'RETENTION',
        attributes: { retentionPeriodDays: null, disposition: 'Archivar' },
      }),
    ).toBe('Sin plazo declarado · al vencer: Archivar');
    expect(
      policyControl({
        type: 'RETENTION',
        attributes: { retentionPeriodDays: 0, disposition: null },
      }),
    ).toContain('0 días');
  });

  it('policyFacts escribe sí/no/sin declarar y respeta el orden de la API', () => {
    const facts = policyFacts({
      attributes: { dualControl: false, maxBatchSize: null, requiresReason: true, rank: 50 },
    });
    expect(facts.map((f) => [f.etiqueta, f.valor])).toEqual([
      ['Doble control', 'No'],
      ['Máximo por lote', 'Sin declarar'],
      ['Exige motivo', 'Sí'],
      ['Nivel (orden)', '50'],
    ]);
  });

  it('policyState distingue vigente de borrador y deja sin estado lo que la API no informa', () => {
    expect(policyState({ stateCode: 'ACTIVE', stateLabel: 'Activo' })).toEqual({
      label: 'Activo',
      tone: 'success',
    });
    expect(policyState({ stateCode: 'DRAFT', stateLabel: null }).tone).toBe('warning');
    expect(policyState({ stateCode: null, stateLabel: null }).label).toBe('Sin estado');
  });

  it('policyQuery quita los filtros vacíos y un tipo desconocido', () => {
    expect(policyQuery({ q: '', type: '' })).toEqual({});
    expect(policyQuery({ q: 'x', type: 'WRITE' })).toEqual({ q: 'x', type: 'WRITE' });
    expect(policyQuery({ q: '', type: 'NOPE' })).toEqual({});
  });
});
