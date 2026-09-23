import type { PharmacyOrderDto } from './pharmacy-orders.dto';

export const PHARMACY_ORDER_TEST_IDS = {
  order: '00000000-0000-4000-8000-000000000001',
  site: '00000000-0000-4000-8000-000000000002',
  pharmacy: '00000000-0000-4000-8000-000000000003',
  product: '00000000-0000-4000-8000-000000000004',
  request: '00000000-0000-4000-8000-000000000006',
} as const;

export function pharmacyOrderDtoFixture(extra: Partial<PharmacyOrderDto> = {}): PharmacyOrderDto {
  const ids = PHARMACY_ORDER_TEST_IDS;
  return {
    id: ids.order,
    status: { code: 'PINV_ORDER_ENVIADO', display: 'Enviado' },
    createdAt: '2026-09-03T14:00:00.000Z',
    expiresAt: '2026-09-05T14:00:00.000Z',
    siteId: ids.site,
    siteName: 'Sucursal Centro',
    pharmacyId: ids.pharmacy,
    pharmacyName: 'Farmacia Andina',
    medicationRequestId: ids.request,
    patientName: 'Ana Paciente',
    deliveryMode: { code: 'PINV_DELIVERY_RETIRO', display: 'Retiro' },
    pickupCode: null,
    totalAmount: '68.00',
    currency: { code: 'BOB', display: 'Boliviano' },
    rejectionReasonText: null,
    substitutions: [],
    lines: [
      {
        productId: ids.product,
        medicationConceptId: '00000000-0000-4000-8000-000000000007',
        productCode: 'AMOX-500',
        brandName: 'Amoxicilina',
        genericName: null,
        strengthText: '500 mg',
        packageSizeText: 'Caja x 21 cápsulas',
        medication: { code: 'J01CA04', display: 'Amoxicilina' },
        requestedQuantity: 1,
        reservedQuantity: 1,
        fulfilledQuantity: 0,
        unitPriceAmount: '68.00',
        currency: { code: 'BOB', display: 'Boliviano' },
        status: { code: 'PINV_RES_LINE_CONFIRMED', display: 'Confirmada' },
      },
    ],
    ...extra,
  };
}
