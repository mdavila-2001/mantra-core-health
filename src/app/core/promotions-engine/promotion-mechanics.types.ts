/* ============================================================================
    Contratos del motor de promociones.

    El motor **no sabe de farmacias**: razona sobre `PromotableItem`. Una
    farmacia mapea productos; una clínica mapearía servicios; un laboratorio,
    estudios. Lo único que comparten es un identificador, un precio unitario y
    una moneda.

    Los importes son SIEMPRE texto (el `numeric` del backend no cabe en un
    `number`); la aritmética vive en `promotion-money.ts` y trabaja en centavos.
    ========================================================================== */

/** Las familias en que el formulario agrupa las mecánicas. */
export type MechanicFamily = 'PRICE' | 'QUANTITY' | 'ORDER_TOTAL' | 'COMBO' | 'LOYALTY';

/** Todas las mecánicas que el motor sabe calcular. */
export type MechanicKind =
  | 'PERCENT_OFF'
  | 'CAMPAIGN_PRICE'
  | 'AMOUNT_OFF_PER_UNIT'
  | 'BUY_X_PAY_Y'
  | 'NTH_UNIT_PERCENT'
  | 'VOLUME_TIERS'
  | 'ORDER_PERCENT_OVER'
  | 'ORDER_AMOUNT_OVER'
  | 'SPEND_TIERS'
  | 'BUNDLE_PRICE'
  | 'GIFT_WITH_PURCHASE'
  | 'BUY_A_GET_B_PERCENT'
  | 'POINTS_MULTIPLIER'
  | 'CLEARANCE';

/** Un tramo por cantidad de unidades: «desde 3 unidades, 15 % menos». */
export interface QuantityTier {
  readonly minQuantity: number;
  readonly percent: number;
}

/** Un tramo por gasto: «desde Bs 200, 10 % menos». */
export interface SpendTier {
  readonly minSpend: string;
  readonly percent: number;
}

/**
 * La mecánica de una campaña. Unión discriminada: cada `kind` lleva sus campos
 * y nada más, así que una mecánica sin sus datos no compila.
 */
export type Mechanic =
  | { readonly kind: 'PERCENT_OFF'; readonly percent: number }
  | { readonly kind: 'CAMPAIGN_PRICE'; readonly prices: Readonly<Record<string, string>> }
  | { readonly kind: 'AMOUNT_OFF_PER_UNIT'; readonly amount: string }
  /** Llevá `take`, pagá `pay`. 2x1 = `{take: 2, pay: 1}`. */
  | { readonly kind: 'BUY_X_PAY_Y'; readonly take: number; readonly pay: number }
  /** La unidad número `nth` de cada grupo, con `percent` de descuento. */
  | { readonly kind: 'NTH_UNIT_PERCENT'; readonly nth: number; readonly percent: number }
  | { readonly kind: 'VOLUME_TIERS'; readonly tiers: readonly QuantityTier[] }
  | { readonly kind: 'ORDER_PERCENT_OVER'; readonly minSpend: string; readonly percent: number }
  | { readonly kind: 'ORDER_AMOUNT_OVER'; readonly minSpend: string; readonly amount: string }
  | { readonly kind: 'SPEND_TIERS'; readonly tiers: readonly SpendTier[] }
  /** Los ítems del alcance, una unidad de cada uno, a un precio conjunto. */
  | { readonly kind: 'BUNDLE_PRICE'; readonly bundlePrice: string }
  | {
      readonly kind: 'GIFT_WITH_PURCHASE';
      readonly triggerItemId: string;
      readonly rewardItemId: string;
    }
  | {
      readonly kind: 'BUY_A_GET_B_PERCENT';
      readonly triggerItemId: string;
      readonly rewardItemId: string;
      readonly percent: number;
    }
  | { readonly kind: 'POINTS_MULTIPLIER'; readonly multiplier: number }
  | { readonly kind: 'CLEARANCE'; readonly percent: number };

/** Sobre qué ítems actúa una campaña. Vacío y sin `allItems` = no actúa sobre nada. */
export interface CampaignScope {
  readonly itemIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly allItems: boolean;
}

/**
 * Los modificadores opcionales, combinables con cualquier mecánica.
 *
 * `perPersonLimit`, `availableUnits` y `budget` **se guardan y se muestran pero
 * este motor no los hace cumplir**: exigen el historial de canjes, que es del
 * backend (`redemptions`). El motor evalúa un pedido, no una cuenta corriente.
 */
export interface CampaignConditions {
  /** Tope de descuento por pedido de esta campaña. */
  readonly maxDiscount: string | null;
  readonly perPersonLimit: number | null;
  /** «Hasta agotar stock»: cuántos canjes admite la campaña en total. */
  readonly availableUnits: number | null;
  readonly budget: string | null;
  /** Si existe, la campaña sólo vale cuando el pedido trae ese código. */
  readonly couponCode: string | null;
  /** 0 = domingo … 6 = sábado. Vacío = todos los días. */
  readonly weekdays: readonly number[];
  /** «HH:mm» locales. Los dos o ninguno; la franja no cruza la medianoche. */
  readonly fromTime: string | null;
  readonly toTime: string | null;
  /** ¿Se puede sumar con otra campaña de otro nivel (ítem + total)? */
  readonly stackable: boolean;
}

/** Condiciones vacías: sin tope, sin cupón, todos los días, combinable. */
export const NO_CONDITIONS: CampaignConditions = {
  maxDiscount: null,
  perPersonLimit: null,
  availableUnits: null,
  budget: null,
  couponCode: null,
  weekdays: [],
  fromTime: null,
  toTime: null,
  stackable: true,
};

/** Una campaña, tal como la evalúa el motor. */
export interface PromotionCampaign {
  readonly id: string;
  readonly from: Date;
  readonly to: Date;
  readonly mechanic: Mechanic;
  readonly scope: CampaignScope;
  readonly conditions: CampaignConditions;
}

/** Algo que se puede promocionar: un producto, un servicio, un estudio. */
export interface PromotableItem {
  readonly itemId: string;
  readonly label: string;
  readonly detail: string | null;
  /** Precio de lista, texto exacto. */
  readonly unitPrice: string;
  readonly currency: string;
  readonly categoryId?: string | null;
}

/** Un renglón del pedido. */
export interface OrderLine {
  readonly itemId: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly categoryId?: string | null;
}

/** Lo que el pedido aporta además de sus renglones. */
export interface EvaluationContext {
  readonly now: Date;
  /** Cupones que la persona escribió. Sin ellos, las campañas con cupón no valen. */
  readonly couponCodes?: readonly string[];
}

/** Qué le pasó a un renglón. */
export interface LineResult {
  readonly itemId: string;
  readonly quantity: number;
  readonly unitPrice: string;
  /** Lo que cuesta el renglón sin campañas. */
  readonly listTotal: string;
  /** Cuánto se descuenta en el renglón. */
  readonly discount: string;
  /** Lo que se paga por el renglón. */
  readonly total: string;
  /** La campaña que lo rebajó, o `null`. */
  readonly campaignId: string | null;
}

/** Un descuento sobre el total del pedido. */
export interface OrderDiscountResult {
  readonly campaignId: string;
  readonly amount: string;
}

/**
 * Lo que le falta al pedido para alcanzar una campaña. Estructurado y no un
 * texto: el mensaje lo arma `describeNudge()`, que es la única fuente de prosa.
 */
export type Nudge =
  | {
      readonly kind: 'SPEND_MORE';
      readonly campaignId: string;
      readonly missingAmount: string;
      readonly reward: Mechanic;
    }
  | {
      readonly kind: 'ADD_UNITS';
      readonly campaignId: string;
      readonly missingUnits: number;
      readonly reward: Mechanic;
    };

/** El resultado de evaluar un pedido. */
export interface EvaluationResult {
  readonly lines: readonly LineResult[];
  readonly orderDiscounts: readonly OrderDiscountResult[];
  readonly nudges: readonly Nudge[];
  /** El multiplicador de puntos más alto que alcanza el pedido, o `null`. */
  readonly pointsMultiplier: number | null;
  readonly listSubtotal: string;
  readonly totalDiscount: string;
  readonly total: string;
}

/** Por qué un borrador no se puede publicar. Se dicen todas juntas. */
export type DraftFailure =
  | 'MISSING_TITLE'
  | 'MISSING_DATES'
  | 'DATES_INVERTED'
  | 'NO_ITEMS'
  | 'MIXED_CURRENCIES'
  | 'LIST_PRICE_INVALID'
  | 'AMOUNT_EXCEEDS_PRICE'
  | 'PERCENT_OUT_OF_RANGE'
  | 'AMOUNT_INVALID'
  | 'PRICE_NOT_A_DISCOUNT'
  | 'BUY_QUANTITIES_INVALID'
  | 'NTH_INVALID'
  | 'TIERS_EMPTY'
  | 'TIERS_NOT_INCREASING'
  | 'MIN_SPEND_INVALID'
  | 'BUNDLE_NEEDS_TWO_ITEMS'
  | 'BUNDLE_PRICE_NOT_A_DISCOUNT'
  | 'TRIGGER_REWARD_MISSING'
  | 'TRIGGER_EQUALS_REWARD'
  | 'MULTIPLIER_INVALID'
  | 'CAP_INVALID'
  | 'LIMIT_INVALID'
  | 'COUPON_INVALID'
  | 'TIME_WINDOW_INVALID';

/** Lo que el validador necesita saber de un borrador, sin conocer el dominio. */
export interface CampaignDraft {
  readonly title: string;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly mechanic: Mechanic;
  readonly scope: CampaignScope;
  readonly conditions: CampaignConditions;
  /** Los ítems elegidos, con su precio de lista: de ahí salen las comparaciones. */
  readonly items: readonly PromotableItem[];
}
