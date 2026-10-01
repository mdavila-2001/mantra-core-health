import { describeMechanic, describeNudge, formatMoney } from './describe-mechanic';
import type { DescribeContext } from './describe-mechanic';
import type { Mechanic, Nudge } from './promotion-mechanics.types';

const NAMES: Readonly<Record<string, string>> = { a: 'Ibuprofeno', b: 'Vitamina C' };
const CONTEXT: DescribeContext = { labelOf: (itemId) => NAMES[itemId] ?? null, currency: 'Bs' };

describe('formatMoney', () => {
  it('quita los decimales que sobran', () => {
    expect(formatMoney('10.00', 'Bs')).toBe('Bs 10');
    expect(formatMoney('10.50', 'Bs')).toBe('Bs 10.50');
    expect(formatMoney('10', 'Bs')).toBe('Bs 10');
  });

  it('un importe ilegible se muestra como vino, sin inventar un número', () => {
    expect(formatMoney('abc', 'Bs')).toBe('Bs abc');
  });
});

describe('describeMechanic', () => {
  const cases: readonly (readonly [string, Mechanic, string, string])[] = [
    [
      'PERCENT_OFF',
      { kind: 'PERCENT_OFF', percent: 20 },
      '20 % menos',
      '20 % de descuento en cada producto de la campaña.',
    ],
    [
      'CLEARANCE',
      { kind: 'CLEARANCE', percent: 35 },
      '35 % menos',
      'Vencimiento cercano: 35 % menos en estas unidades.',
    ],
    [
      'CAMPAIGN_PRICE',
      { kind: 'CAMPAIGN_PRICE', prices: {} },
      'Precio especial',
      'Cada producto tiene su precio de campaña, al lado del precio normal.',
    ],
    [
      'AMOUNT_OFF_PER_UNIT',
      { kind: 'AMOUNT_OFF_PER_UNIT', amount: '10.00' },
      'Bs 10 menos',
      'Bs 10 menos en cada unidad.',
    ],
    ['BUY_X_PAY_Y 2x1', { kind: 'BUY_X_PAY_Y', take: 2, pay: 1 }, '2x1', 'Llevá 2 y pagá 1.'],
    ['BUY_X_PAY_Y 3x2', { kind: 'BUY_X_PAY_Y', take: 3, pay: 2 }, '3x2', 'Llevá 3 y pagá 2.'],
    [
      'NTH_UNIT_PERCENT 2',
      { kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 },
      'Segunda al 50 %',
      'La segunda unidad con 50 % de descuento.',
    ],
    [
      'NTH_UNIT_PERCENT 4',
      { kind: 'NTH_UNIT_PERCENT', nth: 4, percent: 25 },
      '4.ª al 25 %',
      'La 4.ª unidad con 25 % de descuento.',
    ],
    [
      'VOLUME_TIERS',
      {
        kind: 'VOLUME_TIERS',
        tiers: [
          { minQuantity: 2, percent: 10 },
          { minQuantity: 3, percent: 15 },
        ],
      },
      'Más unidades, más descuento',
      'Cuantas más unidades llevás, más descuento: desde 2 unidades, 10 %; desde 3 unidades, 15 %.',
    ],
    [
      'ORDER_PERCENT_OVER',
      { kind: 'ORDER_PERCENT_OVER', minSpend: '200.00', percent: 10 },
      '10 % desde Bs 200',
      '10 % de descuento en tu compra desde Bs 200.',
    ],
    [
      'ORDER_AMOUNT_OVER',
      { kind: 'ORDER_AMOUNT_OVER', minSpend: '250.00', amount: '30.00' },
      'Bs 30 menos desde Bs 250',
      'Bs 30 menos en tu compra desde Bs 250.',
    ],
    [
      'SPEND_TIERS',
      {
        kind: 'SPEND_TIERS',
        tiers: [
          { minSpend: '100.00', percent: 5 },
          { minSpend: '200.00', percent: 10 },
        ],
      },
      'Más gastás, más ahorrás',
      'Cuanto más compres, más ahorrás: desde Bs 100, 5 %; desde Bs 200, 10 %.',
    ],
    [
      'BUNDLE_PRICE',
      { kind: 'BUNDLE_PRICE', bundlePrice: '60.00' },
      'Combo',
      'Combo a Bs 60: los productos de esta campaña, juntos.',
    ],
    [
      'GIFT_WITH_PURCHASE',
      { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' },
      'De regalo',
      'Comprando Ibuprofeno, Vitamina C de regalo.',
    ],
    [
      'BUY_A_GET_B_PERCENT',
      { kind: 'BUY_A_GET_B_PERCENT', triggerItemId: 'a', rewardItemId: 'b', percent: 30 },
      'Vitamina C al 30 %',
      'Comprando Ibuprofeno, Vitamina C con 30 % de descuento.',
    ],
    [
      'POINTS_MULTIPLIER',
      { kind: 'POINTS_MULTIPLIER', multiplier: 2 },
      'Puntos ×2',
      'Sumás 2 veces más puntos en esta compra.',
    ],
  ];

  it.each(cases)('%s', (_name, mechanic, badge, sentence) => {
    expect(describeMechanic(mechanic, CONTEXT)).toEqual({ badge, sentence });
  });

  it('un ítem sin nombre conocido se dice sin inventarle uno', () => {
    const description = describeMechanic(
      { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'x', rewardItemId: 'y' },
      CONTEXT,
    );
    expect(description.sentence).toBe('Comprando el producto elegido, el producto elegido de regalo.');
  });
});

describe('describeNudge', () => {
  it('dice cuánto falta para un porcentaje por compra mínima', () => {
    const nudge: Nudge = {
      kind: 'SPEND_MORE',
      campaignId: 'c',
      missingAmount: '23.00',
      reward: { kind: 'ORDER_PERCENT_OVER', minSpend: '200.00', percent: 10 },
    };
    expect(describeNudge(nudge, CONTEXT)).toBe('Te faltan Bs 23 para el 10 % de descuento.');
  });

  it('dice cuánto falta para un monto fijo y para el siguiente tramo', () => {
    expect(
      describeNudge(
        {
          kind: 'SPEND_MORE',
          campaignId: 'c',
          missingAmount: '5.50',
          reward: { kind: 'ORDER_AMOUNT_OVER', minSpend: '100.00', amount: '30.00' },
        },
        CONTEXT,
      ),
    ).toBe('Te faltan Bs 5.50 para que te descontemos Bs 30.');
    expect(
      describeNudge(
        {
          kind: 'SPEND_MORE',
          campaignId: 'c',
          missingAmount: '50.00',
          reward: { kind: 'SPEND_TIERS', tiers: [] },
        },
        CONTEXT,
      ),
    ).toBe('Te faltan Bs 50 para el siguiente descuento.');
  });

  it('dice cuántas unidades faltan, en singular y en plural', () => {
    const buy = (missingUnits: number): Nudge => ({
      kind: 'ADD_UNITS',
      campaignId: 'c',
      missingUnits,
      reward: { kind: 'BUY_X_PAY_Y', take: 3, pay: 2 },
    });
    expect(describeNudge(buy(1), CONTEXT)).toBe('Agregá 1 unidad más y llevás 3 pagando 2.');
    expect(describeNudge(buy(2), CONTEXT)).toBe('Agregá 2 unidades más y llevás 3 pagando 2.');
  });

  it('cubre la enésima unidad y los tramos por cantidad', () => {
    expect(
      describeNudge(
        {
          kind: 'ADD_UNITS',
          campaignId: 'c',
          missingUnits: 1,
          reward: { kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 },
        },
        CONTEXT,
      ),
    ).toBe('Agregá 1 unidad más y la segunda unidad sale con 50 % de descuento.');
    expect(
      describeNudge(
        { kind: 'ADD_UNITS', campaignId: 'c', missingUnits: 2, reward: { kind: 'VOLUME_TIERS', tiers: [] } },
        CONTEXT,
      ),
    ).toBe('Agregá 2 unidades más y mejorás tu descuento por cantidad.');
  });
});
