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

/**
 * El avatar de con quién es una conversación, o `null`.
 *
 * Sólo en una directa (un solo `peer`): un grupo no tiene una cara que lo
 * represente, y mostrar la del primero que llegó sería inventarle una
 * identidad al grupo entero. `app-avatar` ya sabe caer a iniciales sin foto,
 * así que `null` es una respuesta completa, no un caso a medias.
 */
export function avatarDeConQuien(conversacion: ConversationListItem): string | null {
  if (conversacion.peers.length !== 1) return null;
  return conversacion.peers[0].avatarUrl ?? null;
}
