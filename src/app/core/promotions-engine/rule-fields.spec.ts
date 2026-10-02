import { validateDraft } from './validate-draft';
import { NO_CONDITIONS } from './promotion-mechanics.types';
import type { MechanicKind, PromotableItem } from './promotion-mechanics.types';
import { allowsAllItems, defaultRuleFields, ruleFromFields, withFamily, withKind } from './rule-fields';
import type { RuleFields } from './rule-fields';

const ITEM_A: PromotableItem = { itemId: 'a', label: 'A', detail: null, unitPrice: '10.00', currency: 'BOB' };
const ITEM_B: PromotableItem = { itemId: 'b', label: 'B', detail: null, unitPrice: '20.00', currency: 'BOB' };

function fields(cambios: Partial<RuleFields> = {}): RuleFields {
  return { ...defaultRuleFields(), ...cambios };
}

describe('ruleFromFields', () => {
  it('lo que arranca el formulario es un 20 % sin condiciones', () => {
    expect(ruleFromFields(defaultRuleFields())).toEqual({
      mechanic: { kind: 'PERCENT_OFF', percent: 20 },
      conditions: NO_CONDITIONS,
      allItems: false,
    });
  });

  it.each<readonly [MechanicKind, Partial<RuleFields>, object]>([
    ['CLEARANCE', { kind: 'CLEARANCE', percent: '35' }, { kind: 'CLEARANCE', percent: 35 }],
    ['AMOUNT_OFF_PER_UNIT', { kind: 'AMOUNT_OFF_PER_UNIT', amount: ' 3.5 ' }, { kind: 'AMOUNT_OFF_PER_UNIT', amount: '3.5' }],
    ['CAMPAIGN_PRICE', { kind: 'CAMPAIGN_PRICE' }, { kind: 'CAMPAIGN_PRICE', prices: {} }],
    ['BUY_X_PAY_Y', { kind: 'BUY_X_PAY_Y', take: '3', pay: '2' }, { kind: 'BUY_X_PAY_Y', take: 3, pay: 2 }],
    ['NTH_UNIT_PERCENT', { kind: 'NTH_UNIT_PERCENT', nth: '2', percent: '50' }, { kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 }],
    ['ORDER_PERCENT_OVER', { kind: 'ORDER_PERCENT_OVER', minSpend: '200', percent: '10' }, { kind: 'ORDER_PERCENT_OVER', minSpend: '200', percent: 10 }],
    ['ORDER_AMOUNT_OVER', { kind: 'ORDER_AMOUNT_OVER', minSpend: '250', amount: '30' }, { kind: 'ORDER_AMOUNT_OVER', minSpend: '250', amount: '30' }],
    ['BUNDLE_PRICE', { kind: 'BUNDLE_PRICE', bundlePrice: ' 24.00 ' }, { kind: 'BUNDLE_PRICE', bundlePrice: '24.00' }],
    ['POINTS_MULTIPLIER', { kind: 'POINTS_MULTIPLIER', multiplier: '3' }, { kind: 'POINTS_MULTIPLIER', multiplier: 3 }],
    [
      'GIFT_WITH_PURCHASE',
      { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' },
      { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' },
    ],
    [
      'BUY_A_GET_B_PERCENT',
      { kind: 'BUY_A_GET_B_PERCENT', triggerItemId: 'a', rewardItemId: 'b', percent: '30' },
      { kind: 'BUY_A_GET_B_PERCENT', triggerItemId: 'a', rewardItemId: 'b', percent: 30 },
    ],
  ])('%s', (_kind, cambios, esperada) => {
    expect(ruleFromFields(fields(cambios)).mechanic).toEqual(esperada);
  });

  it('un disparador o premio sin elegir llega vacío, y el validador lo dice', () => {
    const { mechanic } = ruleFromFields(fields({ kind: 'GIFT_WITH_PURCHASE' }));

    expect(mechanic).toEqual({ kind: 'GIFT_WITH_PURCHASE', triggerItemId: '', rewardItemId: '' });
  });

  it('convierte las filas de tramos', () => {
    expect(ruleFromFields(fields({ kind: 'VOLUME_TIERS' })).mechanic).toEqual({
      kind: 'VOLUME_TIERS',
      tiers: [
        { minQuantity: 2, percent: 10 },
        { minQuantity: 3, percent: 15 },
      ],
    });
    expect(ruleFromFields(fields({ kind: 'SPEND_TIERS' })).mechanic).toEqual({
      kind: 'SPEND_TIERS',
      tiers: [
        { minSpend: '100', percent: 5 },
        { minSpend: '200', percent: 10 },
      ],
    });
  });

  describe('lo que se escribe a medias no se convierte en un valor válido', () => {
    it.each(['', ' ', '1.5', 'abc', '-3', '2 0'])('el porcentaje «%s» no es un entero', (texto) => {
      const { mechanic } = ruleFromFields(fields({ percent: texto }));

      expect(mechanic.kind === 'PERCENT_OFF' && Number.isNaN(mechanic.percent)).toBe(true);
    });

    it('un porcentaje con espacios se lee', () => {
      expect(ruleFromFields(fields({ percent: ' 20 ' })).mechanic).toEqual({ kind: 'PERCENT_OFF', percent: 20 });
    });
  });

  describe('las condiciones', () => {
    it('un campo vacío es «no puso nada», no cero', () => {
      const { conditions } = ruleFromFields(fields({ maxDiscount: '  ', perPersonLimit: '', couponCode: ' ' }));

      expect(conditions).toMatchObject({ maxDiscount: null, perPersonLimit: null, couponCode: null });
    });

    it('convierte lo escrito', () => {
      const { conditions } = ruleFromFields(
        fields({
          maxDiscount: '50.00',
          perPersonLimit: '2',
          availableUnits: '100',
          budget: '5000',
          couponCode: ' AHORRO10 ',
          fromTime: '09:00',
          toTime: '18:00',
          stackable: false,
        }),
      );

      expect(conditions).toEqual({
        maxDiscount: '50.00',
        perPersonLimit: 2,
        availableUnits: 100,
        budget: '5000',
        couponCode: 'AHORRO10',
        weekdays: [],
        fromTime: '09:00',
        toTime: '18:00',
        stackable: false,
      });
    });

    it('un límite mal escrito no desaparece: llega como NaN y el validador lo rechaza', () => {
      const { conditions } = ruleFromFields(fields({ perPersonLimit: 'x' }));

      expect(Number.isNaN(conditions.perPersonLimit)).toBe(true);
    });

    it('los días de la semana salen ordenados y como números', () => {
      expect(ruleFromFields(fields({ weekdays: ['6', '0', '3'] })).conditions.weekdays).toEqual([0, 3, 6]);
    });
  });

  describe('toda la tienda', () => {
    it.each<MechanicKind>(['PERCENT_OFF', 'CLEARANCE', 'AMOUNT_OFF_PER_UNIT'])('%s lo admite', (kind) => {
      expect(allowsAllItems(kind)).toBe(true);
      expect(ruleFromFields(fields({ kind, allItems: true })).allItems).toBe(true);
    });

    it.each<MechanicKind>(['BUY_X_PAY_Y', 'BUNDLE_PRICE', 'GIFT_WITH_PURCHASE', 'CAMPAIGN_PRICE'])(
      '%s no: hay que decir sobre qué',
      (kind) => {
        expect(allowsAllItems(kind)).toBe(false);
        expect(ruleFromFields(fields({ kind, allItems: true })).allItems).toBe(false);
      },
    );
  });
});

describe('cambiar de familia y de mecánica', () => {
  it('elegir otra familia ofrece su primera mecánica', () => {
    expect(withFamily(fields(), 'QUANTITY')).toMatchObject({ family: 'QUANTITY', kind: 'BUY_X_PAY_Y' });
    expect(withFamily(fields(), 'LOYALTY')).toMatchObject({ family: 'LOYALTY', kind: 'POINTS_MULTIPLIER' });
  });

  it('elegir la misma familia no cambia nada', () => {
    const antes = fields();

    expect(withFamily(antes, 'PRICE')).toBe(antes);
  });

  it('elegir una mecánica deja la familia que le corresponde', () => {
    expect(withKind(fields(), 'SPEND_TIERS')).toMatchObject({ family: 'ORDER_TOTAL', kind: 'SPEND_TIERS' });
  });

  it('probar otra mecánica no borra lo que se había escrito', () => {
    const escrito = fields({ percent: '33', bundlePrice: '60' });
    const vuelta = withKind(withKind(escrito, 'BUY_X_PAY_Y'), 'PERCENT_OFF');

    expect(vuelta.percent).toBe('33');
    expect(vuelta.bundlePrice).toBe('60');
  });
});

describe('contra el validador', () => {
  const items = [ITEM_A, ITEM_B];
  const borrador = (campos: RuleFields) => {
    const regla = ruleFromFields(campos);
    return {
      title: 'Campaña',
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31),
      mechanic: regla.mechanic,
      conditions: regla.conditions,
      scope: { itemIds: items.map((item) => item.itemId), categoryIds: [], allItems: regla.allItems },
      items,
    };
  };

  it('el formulario recién abierto ya es una campaña válida', () => {
    expect(validateDraft(borrador(defaultRuleFields()))).toEqual([]);
  });

  it('un porcentaje vacío se dice como fuera de rango', () => {
    expect(validateDraft(borrador(fields({ percent: '' })))).toEqual(['PERCENT_OUT_OF_RANGE']);
  });

  it('un 3x3 mal escrito se rechaza', () => {
    expect(validateDraft(borrador(fields({ kind: 'BUY_X_PAY_Y', take: '3', pay: '3' })))).toEqual([
      'BUY_QUANTITIES_INVALID',
    ]);
  });

  it('un regalo sin elegir se rechaza', () => {
    expect(validateDraft(borrador(fields({ kind: 'GIFT_WITH_PURCHASE' })))).toEqual(['TRIGGER_REWARD_MISSING']);
  });

  it('un límite escrito con letras se rechaza', () => {
    expect(validateDraft(borrador(fields({ availableUnits: '10 u' })))).toEqual(['LIMIT_INVALID']);
  });
});
