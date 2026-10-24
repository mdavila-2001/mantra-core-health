import { NO_CONDITIONS } from './promotion-mechanics.types';
import type { CampaignDraft, Mechanic, PromotableItem } from './promotion-mechanics.types';
import { validateDraft } from './validate-draft';

const ITEM_A: PromotableItem = { itemId: 'a', label: 'A', detail: null, unitPrice: '10.00', currency: 'BOB' };
const ITEM_B: PromotableItem = { itemId: 'b', label: 'B', detail: null, unitPrice: '20.00', currency: 'BOB' };

function draft(mechanic: Mechanic, overrides: Partial<CampaignDraft> = {}): CampaignDraft {
  return {
    title: 'Campaña',
    from: new Date(2026, 9, 1),
    to: new Date(2026, 9, 31),
    mechanic,
    scope: { itemIds: ['a', 'b'], categoryIds: [], allItems: false },
    conditions: NO_CONDITIONS,
    items: [ITEM_A, ITEM_B],
    ...overrides,
  };
}

describe('validateDraft — comunes', () => {
  const ok: Mechanic = { kind: 'PERCENT_OFF', percent: 20 };

  it('un borrador correcto no tiene fallos', () => {
    expect(validateDraft(draft(ok))).toEqual([]);
  });

  it('pide título', () => {
    expect(validateDraft(draft(ok, { title: '   ' }))).toEqual(['MISSING_TITLE']);
  });

  it('distingue la fecha que falta de las fechas al revés', () => {
    expect(validateDraft(draft(ok, { from: null }))).toEqual(['MISSING_DATES']);
    expect(validateDraft(draft(ok, { from: new Date(2026, 9, 20), to: new Date(2026, 9, 10) }))).toEqual([
      'DATES_INVERTED',
    ]);
  });

  it('pide ítems cuando la mecánica actúa sobre ítems', () => {
    expect(
      validateDraft(draft(ok, { items: [], scope: { itemIds: [], categoryIds: [], allItems: false } })),
    ).toEqual(['NO_ITEMS']);
  });

  it('no pide ítems cuando el alcance es toda la tienda', () => {
    expect(
      validateDraft(draft(ok, { items: [], scope: { itemIds: [], categoryIds: [], allItems: true } })),
    ).toEqual([]);
  });

  it('las mecánicas de total no piden ítems', () => {
    const order: Mechanic = { kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 };
    expect(
      validateDraft(draft(order, { items: [], scope: { itemIds: [], categoryIds: [], allItems: false } })),
    ).toEqual([]);
  });

  it('rechaza monedas mezcladas', () => {
    const usd = { ...ITEM_B, currency: 'USD' };
    expect(validateDraft(draft(ok, { items: [ITEM_A, usd] }))).toEqual(['MIXED_CURRENCIES']);
  });

  it('dice todos los fallos juntos', () => {
    expect(validateDraft(draft({ kind: 'PERCENT_OFF', percent: 0 }, { title: '', from: null }))).toEqual([
      'MISSING_TITLE',
      'MISSING_DATES',
      'PERCENT_OUT_OF_RANGE',
    ]);
  });
});

describe('validateDraft — mecánicas', () => {
  const failures = (mechanic: Mechanic, overrides: Partial<CampaignDraft> = {}) =>
    validateDraft(draft(mechanic, overrides));

  it.each([0, 100, 1.5, -5])('PERCENT_OFF rechaza %s %', (percent) => {
    expect(failures({ kind: 'PERCENT_OFF', percent })).toEqual(['PERCENT_OUT_OF_RANGE']);
  });

  it.each([1, 50, 99])('PERCENT_OFF acepta %s %', (percent) => {
    expect(failures({ kind: 'PERCENT_OFF', percent })).toEqual([]);
  });

  it('CLEARANCE valida el porcentaje', () => {
    expect(failures({ kind: 'CLEARANCE', percent: 100 })).toEqual(['PERCENT_OUT_OF_RANGE']);
  });

  it.each(['', '0', '0.00', '-3', 'abc'])('AMOUNT_OFF_PER_UNIT rechaza «%s»', (amount) => {
    expect(failures({ kind: 'AMOUNT_OFF_PER_UNIT', amount })).toEqual(['AMOUNT_INVALID']);
  });

  it('AMOUNT_OFF_PER_UNIT no puede igualar o superar el precio de un ítem', () => {
    expect(failures({ kind: 'AMOUNT_OFF_PER_UNIT', amount: '9.99' })).toEqual([]);
    expect(failures({ kind: 'AMOUNT_OFF_PER_UNIT', amount: '10.00' })).toEqual(['AMOUNT_EXCEEDS_PRICE']);
    expect(failures({ kind: 'AMOUNT_OFF_PER_UNIT', amount: '25.00' })).toEqual(['AMOUNT_EXCEEDS_PRICE']);
  });

  it('exige el precio de lista de cada ítem en las mecánicas sobre ítems', () => {
    const noPrice = { ...ITEM_A, unitPrice: '' };
    expect(failures({ kind: 'PERCENT_OFF', percent: 20 }, { items: [noPrice, ITEM_B] })).toEqual([
      'LIST_PRICE_INVALID',
    ]);
    expect(failures({ kind: 'PERCENT_OFF', percent: 20 }, { items: [{ ...ITEM_A, unitPrice: '0' }] })).toEqual([
      'LIST_PRICE_INVALID',
    ]);
  });

  it('no repite el precio de lista ilegible como «precio no es un descuento»', () => {
    const noPrice = { ...ITEM_A, unitPrice: 'x' };
    expect(
      failures({ kind: 'CAMPAIGN_PRICE', prices: { a: '8.00', b: '15.00' } }, { items: [noPrice, ITEM_B] }),
    ).toEqual(['LIST_PRICE_INVALID']);
  });

  it('las mecánicas de total no piden precio de lista', () => {
    const noPrice = { ...ITEM_A, unitPrice: '' };
    expect(
      failures({ kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 }, { items: [noPrice] }),
    ).toEqual([]);
  });

  it('CAMPAIGN_PRICE exige un precio menor que el de lista para cada ítem', () => {
    expect(failures({ kind: 'CAMPAIGN_PRICE', prices: { a: '8.00', b: '15.00' } })).toEqual([]);
    expect(failures({ kind: 'CAMPAIGN_PRICE', prices: { a: '8.00', b: '20.00' } })).toEqual([
      'PRICE_NOT_A_DISCOUNT',
    ]);
    expect(failures({ kind: 'CAMPAIGN_PRICE', prices: { a: '8.00', b: '0' } })).toEqual([
      'PRICE_NOT_A_DISCOUNT',
    ]);
    expect(failures({ kind: 'CAMPAIGN_PRICE', prices: { a: '8.00' } })).toEqual(['PRICE_NOT_A_DISCOUNT']);
  });

  it.each([
    [2, 1, []],
    [3, 2, []],
    [2, 2, ['BUY_QUANTITIES_INVALID']],
    [2, 0, ['BUY_QUANTITIES_INVALID']],
    [1, 1, ['BUY_QUANTITIES_INVALID']],
    [21, 1, ['BUY_QUANTITIES_INVALID']],
    [2.5, 1, ['BUY_QUANTITIES_INVALID']],
  ])('BUY_X_PAY_Y con take=%s pay=%s', (take, pay, expected) => {
    expect(failures({ kind: 'BUY_X_PAY_Y', take, pay })).toEqual(expected);
  });

  it('NTH_UNIT_PERCENT exige una posición de 2 en adelante y un porcentaje válido', () => {
    expect(failures({ kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 })).toEqual([]);
    expect(failures({ kind: 'NTH_UNIT_PERCENT', nth: 1, percent: 50 })).toEqual(['NTH_INVALID']);
    expect(failures({ kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 100 })).toEqual(['PERCENT_OUT_OF_RANGE']);
  });

  describe('tramos', () => {
    it('VOLUME_TIERS no puede estar vacío', () => {
      expect(failures({ kind: 'VOLUME_TIERS', tiers: [] })).toEqual(['TIERS_EMPTY']);
    });

    it('VOLUME_TIERS tiene que subir en cantidad y en descuento', () => {
      const tiers = (a: [number, number], b: [number, number]) => ({
        kind: 'VOLUME_TIERS' as const,
        tiers: [
          { minQuantity: a[0], percent: a[1] },
          { minQuantity: b[0], percent: b[1] },
        ],
      });
      expect(failures(tiers([2, 10], [3, 15]))).toEqual([]);
      expect(failures(tiers([2, 10], [3, 5]))).toEqual(['TIERS_NOT_INCREASING']);
      expect(failures(tiers([3, 10], [2, 15]))).toEqual(['TIERS_NOT_INCREASING']);
      expect(failures(tiers([2, 10], [2, 15]))).toEqual(['TIERS_NOT_INCREASING']);
    });

    it('VOLUME_TIERS rechaza umbrales menores a 2 y porcentajes fuera de rango', () => {
      expect(failures({ kind: 'VOLUME_TIERS', tiers: [{ minQuantity: 1, percent: 10 }] })).toEqual([
        'MIN_SPEND_INVALID',
      ]);
      expect(failures({ kind: 'VOLUME_TIERS', tiers: [{ minQuantity: 2, percent: 100 }] })).toEqual([
        'PERCENT_OUT_OF_RANGE',
      ]);
    });

    it('SPEND_TIERS valida montos y orden', () => {
      expect(
        failures({
          kind: 'SPEND_TIERS',
          tiers: [
            { minSpend: '100.00', percent: 5 },
            { minSpend: '200.00', percent: 10 },
          ],
        }),
      ).toEqual([]);
      expect(
        failures({
          kind: 'SPEND_TIERS',
          tiers: [
            { minSpend: '200.00', percent: 5 },
            { minSpend: '100.00', percent: 10 },
          ],
        }),
      ).toEqual(['TIERS_NOT_INCREASING']);
      expect(failures({ kind: 'SPEND_TIERS', tiers: [{ minSpend: 'x', percent: 5 }] })).toEqual([
        'MIN_SPEND_INVALID',
      ]);
    });
  });

  it('ORDER_PERCENT_OVER valida mínimo y porcentaje', () => {
    expect(failures({ kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 })).toEqual([]);
    expect(failures({ kind: 'ORDER_PERCENT_OVER', minSpend: '0', percent: 0 })).toEqual([
      'MIN_SPEND_INVALID',
      'PERCENT_OUT_OF_RANGE',
    ]);
  });

  it('ORDER_AMOUNT_OVER valida mínimo y monto', () => {
    expect(failures({ kind: 'ORDER_AMOUNT_OVER', minSpend: '250.00', amount: '30.00' })).toEqual([]);
    expect(failures({ kind: 'ORDER_AMOUNT_OVER', minSpend: '', amount: '' })).toEqual([
      'MIN_SPEND_INVALID',
      'AMOUNT_INVALID',
    ]);
  });

  describe('combos', () => {
    it('BUNDLE_PRICE exige al menos dos ítems y un precio menor que la suma', () => {
      expect(failures({ kind: 'BUNDLE_PRICE', bundlePrice: '25.00' })).toEqual([]);
      expect(failures({ kind: 'BUNDLE_PRICE', bundlePrice: '30.00' })).toEqual(['BUNDLE_PRICE_NOT_A_DISCOUNT']);
      expect(
        failures(
          { kind: 'BUNDLE_PRICE', bundlePrice: '15.00' },
          { scope: { itemIds: ['a'], categoryIds: [], allItems: false } },
        ),
      ).toEqual(['BUNDLE_NEEDS_TWO_ITEMS', 'BUNDLE_PRICE_NOT_A_DISCOUNT']);
    });

    it('GIFT_WITH_PURCHASE exige disparador y premio distintos', () => {
      expect(failures({ kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' })).toEqual([]);
      expect(failures({ kind: 'GIFT_WITH_PURCHASE', triggerItemId: '', rewardItemId: 'b' })).toEqual([
        'TRIGGER_REWARD_MISSING',
      ]);
      expect(failures({ kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'a' })).toEqual([
        'TRIGGER_EQUALS_REWARD',
      ]);
    });

    it('BUY_A_GET_B_PERCENT suma la validación del porcentaje', () => {
      expect(
        failures({ kind: 'BUY_A_GET_B_PERCENT', triggerItemId: 'a', rewardItemId: 'b', percent: 30 }),
      ).toEqual([]);
      expect(
        failures({ kind: 'BUY_A_GET_B_PERCENT', triggerItemId: 'a', rewardItemId: 'a', percent: 0 }),
      ).toEqual(['TRIGGER_EQUALS_REWARD', 'PERCENT_OUT_OF_RANGE']);
    });
  });

  it.each([
    [2, []],
    [10, []],
    [1, ['MULTIPLIER_INVALID']],
    [11, ['MULTIPLIER_INVALID']],
    [2.5, ['MULTIPLIER_INVALID']],
  ])('POINTS_MULTIPLIER ×%s', (multiplier, expected) => {
    expect(failures({ kind: 'POINTS_MULTIPLIER', multiplier })).toEqual(expected);
  });
});

describe('validateDraft — condiciones', () => {
  const ok: Mechanic = { kind: 'PERCENT_OFF', percent: 20 };
  const withConditions = (conditions: Partial<typeof NO_CONDITIONS>) =>
    validateDraft(draft(ok, { conditions: { ...NO_CONDITIONS, ...conditions } }));

  it('valida el tope y el presupuesto', () => {
    expect(withConditions({ maxDiscount: '50.00' })).toEqual([]);
    expect(withConditions({ maxDiscount: '0' })).toEqual(['CAP_INVALID']);
    expect(withConditions({ budget: 'x' })).toEqual(['CAP_INVALID']);
  });

  it('valida los límites de uso', () => {
    expect(withConditions({ perPersonLimit: 1, availableUnits: 100 })).toEqual([]);
    expect(withConditions({ perPersonLimit: 0 })).toEqual(['LIMIT_INVALID']);
    expect(withConditions({ availableUnits: 1.5 })).toEqual(['LIMIT_INVALID']);
  });

  it('valida el código de cupón', () => {
    expect(withConditions({ couponCode: 'AHORRO-10' })).toEqual([]);
    expect(withConditions({ couponCode: 'ab' })).toEqual(['COUPON_INVALID']);
    expect(withConditions({ couponCode: 'con espacio' })).toEqual(['COUPON_INVALID']);
  });

  it('valida la franja horaria: los dos extremos, bien escritos y en orden', () => {
    expect(withConditions({ fromTime: '09:00', toTime: '18:00' })).toEqual([]);
    expect(withConditions({ fromTime: '09:00' })).toEqual(['TIME_WINDOW_INVALID']);
    expect(withConditions({ fromTime: '18:00', toTime: '09:00' })).toEqual(['TIME_WINDOW_INVALID']);
    expect(withConditions({ fromTime: '9:00', toTime: '18:00' })).toEqual(['TIME_WINDOW_INVALID']);
    expect(withConditions({ fromTime: '09:00', toTime: '24:00' })).toEqual(['TIME_WINDOW_INVALID']);
  });
});
