import type { ConversationPreviewMessage } from '../../../core/data-access/community/community.types';
import {
  contextoDelTexto,
  resumenDeContexto,
  type TipoDeContexto,
} from '../../../core/messaging/contexto-de-chat';
import { stickerDe } from '../../../core/messaging/sticker-pack.generated';

/**
 * Qué se lee en la segunda línea de una fila de la bandeja.
 *
 * ## Por qué una función y no tres `@if`
 *
 * La vista previa decide entre cinco cosas —texto, tarjeta de contexto,
 * sticker, adjunto con leyenda, adjunto a secas— y el orden importa: una
 * tarjeta es texto, y un sticker es un adjunto. Escrito en la plantilla, ese
 * orden quedaba repartido en condiciones que se pisaban; acá es una lista que
 * se lee de arriba abajo y se prueba sin montar nada.
 *
 * ## Lo que no se inventa
 *
 * El contrato de la bandeja (`ConversationPreviewMessage`) trae el
 * `attachmentFileId` pero **no el tipo MIME** del adjunto. Sin el tipo no se
 * puede decir «Foto», «Audio» ni «PDF»: lo único cierto es que hay un archivo.
 * Un sticker sí se reconoce, porque su `fileId` es del pack. El día que el
 * contrato traiga el tipo, se agrega un caso acá y la fila lo pinta sola.
 */
export type VistaPrevia =
  | { readonly tipo: 'nada'; readonly texto: '' }
  | { readonly tipo: 'texto'; readonly texto: string }
  | { readonly tipo: 'contexto'; readonly texto: string; readonly contexto: TipoDeContexto }
  | { readonly tipo: 'sticker'; readonly texto: 'Sticker' }
  | { readonly tipo: 'adjunto'; readonly texto: string };

/** Lo que dice la fila de un archivo cuyo tipo la bandeja no conoce. */
export const TEXTO_DE_ADJUNTO = 'Archivo adjunto';

/**
 * La vista previa del último mensaje de una conversación.
 *
 * @param mensaje - El último mensaje, tal como lo manda la bandeja.
 * @returns Qué pintar: el tipo decide el ícono; `texto` es lo que se lee.
 */
export function vistaPreviaDe(mensaje: ConversationPreviewMessage | undefined): VistaPrevia {
  if (mensaje === undefined) {
    return { tipo: 'nada', texto: '' };
  }

  // Un sticker primero: viaja como adjunto sin texto, y anunciarlo como
  // «Archivo adjunto» sería verdad a medias.
  if (stickerDe(mensaje.attachmentFileId) !== undefined) {
    return { tipo: 'sticker', texto: 'Sticker' };
  }

  const cuerpo = mensaje.bodyText?.trim() ?? '';

  // La tarjeta del pedido o del producto: «Pedido · Farmacia Chávez», no tres
  // líneas con una ruta interna al final.
  const contexto = contextoDelTexto(cuerpo);
  if (contexto !== null) {
    return { tipo: 'contexto', texto: resumenDeContexto(contexto), contexto: contexto.tipo };
  }

  const tieneAdjunto =
    mensaje.attachmentFileId !== undefined && mensaje.attachmentFileId !== '';

  if (cuerpo === '') {
    // Sin cuerpo sólo puede ser un archivo: es lo que hacía la fila antes de
    // que el contrato trajera el `attachmentFileId`, y sigue siendo cierto.
    return { tipo: 'adjunto', texto: TEXTO_DE_ADJUNTO };
  }

  // Un adjunto con leyenda: el clip dice que hay archivo, la leyenda dice de
  // qué se trata. Una sola línea, como en cualquier chat.
  return tieneAdjunto
    ? { tipo: 'adjunto', texto: unaLinea(cuerpo) }
    : { tipo: 'texto', texto: unaLinea(cuerpo) };
}

/** Los saltos de línea de un mensaje largo no caben en una fila. */
function unaLinea(texto: string): string {
  return texto.replace(/\s+/gu, ' ');
}
