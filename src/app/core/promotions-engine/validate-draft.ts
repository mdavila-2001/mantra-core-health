import { isValidPercent, toCents } from './promotion-money';
import type { CampaignConditions, CampaignDraft, DraftFailure, Mechanic } from './promotion-mechanics.types';

/** Cuántas unidades admite un «llevá X» razonable: más es un error de tipeo. */
export const MAX_TAKE = 20;
export const MULTIPLIER_MIN = 2;
export const MULTIPLIER_MAX = 10;

/** «HH:mm» de 24 horas. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Letras, números y guiones: lo que una persona puede leer y tipear en un mostrador. */
const COUPON_PATTERN = /^[A-Za-z0-9-]{3,24}$/;

/**
 * Todo lo que le impide a un borrador convertirse en campaña.
 *
 * Los fallos vuelven **todos juntos** y no de a uno: corregir un formulario a
 * base de reintentos es la forma más rápida de que alguien lo abandone.
 */
export function validateDraft(draft: CampaignDraft): readonly DraftFailure[] {
  const failures: DraftFailure[] = [];
  if (draft.title.trim() === '') {
    failures.push('MISSING_TITLE');
  }
  failures.push(...validateDates(draft));
  failures.push(...validateScope(draft));
  failures.push(...validateMechanic(draft));
  failures.push(...validateConditions(draft.conditions));
  return failures;
}

function validateDates(draft: CampaignDraft): readonly DraftFailure[] {
  if (draft.from === null || draft.to === null) {
    // Falta una fecha, que no es lo mismo que tenerlas al revés. Decir «la
    // fecha de fin no puede ser anterior» cuando no hay fecha manda a revisar
    // un campo que está bien.
    return ['MISSING_DATES'];
  }
  return draft.to.getTime() < draft.from.getTime() ? ['DATES_INVERTED'] : [];
}

/** Las mecánicas de total del pedido no actúan sobre ítems: no piden alcance. */
const ORDER_LEVEL: ReadonlySet<Mechanic['kind']> = new Set([
  'ORDER_PERCENT_OVER',
  'ORDER_AMOUNT_OVER',
  'SPEND_TIERS',
  'POINTS_MULTIPLIER',
]);

function validateScope(draft: CampaignDraft): readonly DraftFailure[] {
  const failures: DraftFailure[] = [];
  const { scope, mechanic, items } = draft;
  const targetsSomething = scope.allItems || scope.itemIds.length > 0 || scope.categoryIds.length > 0;
  if (!ORDER_LEVEL.has(mechanic.kind) && !targetsSomething && items.length === 0) {
    failures.push('NO_ITEMS');
  }
  if (new Set(items.map((item) => item.currency)).size > 1) {
    failures.push('MIXED_CURRENCIES');
  }
  return failures;
}

function validateMechanic(draft: CampaignDraft): readonly DraftFailure[] {
  const mechanic = draft.mechanic;
  switch (mechanic.kind) {
    case 'PERCENT_OFF':
    case 'CLEARANCE':
      return isValidPercent(mechanic.percent) ? [] : ['PERCENT_OUT_OF_RANGE'];
    case 'AMOUNT_OFF_PER_UNIT':
      return isPositiveAmount(mechanic.amount) ? [] : ['AMOUNT_INVALID'];
    case 'CAMPAIGN_PRICE':
      return validateCampaignPrices(draft, mechanic.prices);
    case 'BUY_X_PAY_Y':
      return validateBuyXPayY(mechanic.take, mechanic.pay);
    case 'NTH_UNIT_PERCENT':
      return [
        ...(Number.isInteger(mechanic.nth) && mechanic.nth >= 2 && mechanic.nth <= MAX_TAKE
          ? []
          : (['NTH_INVALID'] as const)),
        ...(isValidPercent(mechanic.percent) ? [] : (['PERCENT_OUT_OF_RANGE'] as const)),
      ];
    case 'VOLUME_TIERS':
      return validateTiers(
        mechanic.tiers.map((tier) => ({ threshold: tier.minQuantity, percent: tier.percent })),
        (threshold) => threshold !== null && Number.isInteger(threshold) && threshold >= 2,
      );
    case 'SPEND_TIERS':
      return validateTiers(
        mechanic.tiers.map((tier) => ({ threshold: toCents(tier.minSpend), percent: tier.percent })),
        (threshold) => threshold !== null && threshold > 0,
      );
    case 'ORDER_PERCENT_OVER':
      return [
        ...(isPositiveAmount(mechanic.minSpend) ? [] : (['MIN_SPEND_INVALID'] as const)),
        ...(isValidPercent(mechanic.percent) ? [] : (['PERCENT_OUT_OF_RANGE'] as const)),
      ];
    case 'ORDER_AMOUNT_OVER':
      return [
        ...(isPositiveAmount(mechanic.minSpend) ? [] : (['MIN_SPEND_INVALID'] as const)),
        ...(isPositiveAmount(mechanic.amount) ? [] : (['AMOUNT_INVALID'] as const)),
      ];
    case 'BUNDLE_PRICE':
      return validateBundle(draft, mechanic.bundlePrice);
    case 'GIFT_WITH_PURCHASE':
      return validateTriggerReward(mechanic.triggerItemId, mechanic.rewardItemId);
    case 'BUY_A_GET_B_PERCENT':
      return [
        ...validateTriggerReward(mechanic.triggerItemId, mechanic.rewardItemId),
        ...(isValidPercent(mechanic.percent) ? [] : (['PERCENT_OUT_OF_RANGE'] as const)),
      ];
    case 'POINTS_MULTIPLIER':
      return Number.isInteger(mechanic.multiplier) &&
        mechanic.multiplier >= MULTIPLIER_MIN &&
        mechanic.multiplier <= MULTIPLIER_MAX
        ? []
        : ['MULTIPLIER_INVALID'];
  }
}

function isPositiveAmount(amount: string): boolean {
  const cents = toCents(amount);
  return cents !== null && cents > 0;
}

/**
 * La única definición de «promoción» que el motor acepta para un precio de
 * campaña: más barato que el de lista. Sin esto, un cero mal tipeado se
 * publica como oferta.
 */
function validateCampaignPrices(
  draft: CampaignDraft,
  prices: Readonly<Record<string, string>>,
): readonly DraftFailure[] {
  const bad = draft.items.some((item) => {
    const promo = toCents(prices[item.itemId] ?? '');
    const list = toCents(item.unitPrice);
    return promo === null || list === null || promo <= 0 || promo >= list;
  });
  return bad ? ['PRICE_NOT_A_DISCOUNT'] : [];
}

/** «Llevá X, pagá Y»: hay que pagar al menos una y menos de las que se llevan. */
function validateBuyXPayY(take: number, pay: number): readonly DraftFailure[] {
  const valid =
    Number.isInteger(take) &&
    Number.isInteger(pay) &&
    take >= 2 &&
    take <= MAX_TAKE &&
    pay >= 1 &&
    pay < take;
  return valid ? [] : ['BUY_QUANTITIES_INVALID'];
}

/**
 * Los tramos tienen que subir de a uno, en umbral **y** en descuento: un tramo
 * «desde 3 unidades, 5 %» detrás de «desde 2, 10 %» premia comprar menos.
 */
function validateTiers(
  tiers: readonly { readonly threshold: number | null; readonly percent: number }[],
  validThreshold: (threshold: number | null) => boolean,
): readonly DraftFailure[] {
  if (tiers.length === 0) {
    return ['TIERS_EMPTY'];
  }
  const failures: DraftFailure[] = [];
  if (tiers.some((tier) => !validThreshold(tier.threshold))) {
    failures.push('MIN_SPEND_INVALID');
  }
  if (tiers.some((tier) => !isValidPercent(tier.percent))) {
    failures.push('PERCENT_OUT_OF_RANGE');
  }
  const increasing = tiers.every((tier, index) => {
    if (index === 0) {
      return true;
    }
    const previous = tiers[index - 1];
    return (
      tier.threshold !== null &&
      previous.threshold !== null &&
      tier.threshold > previous.threshold &&
      tier.percent > previous.percent
    );
  });
  if (!increasing) {
    failures.push('TIERS_NOT_INCREASING');
  }
  return failures;
}

function validateBundle(draft: CampaignDraft, bundlePrice: string): readonly DraftFailure[] {
  const failures: DraftFailure[] = [];
  const bundleItems = draft.items.filter((item) => draft.scope.itemIds.includes(item.itemId));
  if (bundleItems.length < 2) {
    failures.push('BUNDLE_NEEDS_TWO_ITEMS');
  }
  const price = toCents(bundlePrice);
  const listTotal = bundleItems.reduce((sum, item) => sum + (toCents(item.unitPrice) ?? 0), 0);
  if (price === null || price <= 0 || price >= listTotal) {
    failures.push('BUNDLE_PRICE_NOT_A_DISCOUNT');
  }
  return failures;
}

function validateTriggerReward(trigger: string, reward: string): readonly DraftFailure[] {
  if (trigger === '' || reward === '') {
    return ['TRIGGER_REWARD_MISSING'];
  }
  return trigger === reward ? ['TRIGGER_EQUALS_REWARD'] : [];
}

function validateConditions(conditions: CampaignConditions): readonly DraftFailure[] {
  const failures: DraftFailure[] = [];
  if (conditions.maxDiscount !== null && !isPositiveAmount(conditions.maxDiscount)) {
    failures.push('CAP_INVALID');
  }
  if (conditions.budget !== null && !isPositiveAmount(conditions.budget)) {
    failures.push('CAP_INVALID');
  }
  const limits = [conditions.perPersonLimit, conditions.availableUnits];
  if (limits.some((limit) => limit !== null && (!Number.isInteger(limit) || limit < 1))) {
    failures.push('LIMIT_INVALID');
  }
  if (conditions.couponCode !== null && !COUPON_PATTERN.test(conditions.couponCode)) {
    failures.push('COUPON_INVALID');
  }
  if (!isValidTimeWindow(conditions)) {
    failures.push('TIME_WINDOW_INVALID');
  }
  return failures;
}

/** Los dos extremos o ninguno, bien escritos y en orden: la franja no cruza la medianoche. */
function isValidTimeWindow(conditions: CampaignConditions): boolean {
  const { fromTime, toTime } = conditions;
  if (fromTime === null && toTime === null) {
    return true;
  }
  if (fromTime === null || toTime === null) {
    return false;
  }
  return TIME_PATTERN.test(fromTime) && TIME_PATTERN.test(toTime) && fromTime < toTime;
}
