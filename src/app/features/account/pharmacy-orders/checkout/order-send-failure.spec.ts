import { HttpErrorResponse } from '@angular/common/http';

import {
  describeOrderSendFailure,
  ORDER_PRODUCT_UNAVAILABLE,
  ORDER_SEND_FAILED,
} from './order-send-failure';

function apiError(status: number, code: string, message: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message } });
}

describe('describeOrderSendFailure', () => {
  it('un 404 dice que un producto ya no está en esa sede, no un «no encontrado» genérico', () => {
    const text = describeOrderSendFailure(
      apiError(404, 'NOT_FOUND', 'Producto no disponible en la sede'),
    );
    expect(text).toBe(ORDER_PRODUCT_UNAVAILABLE);
    expect(text).toContain('Dónde comprar');
  });

  it('el motivo que la API explica para la persona se respeta', () => {
    expect(
      describeOrderSendFailure(apiError(409, 'CONFLICT', 'La sede ya no tiene ese producto.')),
    ).toBe('La sede ya no tiene ese producto.');
  });

  it('lo demás cae en el texto de la pantalla', () => {
    expect(describeOrderSendFailure(apiError(500, 'INTERNAL', 'boom'))).toBe(ORDER_SEND_FAILED);
    expect(describeOrderSendFailure(new Error('x'))).toBe(ORDER_SEND_FAILED);
  });
});
