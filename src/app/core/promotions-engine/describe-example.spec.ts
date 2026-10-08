import { exampleFor } from './describe-example';
import { NO_CONDITIONS } from './promotion-mechanics.types';
import type { CampaignConditions, Mechanic, PromotableItem } from './promotion-mechanics.types';

function item(itemId: string, unitPrice: string): PromotableItem {
  return { itemId, label: itemId, detail: null, unitPrice, currency: 'BOB' };
}

const A = item('a', '45.00');

function example(
  mechanic: Mechanic,
  items: readonly PromotableItem[] = [A],
  conditions: CampaignConditions = NO_CONDITIONS,
  allItems = false,
): string | null {
  return exampleFor(mechanic, items, conditions, 'Bs', allItems);
}

describe('exampleFor', () => {
  it('un porcentaje: una unidad con su descuento', () => {
    expect(example({ kind: 'PERCENT_OFF', percent: 20 })).toBe('Llevando una unidad, paga Bs 36 en vez de Bs 45.');
  });

  it('el monto fijo por unidad', () => {
    expect(example({ kind: 'AMOUNT_OFF_PER_UNIT', amount: '5.00' })).toBe(
      'Llevando una unidad, paga Bs 40 en vez de Bs 45.',
    );
  });

  it('el precio de campaña, con el que se fijó para ese producto', () => {
    expect(example({ kind: 'CAMPAIGN_PRICE', prices: { a: '38.00' } })).toBe(
      'Llevando una unidad, paga Bs 38 en vez de Bs 45.',
    );
  });

  it('lleve X, pague Y: las unidades que hacen falta para que se note', () => {
    expect(example({ kind: 'BUY_X_PAY_Y', take: 3, pay: 2 })).toBe(
      'Llevando 3 unidades, paga Bs 90 en vez de Bs 135.',
    );
  });

  it('la segunda unidad con descuento', () => {
    expect(example({ kind: 'NTH_UNIT_PERCENT', nth: 2, percent: 50 }, [item('a', '10.00')])).toBe(
      'Llevando 2 unidades, paga Bs 15 en vez de Bs 20.',
    );
  });

  it('el escalonado por cantidad se ejemplifica en el tramo más alto', () => {
    expect(
      example(
        {
          kind: 'VOLUME_TIERS',
          tiers: [
            { minQuantity: 2, percent: 10 },
            { minQuantity: 3, percent: 15 },
          ],
        },
        [item('a', '10.00')],
      ),
    ).toBe('Llevando 3 unidades, paga Bs 25.50 en vez de Bs 30.');
  });

  it('una compra mínima: una compra justo en el umbral', () => {
    expect(example({ kind: 'ORDER_PERCENT_OVER', minSpend: '200.00', percent: 10 }, [])).toBe(
      'En una compra justo en el mínimo, paga Bs 180 en vez de Bs 200.',
    );
  });

  it('el escalonado por monto se ejemplifica en el umbral más alto', () => {
    expect(
      example(
        {
          kind: 'SPEND_TIERS',
          tiers: [
            { minSpend: '100.00', percent: 5 },
            { minSpend: '200.00', percent: 10 },
          ],
        },
        [],
      ),
    ).toBe('En una compra justo en el mínimo, paga Bs 180 en vez de Bs 200.');
  });

  it('un combo con todos sus productos', () => {
    expect(example({ kind: 'BUNDLE_PRICE', bundlePrice: '24.00' }, [item('a', '10.00'), item('b', '20.00')])).toBe(
      'Llevando 2 unidades, paga Bs 24 en vez de Bs 30.',
    );
  });

  it('un regalo: el premio sale sin costo', () => {
    expect(
      example(
        { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'b' },
        [item('a', '20.00'), item('b', '5.00')],
      ),
    ).toBe('Llevando 2 unidades, paga Bs 20 en vez de Bs 25.');
  });

  it('el tope cuenta, porque cambia lo que se paga', () => {
    expect(
      example({ kind: 'PERCENT_OFF', percent: 50 }, [item('a', '100.00')], { ...NO_CONDITIONS, maxDiscount: '10.00' }),
    ).toBe('Llevando una unidad, paga Bs 90 en vez de Bs 100.');
  });

  it('el calendario no esconde el ejemplo: se muestra la mecánica, no el horario', () => {
    const conditions = { ...NO_CONDITIONS, weekdays: [(new Date().getDay() + 1) % 7], fromTime: '01:00', toTime: '02:00' };
    expect(example({ kind: 'PERCENT_OFF', percent: 20 }, [A], conditions)).not.toBeNull();
  });

  it('un cupón no esconde el ejemplo', () => {
    expect(example({ kind: 'PERCENT_OFF', percent: 20 }, [A], { ...NO_CONDITIONS, couponCode: 'AHORRO' })).not.toBeNull();
  });

  describe('cuando no hay un ejemplo honesto', () => {
    it.each<readonly [string, Mechanic, readonly PromotableItem[]]>([
      ['sin productos', { kind: 'PERCENT_OFF', percent: 20 }, []],
      ['puntos: no tocan el precio', { kind: 'POINTS_MULTIPLIER', multiplier: 2 }, [A]],
      ['un combo con un solo producto', { kind: 'BUNDLE_PRICE', bundlePrice: '5.00' }, [A]],
      ['un regalo sin el premio entre los productos', { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'z' }, [A]],
      ['un regalo con disparador y premio iguales', { kind: 'GIFT_WITH_PURCHASE', triggerItemId: 'a', rewardItemId: 'a' }, [A]],
      ['un precio de campaña sin precios', { kind: 'CAMPAIGN_PRICE', prices: {} }, [A]],
      ['una compra mínima ilegible', { kind: 'ORDER_AMOUNT_OVER', minSpend: 'x', amount: '5.00' }, []],
      ['tramos de gasto sin umbral', { kind: 'SPEND_TIERS', tiers: [] }, []],
      ['tramos de cantidad vacíos', { kind: 'VOLUME_TIERS', tiers: [] }, [A]],
    ])('%s', (_name, mechanic, items) => {
      expect(example(mechanic, items)).toBeNull();
    });
  });
});
