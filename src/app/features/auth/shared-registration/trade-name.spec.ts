import { describe, expect, it } from 'vitest';

import { MAX_TRADE_NAME, tradeNameControl, tradeNameField, tradeNameOf } from './trade-name';

describe('trade-name (shared by every organization sign-up)', () => {
  it('the control is optional and capped like the legal name', () => {
    const control = tradeNameControl();
    expect(control.valid).toBe(true);
    control.setValue('x'.repeat(MAX_TRADE_NAME + 1));
    expect(control.hasError('maxlength')).toBe(true);
  });

  it('the field is not required and says so in its label', () => {
    const campo = tradeNameField('registro-x-nombre-comercial', 'Imágenes del Oriente', 'los clientes');
    expect(campo.key).toBe('tradeName');
    expect(campo.required).toBeFalsy();
    expect(campo.label).toContain('(opcional)');
    expect(campo.hint).toContain('los clientes');
    expect(campo.testId).toBe('registro-x-nombre-comercial');
  });

  it('travels trimmed, and not at all when blank', () => {
    expect(tradeNameOf('  Lab del Sur  ')).toEqual({ tradeName: 'Lab del Sur' });
    expect(tradeNameOf('   ')).toEqual({});
  });
});
