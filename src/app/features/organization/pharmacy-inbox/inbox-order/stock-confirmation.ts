import type { DecisionDeLinea } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { isValidStockConfirmationQuantity } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.confirmation';
import { HttpErrorResponse } from '@angular/common/http';

export function confirmationQuantityError(value: number | undefined): string {
  return value === undefined || isValidStockConfirmationQuantity(value)
    ? ''
    : 'Indique un entero entre 1 y 1.000.000 unidades disponibles.';
}

export function stockConfirmationError(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) return null;
  const body = error.error as { reason?: unknown; details?: { reason?: unknown } } | null;
  return body?.reason === 'SITE_PRODUCT_KEPT_BY_LOTS' ||
    body?.details?.reason === 'SITE_PRODUCT_KEPT_BY_LOTS'
    ? 'Esta sucursal lleva el producto por lotes. Revise sus existencias en Inventario y vuelva a revisar el pedido. Confirmar disponibilidad no sustituye un recuento.'
    : null;
}

export interface InboxLineAdjustment {
  readonly decision: DecisionDeLinea;
  readonly quantity?: number;
  readonly propuesta?: {
    readonly productId: string;
    readonly nombre: string;
    readonly precio: null;
  };
}

export function canConfirmLines(adjustments: readonly InboxLineAdjustment[]): boolean {
  return (
    adjustments.length > 0 &&
    !adjustments.every((item) => item.decision === 'NO_DISPONIBLE') &&
    !adjustments.some(
      (item) => item.decision === 'PROPONER_GENERICO' && item.propuesta === undefined,
    ) &&
    !adjustments.some(
      (item) =>
        item.decision === 'CONFIRMAR_STOCK' && !isValidStockConfirmationQuantity(item.quantity),
    )
  );
}
