import type { TipoDeContexto } from '../../../core/messaging/contexto-de-chat';

/* ============================================================================
    Lo que el hilo dice alrededor de una tarjeta de contexto.

    La tarjeta (ver `core/messaging/contexto-de-chat.ts`) es el contrato; esto
    es sólo vocabulario de la vista: cómo se llama el botón que lleva a la
    ficha y qué respuestas rápidas tiene sentido ofrecer según de qué se está
    hablando. Vive aparte del componente para poder probarlo sin montar el
    hilo, y para que la lista de sugerencias se lea entera en un lugar.
   ========================================================================== */

/** El texto del enlace de la tarjeta: «Ver pedido», «Ver producto»… */
export const VERBO_DE_CONTEXTO: Readonly<Record<TipoDeContexto, string>> = {
  pedido: 'Ver pedido',
  producto: 'Ver producto',
  servicio: 'Ver servicio',
  farmacia: 'Ver farmacia',
};

/**
 * Las respuestas rápidas que se ofrecen con el hilo recién abierto.
 *
 * La primera de cada lista es la pregunta que más se repite en una app de
 * delivery para ese tipo de consulta; el resto son las que le siguen. Son
 * preguntas que puede contestar la farmacia, nunca una que pida un dato
 * clínico.
 */
export const SUGERENCIAS_POR_CONTEXTO: Readonly<Record<TipoDeContexto, readonly string[]>> = {
  pedido: [
    '¿Cuándo llega mi pedido?',
    '¿Puedo cambiar la dirección de entrega?',
    'Quiero agregar un producto',
  ],
  producto: ['¿Lo tienen en stock?', '¿Necesito receta?', '¿Tienen otra presentación?'],
  servicio: ['¿Qué días atienden?', '¿Cuál es el precio?', '¿Necesito turno previo?'],
  farmacia: ['¿Hacen envíos a domicilio?', '¿Cuál es su horario?', '¿Qué medios de pago aceptan?'],
};

/** Para una conversación vacía que no vino desde ninguna ficha. */
export const SUGERENCIAS_SIN_CONTEXTO: readonly string[] = [
  'Hola, tengo una consulta',
  '¿Están atendiendo ahora?',
];

/** Cuántas fotos se ven en la grilla antes del «+N». */
export const FOTOS_EN_GRILLA = 4;
