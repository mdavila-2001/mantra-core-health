import type { MensajeDelHilo, MensajePendiente } from './chat.store';

/** Identity of a message until the server gives it one. */
export function claveTemporal(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The pending messages a forward produces: each chosen message, in thread
 * order, to each chosen conversation. Text and attachment travel as they are
 * (the attachment by its `fileId`: the same file, not a copy); an own sticker
 * stays a sticker. Messages not yet on the server are skipped.
 */
export function pendientesDeReenvio(
  mensajes: readonly MensajeDelHilo[],
  conversationIds: readonly string[],
  profileId: string,
): MensajePendiente[] {
  const enviados = mensajes.filter((m) => m.estado === 'enviado');
  return conversationIds.flatMap((conversationId) =>
    enviados.map((mensaje) => ({
      claveTemporal: claveTemporal(),
      conversationId,
      profileId,
      bodyText: mensaje.bodyText ?? '',
      ...(mensaje.attachmentFileId
        ? { adjunto: { fileId: mensaje.attachmentFileId, nombre: 'Archivo adjunto', tipo: '' } }
        : {}),
      ...(mensaje.contentType === 'STICKER' ? { comoSticker: true } : {}),
      creadoEn: new Date(),
      estado: 'enviando' as const,
    })),
  );
}
