/* ============================================================================
    Contrato de `GET /promotions/me` (B-REAL-13): las promociones vigentes para
    el paciente autenticado. Espeja `MyPromotionsResponseDto` del backend campo
    por campo. El titular sale del token: la ruta no lleva datos de la persona.
    ========================================================================== */

/** Un concepto ya resuelto a su forma legible. */
export interface PromotionConceptDto {
  readonly code: string;
  readonly display: string;
}

/** Una regla de descuento. Los importes y el porcentaje son texto exacto. */
export interface MyPromotionDiscountDto {
  /** `DISC_PERCENT`, `DISC_FIXED` o `DISC_BOGO`. */
  readonly type: PromotionConceptDto | null;
  readonly percentage: string | null;
  readonly fixedAmount: string | null;
  readonly currency: PromotionConceptDto | null;
  readonly minPurchaseAmount: string | null;
  readonly maxDiscountAmount: string | null;
  /** `TARGET_ORDER`, `TARGET_ITEM` o `TARGET_CATEGORY`. */
  readonly appliesTo: PromotionConceptDto | null;
}

/** Un cupón personal del titular. */
export interface MyPromotionCouponDto {
  readonly code: string;
  /** Instante ISO 8601, o `null` sin fin declarado. */
  readonly validTo: string | null;
}

/** Una promoción vigente para el titular. */
export interface MyPromotionDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  /** `PROMO_AUTO` o `PROMO_COUPON`. */
  readonly type: PromotionConceptDto | null;
  /** Instantes ISO 8601, o `null` si la promoción no declara ese extremo. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly discounts: readonly MyPromotionDiscountDto[];
  /** Sólo los cupones personales del titular. */
  readonly coupons: readonly MyPromotionCouponDto[];
}

export interface MyPromotionsResponseDto {
  readonly items: readonly MyPromotionDto[];
  readonly count: number;
}
