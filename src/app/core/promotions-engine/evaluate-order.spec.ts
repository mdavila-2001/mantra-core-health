import { evaluateOrder } from './evaluate-order';
import { NO_CONDITIONS } from './promotion-mechanics.types';
import type {
  CampaignConditions,
  CampaignScope,
  EvaluationResult,
  Mechanic,
  OrderLine,
  PromotionCampaign,
} from './promotion-mechanics.types';

/** Jueves 15 de octubre de 2026, mediodía. Dentro de la vigencia por defecto. */
const NOW = new Date(2026, 9, 15, 12, 0);

const SCOPE_A: CampaignScope = { itemIds: ['a'], categoryIds: [], allItems: false };
const SCOPE_ALL: CampaignScope = { itemIds: [], categoryIds: [], allItems: true };

function campaign(
  id: string,
  mechanic: Mechanic,
  overrides: {
    scope?: CampaignScope;
    conditions?: Partial<CampaignConditions>;
    from?: Date;
    to?: Date;
  } = {},
): PromotionCampaign {
  return {
    id,
    mechanic,
    from: overrides.from ?? new Date(2026, 9, 1),
    to: overrides.to ?? new Date(2026, 9, 31),
    scope: overrides.scope ?? SCOPE_A,
    conditions: { ...NO_CONDITIONS, ...overrides.conditions },
  };
}

function line(itemId: string, quantity: number, unitPrice: string, categoryId?: string): OrderLine {
  return { itemId, quantity, unitPrice, categoryId };
}

function run(
  campaigns: readonly PromotionCampaign[],
  lines: readonly OrderLine[],
  context: { now?: Date; couponCodes?: readonly string[] } = {},
): EvaluationResult {
  return evaluateOrder(campaigns, lines, { now: context.now ?? NOW, couponCodes: context.couponCodes });
}

function lineOf(result: EvaluationResult, itemId: string) {
  const found = result.lines.find((candidate) => candidate.itemId === itemId);
  if (found === undefined) {
    throw new Error(`No hay renglón ${itemId} en el resultado.`);
  }
  return found;
}

describe('evaluateOrder — mecánicas de precio', () => {
  it('PERCENT_OFF descuenta el porcentaje en cada unidad', () => {
    const result = run([campaign('c', { kind: 'PERCENT_OFF', percent: 20 })], [line('a', 2, '10.00')]);
    expect(lineOf(result, 'a')).toMatchObject({ discount: '4.00', total: '16.00', campaignId: 'c' });
    expect(result.total).toBe('16.00');
  });

  it('redondea a favor de quien compra: 33 % de 10.01 deja el precio en 6.70', () => {
    const result = run([campaign('c', { kind: 'PERCENT_OFF', percent: 33 })], [line('a', 1, '10.01')]);
    expect(lineOf(result, 'a').discount).toBe('3.31');
    expect(lineOf(result, 'a').total).toBe('6.70');
  });

  it('CLEARANCE se calcula como un porcentaje', () => {
    const result = run([campaign('c', { kind: 'CLEARANCE', percent: 35 })], [line('a', 1, '20.00')]);
    expect(lineOf(result, 'a').discount).toBe('7.00');
  });

  it('CAMPAIGN_PRICE rebaja hasta el precio de campaña, por unidad', () => {
    const result = run(
      [campaign('c', { kind: 'CAMPAIGN_PRICE', prices: { a: '8.00' } })],
      [line('a', 3, '10.00')],
    );
    expect(lineOf(result, 'a')).toMatchObject({ discount: '6.00', total: '24.00' });
  });

  it('CAMPAIGN_PRICE no sube un precio: si el de lista bajó por debajo, no descuenta', () => {
    const result = run(
      [campaign('c', { kind: 'CAMPAIGN_PRICE', prices: { a: '8.00' } })],
      [line('a', 1, '7.00')],
    );
    expect(lineOf(result, 'a')).toMatchObject({ discount: '0.00', campaignId: null });
  });

  it('AMOUNT_OFF_PER_UNIT descuenta el monto en cada unidad', () => {
    const result = run(
      [campaign('c', { kind: 'AMOUNT_OFF_PER_UNIT', amount: '3.00' })],
      [line('a', 2, '10.00')],
    );
    expect(lineOf(result, 'a').discount).toBe('6.00');
  });

  it('AMOUNT_OFF_PER_UNIT nunca deja un renglón en negativo', () => {
    const result = run(
      [campaign('c', { kind: 'AMOUNT_OFF_PER_UNIT', amount: '15.00' })],
      [line('a', 1, '10.00')],
    );
    expect(lineOf(result, 'a')).toMatchObject({ discount: '10.00', total: '0.00' });
  });
});

describe('evaluateOrder — mecánicas de cantidad', () => {
  const twoForOne = campaign('c', { kind: 'BUY_X_PAY_Y', take: 2, pay: 1 });

  it('2x1 cuenta lotes enteros: 3 unidades regalan una, no una y media', () => {
    expect(lineOf(run([twoForOne], [line('a', 3, '10.00')]), 'a').discount).toBe('10.00');
  });

  it('2x1 con 4 unidades regala dos', () => {
    expect(lineOf(run([twoForOne], [line('a', 4, '10.00')]), 'a').discount).toBe('20.00');
  });

  it('2x1 con una sola unidad no descuenta y avisa que falta una', () => {
    const result = run([twoForOne], [line('a', 1, '10.00')]);
    expect(lineOf(result, 'a').discount).toBe('0.00');
    expect(result.nudges).toEqual([
      { kind: 'ADD_UNITS', campaignId: 'c', missingUnits: 1, reward: twoForOne.mechanic },
    ]);
  });

  it('3x2 regala una unidad cada tres', () => {
    const result = run(
      [campaign('c', { kind: 'BUY_X_PAY_Y', take: 3, pay: 2 })],
      [line('a', 6, '9.00')],
    );
    expect(lineOf(result, 'a').discount).toBe('18.00');
  });

  it('con ítems distintos en el alcance, lo gratis es lo más barato de cada lote', () => {
    const result = run(
      [campaign('c', { kind: 'BUY_X_PAY_Y', take: 2, pay: 1 }, { scope: SCOPE_ALL })],
      [line('a', 1, '10.00'), line('b', 1, '6.00')],
    );
    expect(lineOf(result, 'a').discount).toBe('0.00');
    expect(lineOf(result, 'b').discount).toBe('6.00');
  });

  it('NTH_UNIT_PERCENT: la segunda unidad al 50 %', () => {
    const second = campaign('c', { kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 });
    expect(lineOf(run([second], [line('a', 2, '10.00')]), 'a').discount).toBe('5.00');
    expect(lineOf(run([second], [line('a', 3, '10.00')]), 'a').discount).toBe('5.00');
    expect(lineOf(run([second], [line('a', 4, '10.00')]), 'a').discount).toBe('10.00');
  });

  describe('VOLUME_TIERS', () => {
    const tiers = campaign('c', {
      kind: 'VOLUME_TIERS',
      tiers: [
        { minQuantity: 2, percent: 10 },
        { minQuantity: 3, percent: 15 },
      ],
    });

    it('con una unidad no descuenta y avisa cuántas faltan para el primer tramo', () => {
      const result = run([tiers], [line('a', 1, '10.00')]);
      expect(lineOf(result, 'a').discount).toBe('0.00');
      expect(result.nudges).toMatchObject([{ kind: 'ADD_UNITS', missingUnits: 1 }]);
    });

    it('aplica el tramo alcanzado a todas las unidades', () => {
      expect(lineOf(run([tiers], [line('a', 2, '10.00')]), 'a').discount).toBe('2.00');
      expect(lineOf(run([tiers], [line('a', 3, '10.00')]), 'a').discount).toBe('4.50');
      expect(lineOf(run([tiers], [line('a', 5, '10.00')]), 'a').discount).toBe('7.50');
    });

    it('avisa cuántas unidades faltan para el tramo siguiente', () => {
      const result = run([tiers], [line('a', 2, '10.00')]);
      expect(result.nudges).toMatchObject([{ kind: 'ADD_UNITS', missingUnits: 1 }]);
    });
  });
});

describe('evaluateOrder — mecánicas sobre el total', () => {
  it('ORDER_PERCENT_OVER descuenta cuando la compra llega al mínimo', () => {
    const result = run(
      [campaign('c', { kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 })],
      [line('x', 12, '10.00')],
    );
    expect(result.orderDiscounts).toEqual([{ campaignId: 'c', amount: '12.00' }]);
    expect(result.total).toBe('108.00');
  });

  it('un mínimo no alcanzado no descuenta y avisa cuánto falta', () => {
    const mechanic: Mechanic = { kind: 'ORDER_PERCENT_OVER', minSpend: '100.00', percent: 10 };
    const result = run([campaign('c', mechanic)], [line('x', 9, '10.00')]);
    expect(result.orderDiscounts).toEqual([]);
    expect(result.nudges).toEqual([
      { kind: 'SPEND_MORE', campaignId: 'c', missingAmount: '10.00', reward: mechanic },
    ]);
  });

  it('ORDER_AMOUNT_OVER descuenta el monto fijo', () => {
    const result = run(
      [campaign('c', { kind: 'ORDER_AMOUNT_OVER', minSpend: '250.00', amount: '30.00' })],
      [line('x', 30, '10.00')],
    );
    expect(result.orderDiscounts).toEqual([{ campaignId: 'c', amount: '30.00' }]);
  });

  it('un monto fijo nunca supera lo que se paga', () => {
    const result = run(
      [campaign('c', { kind: 'ORDER_AMOUNT_OVER', minSpend: '1.00', amount: '30.00' })],
      [line('x', 1, '10.00')],
    );
    expect(result.total).toBe('0.00');
  });

  describe('SPEND_TIERS', () => {
    const tiers = campaign('c', {
      kind: 'SPEND_TIERS',
      tiers: [
        { minSpend: '100.00', percent: 5 },
        { minSpend: '200.00', percent: 10 },
      ],
    });

    it('aplica el tramo más alto alcanzado', () => {
      expect(run([tiers], [line('x', 15, '10.00')]).orderDiscounts[0].amount).toBe('7.50');
      expect(run([tiers], [line('x', 25, '10.00')]).orderDiscounts[0].amount).toBe('25.00');
    });

    it('por debajo del primer tramo no descuenta', () => {
      expect(run([tiers], [line('x', 5, '10.00')]).orderDiscounts).toEqual([]);
    });

    it('avisa cuánto falta para el tramo siguiente', () => {
      const result = run([tiers], [line('x', 15, '10.00')]);
      expect(result.nudges).toMatchObject([{ kind: 'SPEND_MORE', missingAmount: '50.00' }]);
    });
  });

  it('el mínimo se mide sobre lo ya rebajado por las campañas de ítem', () => {
    const result = run(
      [
        campaign('items', { kind: 'PERCENT_OFF', percent: 50 }, { scope: SCOPE_ALL }),
        campaign('total', { kind: 'ORDER_AMOUNT_OVER', minSpend: '80.00', amount: '5.00' }),
      ],
      [line('x', 10, '10.00')],
    );
    // 100 de lista, 50 tras la campaña de ítems: no llega a 80.
    expect(result.orderDiscounts).toEqual([]);
    expect(result.nudges).toMatchObject([{ kind: 'SPEND_MORE', missingAmount: '30.00' }]);
  });
});

describe('evaluateOrder — combos y regalos', () => {
  const bundle = (price: string) =>
    campaign('c', { kind: 'BUNDLE_PRICE', bundlePrice: price }, {
      scope: { itemIds: ['a', 'b'], categoryIds: [], allItems: false },
    });

  it('BUNDLE_PRICE reparte el ahorro en proporción al precio', () => {
    const result = run([bundle('24.00')], [line('a', 1, '10.00'), line('b', 1, '20.00')]);
    expect(lineOf(result, 'a').discount).toBe('2.00');
    expect(lineOf(result, 'b').discount).toBe('4.00');
    expect(result.total).toBe('24.00');
  });

  it('BUNDLE_PRICE reparte el resto de la división para que la suma sea exacta', () => {
    const result = run(
      [
        campaign('c', { kind: 'BUNDLE_PRICE', bundlePrice: '2.00' }, {
          scope: { itemIds: ['a', 'b', 'c'], categoryIds: [], allItems: false },
        }),
      ],
      [line('a', 1, '1.00'), line('b', 1, '1.00'), line('c', 1, '1.00')],
    );
    expect(result.totalDiscount).toBe('1.00');
    expect(result.total).toBe('2.00');
  });

  it('BUNDLE_PRICE se aplica tantas veces como alcance el ítem del que menos hay', () => {
    const result = run([bundle('24.00')], [line('a', 2, '10.00'), line('b', 1, '20.00')]);
    expect(result.totalDiscount).toBe('6.00');
  });

  it('BUNDLE_PRICE no se aplica si falta un ítem del combo', () => {
    const result = run([bundle('24.00')], [line('a', 2, '10.00')]);
    expect(result.totalDiscount).toBe('0.00');
  });

  it('GIFT_WITH_PURCHASE regala una unidad del premio por cada una del disparador', () => {
    const gift = campaign('c', { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' });
    expect(lineOf(run([gift], [line('a', 1, '20.00'), line('b', 1, '5.00')]), 'b').discount).toBe('5.00');
    expect(lineOf(run([gift], [line('a', 2, '20.00'), line('b', 1, '5.00')]), 'b').discount).toBe('5.00');
    expect(lineOf(run([gift], [line('a', 1, '20.00'), line('b', 3, '5.00')]), 'b').discount).toBe('5.00');
  });

  it('GIFT_WITH_PURCHASE no regala nada si falta el disparador', () => {
    const gift = campaign('c', { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' });
    expect(run([gift], [line('b', 1, '5.00')]).totalDiscount).toBe('0.00');
  });

  it('BUY_A_GET_B_PERCENT descuenta el porcentaje en el premio', () => {
    const offer = campaign('c', {
      kind: 'BUY_A_GET_B_PERCENT',
      triggerItemId: 'a',
      rewardItemId: 'b',
      percent: 30,
    });
    expect(lineOf(run([offer], [line('a', 1, '20.00'), line('b', 1, '10.00')]), 'b').discount).toBe('3.00');
  });
});

describe('evaluateOrder — fidelización', () => {
  it('POINTS_MULTIPLIER no toca el precio y devuelve el multiplicador', () => {
    const result = run(
      [campaign('c', { kind: 'POINTS_MULTIPLIER', multiplier: 2 })],
      [line('a', 1, '10.00')],
    );
    expect(result.pointsMultiplier).toBe(2);
    expect(result.totalDiscount).toBe('0.00');
  });

  it('con varias, gana el multiplicador más alto', () => {
    const result = run(
      [
        campaign('c1', { kind: 'POINTS_MULTIPLIER', multiplier: 2 }),
        campaign('c2', { kind: 'POINTS_MULTIPLIER', multiplier: 3 }),
      ],
      [line('a', 1, '10.00')],
    );
    expect(result.pointsMultiplier).toBe(3);
  });

  it('sin campañas de puntos el multiplicador es nulo', () => {
    expect(run([], [line('a', 1, '10.00')]).pointsMultiplier).toBeNull();
  });
});

describe('evaluateOrder — vigencia y condiciones', () => {
  const tenOff = { kind: 'PERCENT_OFF', percent: 10 } as const;

  it('una campaña terminada no descuenta', () => {
    const ended = campaign('c', tenOff, { from: new Date(2026, 9, 1), to: new Date(2026, 9, 14) });
    expect(run([ended], [line('a', 1, '10.00')]).totalDiscount).toBe('0.00');
  });

  it('una campaña que todavía no empezó no descuenta', () => {
    const scheduled = campaign('c', tenOff, { from: new Date(2026, 9, 16), to: new Date(2026, 9, 30) });
    expect(run([scheduled], [line('a', 1, '10.00')]).totalDiscount).toBe('0.00');
  });

  it('el último día cuenta entero, hasta el último minuto', () => {
    const lastDay = campaign('c', tenOff, {
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 15, 12, 0),
    });
    const lateNight = new Date(2026, 9, 15, 23, 59);
    expect(run([lastDay], [line('a', 1, '10.00')], { now: lateNight }).totalDiscount).toBe('1.00');
  });

  it('respeta los días de la semana', () => {
    const mondays = campaign('c', tenOff, { conditions: { weekdays: [1] } });
    const thursdays = campaign('c', tenOff, { conditions: { weekdays: [4] } });
    expect(run([mondays], [line('a', 1, '10.00')]).totalDiscount).toBe('0.00');
    expect(run([thursdays], [line('a', 1, '10.00')]).totalDiscount).toBe('1.00');
  });

  it('respeta la franja horaria: [desde, hasta)', () => {
    const morning = campaign('c', tenOff, { conditions: { fromTime: '09:00', toTime: '11:00' } });
    const at = (hours: number, minutes: number) => new Date(2026, 9, 15, hours, minutes);
    const order = [line('a', 1, '10.00')];
    expect(run([morning], order, { now: at(8, 59) }).totalDiscount).toBe('0.00');
    expect(run([morning], order, { now: at(9, 0) }).totalDiscount).toBe('1.00');
    expect(run([morning], order, { now: at(10, 30) }).totalDiscount).toBe('1.00');
    expect(run([morning], order, { now: at(11, 0) }).totalDiscount).toBe('0.00');
  });

  it('una campaña con cupón sólo vale si el pedido lo trae, sin importar mayúsculas', () => {
    const coupon = campaign('c', tenOff, { conditions: { couponCode: 'AHORRO10' } });
    const order = [line('a', 1, '10.00')];
    expect(run([coupon], order).totalDiscount).toBe('0.00');
    expect(run([coupon], order, { couponCodes: ['otro'] }).totalDiscount).toBe('0.00');
    expect(run([coupon], order, { couponCodes: [' ahorro10 '] }).totalDiscount).toBe('1.00');
  });

  it('el tope limita lo que da la campaña', () => {
    const capped = campaign('c', { kind: 'PERCENT_OFF', percent: 50 }, { conditions: { maxDiscount: '8.00' } });
    const result = run([capped], [line('a', 4, '10.00')]);
    expect(lineOf(result, 'a').discount).toBe('8.00');
    expect(result.total).toBe('32.00');
  });

  it('el tope también limita a las campañas de total', () => {
    const capped = campaign(
      'c',
      { kind: 'ORDER_PERCENT_OVER', minSpend: '10.00', percent: 50 },
      { conditions: { maxDiscount: '5.00' } },
    );
    expect(run([capped], [line('x', 4, '10.00')]).orderDiscounts).toEqual([
      { campaignId: 'c', amount: '5.00' },
    ]);
  });
});

describe('evaluateOrder — alcance', () => {
  const tenOff = { kind: 'PERCENT_OFF', percent: 10 } as const;

  it('un ítem fuera del alcance no se toca', () => {
    const result = run([campaign('c', tenOff)], [line('a', 1, '10.00'), line('z', 1, '10.00')]);
    expect(lineOf(result, 'z')).toMatchObject({ discount: '0.00', campaignId: null });
  });

  it('el alcance puede ser una categoría', () => {
    const byCategory = campaign('c', tenOff, {
      scope: { itemIds: [], categoryIds: ['vitaminas'], allItems: false },
    });
    const result = run([byCategory], [line('a', 1, '10.00', 'vitaminas'), line('z', 1, '10.00', 'otra')]);
    expect(lineOf(result, 'a').discount).toBe('1.00');
    expect(lineOf(result, 'z').discount).toBe('0.00');
  });

  it('el alcance puede ser toda la tienda', () => {
    const result = run([campaign('c', tenOff, { scope: SCOPE_ALL })], [line('a', 1, '10.00'), line('z', 1, '10.00')]);
    expect(result.totalDiscount).toBe('2.00');
  });
});

describe('evaluateOrder — qué campaña gana', () => {
  it('un renglón pertenece a una sola campaña de ítem: gana la de mayor ahorro', () => {
    const result = run(
      [
        campaign('chica', { kind: 'PERCENT_OFF', percent: 10 }),
        campaign('grande', { kind: 'PERCENT_OFF', percent: 30 }),
      ],
      [line('a', 1, '10.00')],
    );
    expect(lineOf(result, 'a')).toMatchObject({ discount: '3.00', campaignId: 'grande' });
  });

  it('un combo se aplica entero o no se aplica: si un ítem ya está tomado, queda sin descuento', () => {
    const bundleScope = { itemIds: ['a', 'b'], categoryIds: [], allItems: false };
    const result = run(
      [
        campaign('combo', { kind: 'BUNDLE_PRICE', bundlePrice: '28.00' }, { scope: bundleScope }),
        campaign('mitad', { kind: 'PERCENT_OFF', percent: 50 }),
      ],
      [line('a', 1, '10.00'), line('b', 1, '20.00')],
    );
    // El 50 % sobre `a` ahorra 5.00; el combo, 2.00: gana el 50 % y el combo no entra.
    expect(lineOf(result, 'a').campaignId).toBe('mitad');
    expect(lineOf(result, 'b')).toMatchObject({ discount: '0.00', campaignId: null });
  });

  it('ítem + total se suman cuando todas son combinables, midiendo el mínimo sobre lo rebajado', () => {
    const result = run(
      [
        campaign('items', { kind: 'PERCENT_OFF', percent: 10 }, { scope: SCOPE_ALL }),
        campaign('total', { kind: 'ORDER_PERCENT_OVER', minSpend: '50.00', percent: 10 }),
      ],
      [line('x', 10, '10.00')],
    );
    // 100 → 90 tras el 10 % de ítems → 10 % de 90 = 9.00 → 81.00.
    expect(result.orderDiscounts).toEqual([{ campaignId: 'total', amount: '9.00' }]);
    expect(result.total).toBe('81.00');
  });

  it('si la de total no es combinable, gana el escenario de mayor ahorro (empate: ítems)', () => {
    const result = run(
      [
        campaign('items', { kind: 'PERCENT_OFF', percent: 10 }, { scope: SCOPE_ALL }),
        campaign(
          'total',
          { kind: 'ORDER_PERCENT_OVER', minSpend: '50.00', percent: 10 },
          { conditions: { stackable: false } },
        ),
      ],
      [line('x', 10, '10.00')],
    );
    expect(result.orderDiscounts).toEqual([]);
    expect(result.total).toBe('90.00');
  });

  it('si la de total no es combinable pero ahorra más, gana sola', () => {
    const result = run(
      [
        campaign('items', { kind: 'PERCENT_OFF', percent: 10 }, { scope: SCOPE_ALL }),
        campaign(
          'total',
          { kind: 'ORDER_PERCENT_OVER', minSpend: '50.00', percent: 20 },
          { conditions: { stackable: false } },
        ),
      ],
      [line('x', 10, '10.00')],
    );
    expect(result.orderDiscounts).toEqual([{ campaignId: 'total', amount: '20.00' }]);
    expect(lineOf(result, 'x').discount).toBe('0.00');
    expect(result.total).toBe('80.00');
  });
});

describe('evaluateOrder — entrada', () => {
  it('suma los renglones repetidos del mismo ítem', () => {
    const result = run([campaign('c', { kind: 'PERCENT_OFF', percent: 10 })], [line('a', 1, '10.00'), line('a', 2, '10.00')]);
    expect(result.lines).toHaveLength(1);
    expect(lineOf(result, 'a').quantity).toBe(3);
    expect(lineOf(result, 'a').discount).toBe('3.00');
  });

  it('descarta renglones con precio ilegible o cantidad no positiva', () => {
    const result = run([], [line('a', 0, '10.00'), line('b', 1, 'abc'), line('c', 1, '5.00')]);
    expect(result.lines.map((item) => item.itemId)).toEqual(['c']);
  });

  it('sin campañas, el total es el de lista', () => {
    const result = run([], [line('a', 2, '10.00'), line('b', 1, '5.50')]);
    expect(result).toMatchObject({ listSubtotal: '25.50', totalDiscount: '0.00', total: '25.50' });
  });

  it('un pedido vacío da cero y ningún aviso', () => {
    const result = run([campaign('c', { kind: 'ORDER_AMOUNT_OVER', minSpend: '10.00', amount: '1.00' })], []);
    expect(result).toMatchObject({ lines: [], nudges: [], total: '0.00' });
  });
});
