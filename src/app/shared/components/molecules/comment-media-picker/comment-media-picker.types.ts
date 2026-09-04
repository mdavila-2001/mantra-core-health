/** Los tres tipos de adjunto que REQ-01-011 pide poder subir en un comentario. */
export type CommentMediaKind = 'IMAGE' | 'STICKER' | 'GIF';

/** Un adjunto ya subido a `common.files`, con lo necesario para mostrarlo y enviarlo. */
export interface CommentMediaAttachment {
  readonly fileId: string;
  readonly mediaRole: CommentMediaKind;
  /** `data:` URL para la miniatura — nunca `blob:` (la CSP no lo declara). */
  readonly previewUrl: string;
  readonly nombre: string;
}

/** Qué acepta cada botón, y con qué rol se etiqueta lo elegido ahí. */
export const COMMENT_MEDIA_OPTIONS: readonly {
  readonly kind: CommentMediaKind;
  readonly label: string;
  readonly accept: string;
  readonly testid: string;
}[] = [
  {
    kind: 'IMAGE',
    label: 'Imagen',
    accept: 'image/png,image/jpeg,image/webp',
    testid: 'comment-media-add-image',
  },
  {
    kind: 'STICKER',
    label: 'Sticker',
    accept: 'image/png,image/webp',
    testid: 'comment-media-add-sticker',
  },
  {
    kind: 'GIF',
    label: 'GIF',
    accept: 'image/gif',
    testid: 'comment-media-add-gif',
  },
];

/** Tope de adjuntos por comentario — el mismo que valida el servidor (`@ArrayMaxSize(4)`). */
export const COMMENT_MEDIA_MAX = 4;

/** 5 MB: generoso para una imagen de comentario, chico para no llenar el storage con "gifs" de 80 MB. */
export const COMMENT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
