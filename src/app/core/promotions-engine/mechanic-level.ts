import type { Mechanic, MechanicKind } from './promotion-mechanics.types';

/**
 * Las mecánicas que actúan sobre el **total del pedido** (o sobre cuánto suma
 * quien compra), no sobre ítems: no piden productos y no tienen precio por
 * unidad.
 */
const ORDER_LEVEL_KINDS: ReadonlySet<MechanicKind> = new Set([
  'ORDER_PERCENT_OVER',
  'ORDER_AMOUNT_OVER',
  'SPEND_TIERS',
  'POINTS_MULTIPLIER',
]);

/**
 * Las que dejan un **precio por unidad** en cada producto («antes 45 · ahora
 * 38»). El resto se calcula sobre el pedido: un 2x1 no tiene precio unitario.
 */
const UNIT_PRICE_KINDS: ReadonlySet<MechanicKind> = new Set([
  'PERCENT_OFF',
  'CLEARANCE',
  'AMOUNT_OFF_PER_UNIT',
  'CAMPAIGN_PRICE',
]);

export function isOrderLevel(mechanic: Mechanic | MechanicKind): boolean {
  return ORDER_LEVEL_KINDS.has(typeof mechanic === 'string' ? mechanic : mechanic.kind);
}

export function hasUnitPrice(mechanic: Mechanic | MechanicKind): boolean {
  return UNIT_PRICE_KINDS.has(typeof mechanic === 'string' ? mechanic : mechanic.kind);
}
