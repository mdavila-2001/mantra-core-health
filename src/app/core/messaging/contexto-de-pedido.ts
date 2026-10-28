import { withDisplayCurrency } from '../money/display-currency';
import type { PedidoFarmacia } from '../data-access/pharmacy-orders/pharmacy-orders.types';
import type { ContextoDeChat } from './contexto-de-chat';

/** La ficha del pedido del paciente: a donde lleva la tarjeta. */
export const RUTA_DEL_PEDIDO_DEL_PACIENTE = '/my-account/pharmacy-orders';

/**
 * La tarjeta de contexto de un pedido de farmacia, **la misma de los dos
 * lados**: «Pedido: Farmacia Vida · Sucursal Central / 2 productos · 69,00 Bs».
 *
 * Que sea una sola función no es prolijidad: el store no repite una tarjeta
 * si la última del hilo tiene el mismo tipo, título y ruta. Si el mostrador
 * armara su tarjeta con otro título u otra ruta, el paciente y la farmacia
 * pondrían cada uno la suya sobre el mismo pedido.
 *
 * La ruta es la del paciente (`/my-account/pharmacy-orders/:id`): es quien
 * vuelve a su pedido desde el chat. El mostrador tiene el suyo a la vista.
 * Nada clínico: lo mismo que dice el encabezado del pedido.
 */
export function contextoDePedido(pedido: PedidoFarmacia): ContextoDeChat {
  const cuantos = pedido.lineas.length;
  const productos = `${cuantos} ${cuantos === 1 ? 'producto' : 'productos'}`;
  const total =
    pedido.totalEstimado === null
      ? null
      : withDisplayCurrency(pedido.totalEstimado.replace('.', ','), pedido.moneda);
  return {
    tipo: 'pedido',
    titulo: `${pedido.farmacia} · ${pedido.sede}`,
    detalle: total === null ? productos : `${productos} · ${total}`,
    ruta: `${RUTA_DEL_PEDIDO_DEL_PACIENTE}/${pedido.id}`,
  };
}
