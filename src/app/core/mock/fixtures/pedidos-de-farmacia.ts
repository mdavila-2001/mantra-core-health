import { uuid } from '../mock-store';

/**
 * **Los pedidos de farmacia que el backend simulado siembra como ejemplo**
 * (carril FAR-I3 / T-I3).
 *
 * Existe por una sola razón: que el identificador de cada pedido de ejemplo
 * tenga **un único dueño**. Lo siembra `pharmacy.handlers.ts` y lo lee la
 * bandeja del mostrador, que le cuelga lo que el contrato de la API todavía
 * no publica —la respuesta del seguro, el medio de entrega de la maqueta—.
 * Con la semilla escrita dos veces, mover una y olvidar la otra deja la
 * pantalla sin el dato y sin ningún error que lo avise.
 *
 * Los identificadores son constantes de verdad: `uuid()` es un hash del texto
 * de la semilla, sin azar ni estado, así que valen lo mismo en cada arranque
 * (por eso un enlace copiado sigue abriendo el mismo pedido).
 */

/** El texto del que sale cada identificador. La semilla es la identidad. */
export const SEMILLAS_DE_PEDIDO = {
  conSeguro: 'pharmacy-order-7',
  conDelivery: 'pharmacy-order-8',
} as const;

/** Un pedido de una persona con cobertura: lo aprobado y lo no aprobado. */
export const ID_PEDIDO_CON_SEGURO = uuid(SEMILLAS_DE_PEDIDO.conSeguro);

/** Un pedido que sale a domicilio en vez de esperar en el mostrador. */
export const ID_PEDIDO_CON_DELIVERY = uuid(SEMILLAS_DE_PEDIDO.conDelivery);
