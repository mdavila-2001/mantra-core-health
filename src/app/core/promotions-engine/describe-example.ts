import { evaluateOrder } from './evaluate-order';
import { formatMoney } from './describe-mechanic';
import { isOrderLevel } from './mechanic-level';
import { fromCents, toCents } from './promotion-money';
import type {
  CampaignConditions,
  CampaignScope,
  Mechanic,
  OrderLine,
  PromotableItem,
  PromotionCampaign,
} from './promotion-mechanics.types';

/** El día del ejemplo: una ventana que contiene a «hoy», sin calendario ni cupón. */
const EXAMPLE_CAMPAIGN_ID = 'example';

/**
 * Un ejemplo calculado con las reglas reales del motor, para que quien arma la
 * campaña vea —y quien la lee entienda— qué paga alguien con ella: «Llevando 3
 * pagás Bs 90 en vez de Bs 135».
 *
 * Devuelve `null` si con lo elegido no se puede armar un ejemplo honesto (sin
 * productos, sin precios, o una mecánica que no toca el precio).
 */
export function exampleFor(
  mechanic: Mechanic,
  items: readonly PromotableItem[],
  conditions: CampaignConditions,
  currency: string,
  allItems = false,
): string | null {
  const lines = exampleLines(mechanic, items);
  if (lines === null || lines.length === 0) {
    return null;
  }
  const now = new Date();
  const campaign: PromotionCampaign = {
    id: EXAMPLE_CAMPAIGN_ID,
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    mechanic,
    scope: scopeOf(mechanic, items, allItems),
    // El ejemplo muestra la mecánica, no el calendario: fuera de horario no se
    // vería nada. El tope sí cuenta, porque cambia lo que se paga.
    conditions: { ...conditions, weekdays: [], fromTime: null, toTime: null, couponCode: null },
  };
  const result = evaluateOrder([campaign], lines, { now });
  if (toCents(result.totalDiscount) === 0) {
    return null;
  }
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  return `${exampleLead(mechanic, quantity)} pagás ${formatMoney(result.total, currency)} en vez de ${formatMoney(result.listSubtotal, currency)}.`;
}

function scopeOf(mechanic: Mechanic, items: readonly PromotableItem[], allItems: boolean): CampaignScope {
  return {
    itemIds: isOrderLevel(mechanic) ? [] : items.map((item) => item.itemId),
    categoryIds: [],
    allItems,
  };
}

/** Cuántas unidades de qué hacen falta para que la mecánica se note. */
function exampleLines(mechanic: Mechanic, items: readonly PromotableItem[]): readonly OrderLine[] | null {
  const first = items[0];
  const line = (item: PromotableItem, quantity: number): OrderLine => ({
    itemId: item.itemId,
    quantity,
    unitPrice: item.unitPrice,
    categoryId: item.categoryId,
  });

  switch (mechanic.kind) {
    case 'PERCENT_OFF':
    case 'CLEARANCE':
    case 'AMOUNT_OFF_PER_UNIT':
    case 'CAMPAIGN_PRICE':
      return first === undefined ? null : [line(first, 1)];
    case 'BUY_X_PAY_Y':
      return first === undefined ? null : [line(first, mechanic.take)];
    case 'NTH_UNIT_PERCENT':
      return first === undefined ? null : [line(first, mechanic.nth)];
    case 'VOLUME_TIERS': {
      const top = Math.max(...mechanic.tiers.map((tier) => tier.minQuantity));
      return first === undefined || !Number.isFinite(top) ? null : [line(first, top)];
    }
    case 'ORDER_PERCENT_OVER':
    case 'ORDER_AMOUNT_OVER':
      return spendLine(toCents(mechanic.minSpend));
    case 'SPEND_TIERS': {
      const top = Math.max(...mechanic.tiers.map((tier) => toCents(tier.minSpend) ?? 0));
      return spendLine(top > 0 ? top : null);
    }
    case 'BUNDLE_PRICE':
      return items.length < 2 ? null : items.map((item) => line(item, 1));
    case 'GIFT_WITH_PURCHASE':
    case 'BUY_A_GET_B_PERCENT':
      return pair(items, mechanic.triggerItemId, mechanic.rewardItemId, line);
    case 'POINTS_MULTIPLIER':
      return null;
  }
}

/** Una compra «virtual» exactamente en el umbral: lo que hace falta para ver el descuento. */
function spendLine(cents: number | null): readonly OrderLine[] | null {
  return cents === null || cents <= 0
    ? null
    : [{ itemId: 'example-spend', quantity: 1, unitPrice: fromCents(cents) }];
}

function pair(
  items: readonly PromotableItem[],
  triggerItemId: string,
  rewardItemId: string,
  line: (item: PromotableItem, quantity: number) => OrderLine,
): readonly OrderLine[] | null {
  const trigger = items.find((item) => item.itemId === triggerItemId);
  const reward = items.find((item) => item.itemId === rewardItemId);
  return trigger === undefined || reward === undefined || trigger === reward
    ? null
    : [line(trigger, 1), line(reward, 1)];
}

function exampleLead(mechanic: Mechanic, quantity: number): string {
  if (isOrderLevel(mechanic)) {
    return 'En una compra justo en el mínimo,';
  }
  return quantity === 1 ? 'Llevando una unidad,' : `Llevando ${quantity} unidades,`;
}
