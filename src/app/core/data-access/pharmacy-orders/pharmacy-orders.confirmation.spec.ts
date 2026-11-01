import { describe, expect, it } from 'vitest';
import { confirmOrderRequest, pharmacyOrderFromDto } from './pharmacy-orders.adapter';
import { isValidStockConfirmationQuantity } from './pharmacy-orders.confirmation';
import { pharmacyOrderDtoFixture } from './pharmacy-orders.spec-fixtures';

describe('explicit stock confirmation contract', () => {
  const dto = pharmacyOrderDtoFixture();
  const pendingOrder = pharmacyOrderFromDto({
    ...dto,
    lines: [
      {
        ...dto.lines[0],
        status: { code: 'PINV_RES_LINE_PENDING_CONFIRMATION', display: 'Por confirmar' },
      },
    ],
  });
  it.each([1, 12, 1_000_000])('accepts the API quantity limit (%s)', (quantity) => {
    expect(isValidStockConfirmationQuantity(quantity)).toBe(true);
    expect(
      confirmOrderRequest(pendingOrder, [{ indice: 0, decision: 'CONFIRMAR_STOCK', quantity }]),
    ).toEqual({
      adjustments: [{ productId: dto.lines[0].productId, decision: 'CONFIRMAR_STOCK', quantity }],
    });
  });
  it.each([undefined, 0, -1, 1.5, NaN, Infinity, 1_000_001])(
    'rejects invalid quantities (%s)',
    (quantity) => {
      expect(isValidStockConfirmationQuantity(quantity)).toBe(false);
      expect(() =>
        confirmOrderRequest(pendingOrder, [{ indice: 0, decision: 'CONFIRMAR_STOCK', quantity }]),
      ).toThrow();
    },
  );
  it('does not send stock confirmation on an already reserved line', () => {
    expect(() =>
      confirmOrderRequest(pharmacyOrderFromDto(dto), [
        { indice: 0, decision: 'CONFIRMAR_STOCK', quantity: 12 },
      ]),
    ).toThrow();
  });
});
