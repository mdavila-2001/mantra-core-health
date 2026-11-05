import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../../core/http/api-error';
import { describeApiFailure } from '../../../../core/http/api-failure';

/** Lo que se dice cuando la API no explica el fallo con palabras para la persona. */
export const ORDER_SEND_FAILED = 'No se pudo enviar el pedido a la farmacia.';

/**
 * El 404 de `POST /pharmacy/orders`: un producto del pedido ya no se vende en
 * esa sede (retirado, sin stock declarado o de otra farmacia). La API usa el
 * mismo 404 para todos esos casos y no dice cuál.
 */
export const ORDER_PRODUCT_UNAVAILABLE =
  'Algún producto del pedido ya no está disponible en esa sede. Vuelva a «Dónde comprar» y elija otra farmacia.';

/**
 * Qué pasó al enviar el pedido. Un 404 acá no es «no encontramos la página»:
 * es un producto que esa sede ya no vende, y la persona puede elegir otra.
 * Lo demás sigue la regla de siempre (`describeApiFailure`).
 */
export function describeOrderSendFailure(error: unknown): string {
  const notFound =
    error instanceof HttpErrorResponse &&
    error.status === 404 &&
    (readApiError(error)?.code ?? 'NOT_FOUND') === 'NOT_FOUND';
  return describeApiFailure(error, notFound ? ORDER_PRODUCT_UNAVAILABLE : ORDER_SEND_FAILED);
}
