import { infoOf, mechanicsOf } from './mechanic-catalog';
import { NO_CONDITIONS } from './promotion-mechanics.types';
import type {
  CampaignConditions,
  Mechanic,
  MechanicFamily,
  MechanicKind,
} from './promotion-mechanics.types';

/* ============================================================================
    El formulario de una regla, como texto.

    Lo que alguien tipea en un campo es texto, y un texto a medio escribir
    («1», «», «1.») no es todavía un `Mechanic` válido. Este módulo guarda los
    campos tal cual se escribieron y los convierte a `Mechanic` cuando hace
    falta; `validateDraft()` dice después qué le falta a lo convertido.

    Es puro y no sabe de Angular: lo usa el formulario de farmacia hoy y lo
    usaría el de cualquier otra organización mañana.
    ========================================================================== */

/** Una fila de tramos, tal como se escribe: umbral y porcentaje. */
export interface TierFields {
  /** Unidades (tramos por cantidad) o importe (tramos por gasto). */
  readonly threshold: string;
  readonly percent: string;
}

export interface RuleFields {
  readonly family: MechanicFamily;
  readonly kind: MechanicKind;

  readonly percent: string;
  readonly amount: string;
  readonly minSpend: string;
  readonly take: string;
  readonly pay: string;
  readonly nth: string;
  readonly multiplier: string;
  readonly bundlePrice: string;
  readonly triggerItemId: string | null;
  readonly rewardItemId: string | null;
  readonly quantityTiers: readonly TierFields[];
  readonly spendTiers: readonly TierFields[];

  /** «Toda la tienda», sin elegir productos. Sólo para algunas mecánicas. */
  readonly allItems: boolean;

  readonly maxDiscount: string;
  readonly perPersonLimit: string;
  readonly availableUnits: string;
  readonly budget: string;
  readonly couponCode: string;
  /** `'0'` domingo … `'6'` sábado. Vacío = todos los días. */
  readonly weekdays: readonly string[];
  readonly fromTime: string;
  readonly toTime: string;
  readonly stackable: boolean;
}

/** Lo que el formulario entrega: la mecánica, sus condiciones y el alcance. */
export interface RuleValue {
  readonly mechanic: Mechanic;
  readonly conditions: CampaignConditions;
  readonly allItems: boolean;
}

/**
 * Las mecánicas que admiten «toda la tienda»: las que son un descuento simple
 * por unidad. Un 2x1 o un combo sobre «todo» no tienen sentido comercial: hay
 * que decir sobre qué.
 */
const ALL_ITEMS_KINDS: ReadonlySet<MechanicKind> = new Set([
  'PERCENT_OFF',
  'CLEARANCE',
  'AMOUNT_OFF_PER_UNIT',
]);

export function allowsAllItems(kind: MechanicKind): boolean {
  return ALL_ITEMS_KINDS.has(kind);
}

/** Los valores con que arranca el formulario: un porcentaje simple, sin condiciones. */
export function defaultRuleFields(): RuleFields {
  return {
    family: 'PRICE',
    kind: 'PERCENT_OFF',
    percent: '20',
    amount: '5',
    minSpend: '100',
    take: '2',
    pay: '1',
    nth: '2',
    multiplier: '2',
    bundlePrice: '',
    triggerItemId: null,
    rewardItemId: null,
    quantityTiers: [
      { threshold: '2', percent: '10' },
      { threshold: '3', percent: '15' },
    ],
    spendTiers: [
      { threshold: '100', percent: '5' },
      { threshold: '200', percent: '10' },
    ],
    allItems: false,
    maxDiscount: '',
    perPersonLimit: '',
    availableUnits: '',
    budget: '',
    couponCode: '',
    weekdays: [],
    fromTime: '',
    toTime: '',
    stackable: NO_CONDITIONS.stackable,
  };
}

/** Cambiar de familia elige la primera mecánica de la nueva. */
export function withFamily(fields: RuleFields, family: MechanicFamily): RuleFields {
  if (fields.family === family) {
    return fields;
  }
  const [first] = mechanicsOf(family);
  return { ...fields, family, kind: first.kind };
}

/** Los campos que dejó una mecánica se conservan: probar otra no borra lo escrito. */
export function withKind(fields: RuleFields, kind: MechanicKind): RuleFields {
  return { ...fields, kind, family: infoOf(kind).family };
}

/**
 * Lo que emite un `app-input` a texto. El átomo declara
 * `model<string | number | null>` y con `type="number"` emite un **número**:
 * escribirlo tal cual en un campo de texto rompía en `20.trim()`.
 */
export function textOf(value: string | number | null): string {
  return value === null ? '' : String(value);
}

/** Un entero escrito, o `NaN` si lo escrito no es uno: el validador lo rechaza. */
function parseInteger(text: string): number {
  const clean = text.trim();
  return /^\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

/** Un campo opcional: vacío es «no puso nada», no cero. */
function optionalText(text: string): string | null {
  const clean = text.trim();
  return clean === '' ? null : clean;
}

function optionalInteger(text: string): number | null {
  const clean = text.trim();
  return clean === '' ? null : parseInteger(clean);
}

/** Convierte lo escrito en la regla. No valida: eso lo hace `validateDraft()`. */
export function ruleFromFields(fields: RuleFields): RuleValue {
  return {
    mechanic: mechanicFromFields(fields),
    conditions: conditionsFromFields(fields),
    allItems: fields.allItems && allowsAllItems(fields.kind),
  };
}

function mechanicFromFields(fields: RuleFields): Mechanic {
  const percent = parseInteger(fields.percent);
  switch (fields.kind) {
    case 'PERCENT_OFF':
      return { kind: 'PERCENT_OFF', percent };
    case 'CLEARANCE':
      return { kind: 'CLEARANCE', percent };
    case 'AMOUNT_OFF_PER_UNIT':
      return { kind: 'AMOUNT_OFF_PER_UNIT', amount: fields.amount.trim() };
    // Los precios de campaña los pone quien conoce los productos elegidos.
    case 'CAMPAIGN_PRICE':
      return { kind: 'CAMPAIGN_PRICE', prices: {} };
    case 'BUY_X_PAY_Y':
      return { kind: 'BUY_X_PAY_Y', take: parseInteger(fields.take), pay: parseInteger(fields.pay) };
    case 'NTH_UNIT_PERCENT':
      return { kind: 'NTH_UNIT_PERCENT', nth: parseInteger(fields.nth), percent };
    case 'VOLUME_TIERS':
      return {
        kind: 'VOLUME_TIERS',
        tiers: fields.quantityTiers.map((tier) => ({
          minQuantity: parseInteger(tier.threshold),
          percent: parseInteger(tier.percent),
        })),
      };
    case 'ORDER_PERCENT_OVER':
      return { kind: 'ORDER_PERCENT_OVER', minSpend: fields.minSpend.trim(), percent };
    case 'ORDER_AMOUNT_OVER':
      return { kind: 'ORDER_AMOUNT_OVER', minSpend: fields.minSpend.trim(), amount: fields.amount.trim() };
    case 'SPEND_TIERS':
      return {
        kind: 'SPEND_TIERS',
        tiers: fields.spendTiers.map((tier) => ({
          minSpend: tier.threshold.trim(),
          percent: parseInteger(tier.percent),
        })),
      };
    case 'BUNDLE_PRICE':
      return { kind: 'BUNDLE_PRICE', bundlePrice: fields.bundlePrice.trim() };
    case 'GIFT_WITH_PURCHASE':
      return {
        kind: 'GIFT_WITH_PURCHASE',
        triggerItemId: fields.triggerItemId ?? '',
        rewardItemId: fields.rewardItemId ?? '',
      };
    case 'BUY_A_GET_B_PERCENT':
      return {
        kind: 'BUY_A_GET_B_PERCENT',
        triggerItemId: fields.triggerItemId ?? '',
        rewardItemId: fields.rewardItemId ?? '',
        percent,
      };
    case 'POINTS_MULTIPLIER':
      return { kind: 'POINTS_MULTIPLIER', multiplier: parseInteger(fields.multiplier) };
  }
}

function conditionsFromFields(fields: RuleFields): CampaignConditions {
  return {
    maxDiscount: optionalText(fields.maxDiscount),
    perPersonLimit: optionalInteger(fields.perPersonLimit),
    availableUnits: optionalInteger(fields.availableUnits),
    budget: optionalText(fields.budget),
    couponCode: optionalText(fields.couponCode),
    weekdays: fields.weekdays.map(Number).sort((a, b) => a - b),
    fromTime: optionalText(fields.fromTime),
    toTime: optionalText(fields.toTime),
    stackable: fields.stackable,
  };
}
