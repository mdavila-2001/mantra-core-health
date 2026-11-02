/** Límites de quantity en ConfirmPharmacyOrderDto de la API. */
export const MAX_STOCK_CONFIRMATION_QUANTITY = 1_000_000;

export function isValidStockConfirmationQuantity(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_STOCK_CONFIRMATION_QUANTITY
  );
}
