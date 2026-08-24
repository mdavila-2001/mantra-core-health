import type { ConversationListItem } from '../data-access/community/community.types';

/**
 * Con quién es una conversación, en una línea.
 *
 * Vive acá y no dentro de una pantalla porque lo necesitan tres: la bandeja, la
 * lista de conversaciones que ahora también dibuja el hilo al costado, y el
 * encabezado del propio hilo. Tres copias de esta función se separan en cuanto
 * alguien decide que los grupos se rotulan distinto.
 *
 * Sin ningún nombre resuelto se dice «Conversación» y **no** el uuid: un
 * identificador en la bandeja no le dice nada a nadie.
 */
export function conQuien(conversacion: ConversationListItem): string {
  const nombres = conversacion.peers
    .map((peer) => peer.displayName)
    .filter((nombre): nombre is string => nombre !== undefined && nombre !== null);

  return nombres.length === 0 ? 'Conversación' : nombres.join(', ');
}
