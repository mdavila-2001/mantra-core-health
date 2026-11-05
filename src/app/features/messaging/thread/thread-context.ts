import type { ContextoDeChat, TipoDeContexto } from '../../../core/messaging/chat-context';
import { numeroDelTitulo } from '../../../core/messaging/order-chat-context';

/* ============================================================================
    Lo que el hilo dice alrededor de una tarjeta de contexto.

    La tarjeta (ver `core/messaging/chat-context.ts`) es el contrato; esto
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
  servicio: ['¿Qué días atienden?', '¿Cuál es el precio?', '¿Necesito cita previa?'],
  farmacia: ['¿Hacen envíos a domicilio?', '¿Cuál es su horario?', '¿Qué medios de pago aceptan?'],
};

/** Para una conversación vacía que no vino desde ninguna ficha. */
export const SUGERENCIAS_SIN_CONTEXTO: readonly string[] = [
  'Hola, tengo una consulta',
  '¿Están atendiendo ahora?',
];

/** Cuántas fotos se ven en la grilla antes del «+N». */
export const FOTOS_EN_GRILLA = 4;

/**
 * El subtítulo de la cabecera de una conversación directa que vino desde una
 * ficha: «Pedido · #22BE», «Consulta por Paracetamol 500 mg».
 *
 * Sólo **de qué** se habla, nunca con quién: la farmacia y la sede ya están en
 * el nombre de la cabecera, y la tarjeta las repite. Decirlas una tercera vez
 * en el subtítulo era el mismo renglón tres veces en 390 px.
 */
export function subtituloDeContexto(contexto: ContextoDeChat): string {
  switch (contexto.tipo) {
    case 'pedido': {
      const numero = numeroDelTitulo(contexto.titulo);
      return numero === null ? 'Pedido' : `Pedido · ${numero}`;
    }
    case 'farmacia':
      return 'Consulta a la farmacia';
    default:
      return `Consulta por ${contexto.titulo}`;
  }
}

/** El pedido de la persona y el mismo pedido en la bandeja de la farmacia. */
const PEDIDO_PROPIO = /^\/my-account\/pharmacy-orders\/([\w-]{1,64})$/u;
const PEDIDO_EN_LA_BANDEJA = '/administration/pharmacy-orders/';

/**
 * A dónde lleva la tarjeta según quién la mira, o `null` si para esa persona
 * no hay ficha equivalente y no se ofrece el enlace.
 *
 * La tarjeta de pedido apunta al pedido del paciente (`/my-account/…`). Quien
 * atiende como la farmacia no tiene ese pedido entre los suyos: el mismo
 * pedido está en su bandeja, `/administration/pharmacy-orders/:id`. Producto,
 * farmacia y servicio son fichas públicas y valen igual para los dos lados.
 *
 * No autoriza nada: la API decide en cada ficha. Sólo evita ofrecer una
 * puerta que lleva a la pantalla de otro.
 */
export function rutaParaQuienMira(
  contexto: ContextoDeChat,
  comoOrganizacion: boolean,
): string | null {
  if (contexto.tipo !== 'pedido' || !comoOrganizacion) {
    return contexto.ruta;
  }
  const id = PEDIDO_PROPIO.exec(contexto.ruta)?.[1];
  return id === undefined ? null : `${PEDIDO_EN_LA_BANDEJA}${id}`;
}
