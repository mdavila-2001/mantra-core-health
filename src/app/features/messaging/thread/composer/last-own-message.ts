import { editable, type MensajeDelHilo } from '../../../../core/messaging/chat.store';

/**
 * What ↑ edits on an empty composer (WhatsApp): the newest own text message,
 * only while it is still editable (same rule as the menu, `editable()`).
 */
export function lastOwnText(
  mensajes: readonly MensajeDelHilo[],
  propio: string | null,
  ahora: number,
): MensajeDelHilo | undefined {
  const ultimo = [...mensajes]
    .reverse()
    .find((m) => m.senderProfileId === propio && m.estado === 'enviado' && (m.bodyText ?? '').trim() !== '');
  return ultimo !== undefined && editable(ultimo, propio, ahora) ? ultimo : undefined;
}
