import { MECHANIC_CATALOG, MECHANIC_FAMILIES, infoOf, mechanicsOf } from './mechanic-catalog';
import type { MechanicKind } from './promotion-mechanics.types';

/**
 * `Record<MechanicKind, true>` obliga a listar cada mecánica: si alguien agrega
 * una a la unión y olvida el catálogo, esto no compila.
 */
const ALL_KINDS: Readonly<Record<MechanicKind, true>> = {
  PERCENT_OFF: true,
  CAMPAIGN_PRICE: true,
  AMOUNT_OFF_PER_UNIT: true,
  BUY_X_PAY_Y: true,
  NTH_UNIT_PERCENT: true,
  VOLUME_TIERS: true,
  ORDER_PERCENT_OVER: true,
  ORDER_AMOUNT_OVER: true,
  SPEND_TIERS: true,
  BUNDLE_PRICE: true,
  GIFT_WITH_PURCHASE: true,
  BUY_A_GET_B_PERCENT: true,
  POINTS_MULTIPLIER: true,
  CLEARANCE: true,
};

describe('MECHANIC_CATALOG', () => {
  it('tiene una ficha por cada mecánica, sin repetir', () => {
    const kinds = MECHANIC_CATALOG.map((info) => info.kind);
    expect([...kinds].sort()).toEqual(Object.keys(ALL_KINDS).sort());
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('cada familia ofrece al menos una mecánica', () => {
    for (const { family } of MECHANIC_FAMILIES) {
      expect(mechanicsOf(family).length).toBeGreaterThan(0);
    }
  });

  it('toda ficha dice qué es y cómo se lee', () => {
    for (const info of MECHANIC_CATALOG) {
      expect(info.label.trim()).not.toBe('');
      expect(info.help.trim()).not.toBe('');
      expect(info.example.trim()).not.toBe('');
    }
  });

  it('infoOf devuelve la ficha de la mecánica', () => {
    expect(infoOf('BUY_X_PAY_Y').family).toBe('QUANTITY');
  });

  it('infoOf falla alto si falta la ficha', () => {
    expect(() => infoOf('NO_EXISTE' as MechanicKind)).toThrow('Falta la ficha');
  });
});
