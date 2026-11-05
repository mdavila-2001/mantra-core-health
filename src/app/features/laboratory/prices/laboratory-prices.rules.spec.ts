import { describe, expect, it } from 'vitest';

import type { LabService } from '../../../core/data-access/lab-portal/lab-portal.types';
import { alovidaPreview, changesOf, isUnchanged, withEdit, withoutIds } from './laboratory-prices.rules';

const priced = { id: 'a', name: 'Hemograma', price: '80.00', alovidaDiscountPercent: 10, alovidaPrice: '72.00' } as LabService;
const unpriced = { id: 'b', name: 'Tórax', price: null, alovidaDiscountPercent: null, alovidaPrice: null } as LabService;

describe('laboratory-prices.rules', () => {
  it('un servicio sin precio sigue sin cambios con la casilla vacía, y cambia con cualquier monto', () => {
    expect(isUnchanged(unpriced, { price: '', discount: '' })).toBe(true);
    expect(isUnchanged(unpriced, { price: '0', discount: '' })).toBe(false);
    expect(isUnchanged(priced, { price: '80,0', discount: '10' })).toBe(true);
    expect(isUnchanged(priced, { price: '', discount: '10' })).toBe(false);
  });

  it('withEdit agrega la fila escrita y la quita al volver al origen', () => {
    const edits = withEdit({}, priced, { price: '90', discount: '10' });
    expect(edits).toEqual({ a: { price: '90', discount: '10' } });
    expect(withEdit(edits, priced, { price: '80', discount: '10' })).toEqual({});
    expect(withoutIds({ a: { price: '1', discount: '' }, b: { price: '2', discount: '' } }, ['a'])).toEqual({
      b: { price: '2', discount: '' },
    });
  });

  it('la vista previa dice «sin precio», el cálculo de lo escrito, o que no se puede calcular', () => {
    expect(alovidaPreview(unpriced, undefined)).toBeNull();
    expect(alovidaPreview(priced, undefined)).toBe('72.00 Bs');
    expect(alovidaPreview(unpriced, { price: '100', discount: '' })).toBe('100.00 Bs');
    expect(alovidaPreview(priced, { price: '100', discount: '25' })).toBe('75.00 Bs');
    expect(alovidaPreview(priced, { price: 'cien', discount: '' })).toBe('invalid');
  });

  it('changesOf manda sólo lo editado, con dos decimales, y nombra lo mal escrito', () => {
    const result = changesOf([priced, unpriced], {
      a: { price: '1000000.5', discount: '' },
      b: { price: '120', discount: '5' },
    });
    expect(result.problems).toEqual([expect.stringContaining('«Hemograma»')]);
    expect(result.changes).toEqual([{ service: unpriced, changes: { price: '120.00', alovidaDiscountPercent: 5 } }]);
  });
});
