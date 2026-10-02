import { describeDraftFailure } from './describe-failure';
import type { DraftFailure } from './promotion-mechanics.types';

/** `Record<DraftFailure, true>` obliga a listar cada fallo: uno nuevo sin texto no compila. */
const ALL: Readonly<Record<DraftFailure, true>> = {
  MISSING_TITLE: true,
  MISSING_DATES: true,
  DATES_INVERTED: true,
  NO_ITEMS: true,
  MIXED_CURRENCIES: true,
  LIST_PRICE_INVALID: true,
  AMOUNT_EXCEEDS_PRICE: true,
  PERCENT_OUT_OF_RANGE: true,
  AMOUNT_INVALID: true,
  PRICE_NOT_A_DISCOUNT: true,
  BUY_QUANTITIES_INVALID: true,
  NTH_INVALID: true,
  TIERS_EMPTY: true,
  TIERS_NOT_INCREASING: true,
  MIN_SPEND_INVALID: true,
  BUNDLE_NEEDS_TWO_ITEMS: true,
  BUNDLE_PRICE_NOT_A_DISCOUNT: true,
  TRIGGER_REWARD_MISSING: true,
  TRIGGER_EQUALS_REWARD: true,
  MULTIPLIER_INVALID: true,
  CAP_INVALID: true,
  LIMIT_INVALID: true,
  COUPON_INVALID: true,
  TIME_WINDOW_INVALID: true,
};

describe('describeDraftFailure', () => {
  it.each(Object.keys(ALL) as DraftFailure[])('%s tiene un texto accionable', (failure) => {
    const text = describeDraftFailure(failure);
    expect(text.trim()).not.toBe('');
    expect(text.endsWith('.')).toBe(true);
  });

  it('no repite el mismo texto para dos fallos distintos', () => {
    const texts = (Object.keys(ALL) as DraftFailure[]).map(describeDraftFailure);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
