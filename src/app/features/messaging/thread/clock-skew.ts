import type { MensajeDelHilo } from '../../../core/messaging/chat.store';

/**
 * Server clock minus browser clock, from the first own message acknowledged
 * after a send (`sentAt` is server time; `enviadoEn` is when we sent it).
 * `null` while there is nothing new to measure.
 *
 * Lives in the lazy thread, not in `ChatStore`: the initial bundle is at its
 * 1.5 MB budget.
 */
export function clockSkew(
  mensajes: readonly MensajeDelHilo[],
  propio: string | null,
  enviadoEn: number,
): number | null {
  const ultimo = mensajes.at(-1);
  return enviadoEn > 0 && ultimo?.sentAt && !ultimo.pendiente && ultimo.senderProfileId === propio
    ? ultimo.sentAt.getTime() - enviadoEn
    : null;
}
