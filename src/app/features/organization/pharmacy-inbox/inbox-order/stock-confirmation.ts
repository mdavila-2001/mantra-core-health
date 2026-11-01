import type { DecisionDeLinea } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { isValidStockConfirmationQuantity } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.confirmation';

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
    !adjustments.every((adjustment) => adjustment.decision === 'NO_DISPONIBLE') &&
    !adjustments.some(
      (adjustment) =>
        adjustment.decision === 'PROPONER_GENERICO' && adjustment.propuesta === undefined,
    ) &&
    !adjustments.some(
      (adjustment) =>
        adjustment.decision === 'CONFIRMAR_STOCK' &&
        !isValidStockConfirmationQuantity(adjustment.quantity),
    )
  );
}
