import { withDisplayCurrency } from '../money/display-currency';
import type { PedidoFarmacia } from '../data-access/pharmacy-orders/pharmacy-orders.types';
import type { ContextoDeChat } from './chat-context';

/** La ficha del pedido del paciente: a donde lleva la tarjeta. */
export const RUTA_DEL_PEDIDO_DEL_PACIENTE = '/my-account/pharmacy-orders';

/** Cuántos caracteres del id lleva el número corto: «#22BE». */
const LARGO_DEL_NUMERO = 4;

/**
 * El número corto de un pedido, «#22BE»: los primeros caracteres de su id, en
 * mayúsculas —como el hash corto de un commit—.
 *
 * El contrato no trae un número de pedido legible, y el id entero (un uuid)
 * no se dice en voz alta ni se busca a ojo en un hilo. Cuatro caracteres
 * alcanzan para distinguir los pedidos de **una** conversación —que es lo que
 * hace falta acá—; no es un identificador global ni sirve para buscarlo.
 */
export function numeroCortoDePedido(id: string): string {
  const limpio = id.replace(/[^\da-z]/giu, '');
  return `#${limpio.slice(0, LARGO_DEL_NUMERO).toUpperCase()}`;
}

/** Reconoce el número corto al principio de un título de tarjeta de pedido. */
const NUMERO_AL_PRINCIPIO = /^(#[\dA-Z]{1,8})(?:\s·\s|$)/u;

/**
 * El número corto con que empieza el título de una tarjeta de pedido, o
 * `null` si la tarjeta es de antes de que lo llevara.
 */
export function numeroDelTitulo(titulo: string): string | null {
  return NUMERO_AL_PRINCIPIO.exec(titulo)?.[1] ?? null;
}

/**
 * La tarjeta de contexto de un pedido de farmacia, **la misma de los dos
 * lados**: «Pedido: #22BE · Farmacia Vida · Sucursal Central / 2 productos ·
 * 69,00 Bs».
 *
 * Que sea una sola función no es prolijidad: el store no repite una tarjeta
 * si la última del hilo tiene el mismo tipo, título y ruta. Si el mostrador
 * armara su tarjeta con otro título u otra ruta, el paciente y la farmacia
 * pondrían cada uno la suya sobre el mismo pedido.
 *
 * ## Qué pedido es, y por qué sin el estado
 *
 * El título empieza por el número corto: dos pedidos a la misma farmacia
 * tienen la misma farmacia y la misma sede, y sin el número las dos tarjetas
 * del hilo se leían iguales. El detalle lleva cuántos productos y el total.
 *
 * El estado **no** va: la tarjeta es un mensaje, se escribe una vez y no se
 * actualiza. «Esperando tu decisión» seguiría diciéndolo cuando el pedido ya
 * esté listo para retirar, y una tarjeta que miente sobre el estado es peor
 * que una que no lo dice —el estado vigente está a un toque, en «Ver
 * pedido»—. Además las frases de estado están escritas para el paciente («tu
 * decisión»), y esta misma tarjeta la manda también el mostrador.
 *
 * La ruta es la del paciente (`/my-account/pharmacy-orders/:id`): es quien
 * vuelve a su pedido desde el chat. El mostrador tiene el suyo a la vista.
 * Nada clínico: lo mismo que dice el encabezado del pedido. Título y detalle
 * los recorta a 140 caracteres `normalizarContexto` al escribirse.
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
    titulo: `${numeroCortoDePedido(pedido.id)} · ${pedido.farmacia} · ${pedido.sede}`,
    detalle: total === null ? productos : `${productos} · ${total}`,
    ruta: `${RUTA_DEL_PEDIDO_DEL_PACIENTE}/${pedido.id}`,
  };
}
