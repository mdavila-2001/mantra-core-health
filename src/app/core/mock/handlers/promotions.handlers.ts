import type {
  MyPromotionDto,
  MyPromotionsResponseDto,
} from '../../data-access/promotions/promotions.dto';
import { preconditionFailed, type MockRouter } from '../mock-router';
import { iso } from '../mock-store';

/* ============================================================================
    Promociones del paciente (B-REAL-13): `GET /promotions/me`.

    El doble sigue la regla del backend: las automáticas vigentes rigen para
    cualquiera del tenant; las de cupón sólo se sirven con el cupón personal
    del titular. Sin perfil de paciente en la sesión, la misma precondición
    que el real.
    ========================================================================== */

function concept(code: string, display: string) {
  return { code, display };
}

/** Las promociones vigentes de ejemplo, fechadas respecto de hoy. */
function currentPromotionsFor(patientProfileId: string): readonly MyPromotionDto[] {
  const couponSuffix = patientProfileId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return [
    {
      id: '5b1f0c2e-0000-4000-8000-00000000d001',
      code: 'PROMO-TEMPORADA',
      name: 'Descuento de primavera',
      description: 'En toda la compra, en las farmacias adheridas.',
      type: concept('PROMO_AUTO', 'Automatic promotion'),
      validFrom: iso(-7),
      validTo: iso(23),
      discounts: [
        {
          type: concept('DISC_PERCENT', 'Percentage discount'),
          percentage: '15',
          fixedAmount: null,
          currency: null,
          minPurchaseAmount: '50.00',
          maxDiscountAmount: null,
          appliesTo: concept('TARGET_ORDER', 'Whole order'),
        },
      ],
      coupons: [],
    },
    {
      id: '5b1f0c2e-0000-4000-8000-00000000d002',
      code: 'PROMO-BIENVENIDA',
      name: 'Bienvenida a la app',
      description: null,
      type: concept('PROMO_COUPON', 'Coupon promotion'),
      validFrom: iso(-2),
      validTo: null,
      discounts: [
        {
          type: concept('DISC_FIXED', 'Fixed amount discount'),
          percentage: null,
          fixedAmount: '20.00',
          currency: concept('BOB', 'Boliviano'),
          minPurchaseAmount: null,
          maxDiscountAmount: null,
          appliesTo: concept('TARGET_ORDER', 'Whole order'),
        },
      ],
      coupons: [{ code: `BIENV-${couponSuffix}`, validTo: iso(28) }],
    },
  ];
}

export function registerPromotions(router: MockRouter): void {
  router.get('/promotions/me', ({ user }) => {
    if (user?.patientProfileId === undefined) {
      return preconditionFailed('La cuenta no tiene perfil de paciente');
    }
    const items = currentPromotionsFor(user.patientProfileId);
    return { items, count: items.length } satisfies MyPromotionsResponseDto;
  });
}
