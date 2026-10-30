import type { ConversationListItem } from '../data-access/community/community.types';
import { verificationOf, type VerificationInfo } from '../verification/verification-status';

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
export function conversationLabel(conversacion: ConversationListItem): string {
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
export function conversationAvatar(conversacion: ConversationListItem): string | null {
  if (conversacion.peers.length !== 1) return null;
  return conversacion.peers[0].avatarUrl ?? null;
}

/**
 * La verificación de con quién es una conversación, o `null`.
 *
 * Sólo en una directa y sólo si la API la envió en el `peer`: nunca se deriva
 * de otra cosa, porque en la bandeja un check de más es decirle a alguien que
 * le escribe a un profesional comprobado cuando no lo sabemos. Un grupo no
 * tiene una identidad que verificar.
 */
export function conversationVerification(
  conversacion: ConversationListItem,
): VerificationInfo | null {
  if (conversacion.peers.length !== 1) return null;
  const peer = conversacion.peers[0];
  if (peer.verification?.status == null) return null;
  return verificationOf({ verification: peer.verification });
}
