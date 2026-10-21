/**
 * Los identificadores estables de interfaz que los dos adaptadores comparten.
 *
 * ## Por qué existen, si el contrato prefiere roles y texto
 *
 * El orden de preferencia del contrato de testing es: rol o nombre accesible
 * primero, texto estable de producto después, y `data-testid` **sólo** para
 * controles sin semántica suficiente. Esta lista es esa tercera categoría.
 *
 * Casos que la justifican:
 *
 * - una tarjeta de publicación no tiene rol propio, y localizarla por su texto
 *   funciona hasta que dos publicaciones dicen lo mismo;
 * - «Publicar» y «Publicando…» son el mismo botón con dos rótulos, y esperar por
 *   texto convierte una espera en una carrera;
 * - una fila de la cola de moderación se identifica por el contenido que
 *   modera, que es un uuid y no un texto legible.
 *
 * Lo que **no** está acá y no debería estarlo: los botones que ya tienen nombre
 * accesible y texto de producto estable —«Decidir», «Confirmar decisión»—, que
 * se localizan por rol y nombre en cada adaptador.
 */
export const UI = {
  // --- P3 · muro ---
  /** El redactor de publicaciones (dentro del modal «Crear publicación» de `/posts`). */
  postComposer: 'post-composer',
  /** El área de texto del redactor. */
  postComposerBody: 'post-composer-body',
  /** El selector de visibilidad. */
  postComposerVisibility: 'post-composer-visibility',
  /** El botón de enviar, que cambia de rótulo mientras envía. */
  postComposerSubmit: 'post-composer-submit',
  /** La ranura de imágenes: existe, está apagada, y P5 la enciende. */
  postComposerMedia: 'post-composer-media',
  /**
   * Una tarjeta de publicación. Lleva el id de la publicación como sufijo, para
   * poder apuntar a una concreta sin depender de su posición en la lista.
   */
  postCard: (postId: string): string => `post-card-${postId}`,
  /** El resumen de reacciones de una tarjeta («👍 💡 24»); abre quién reaccionó. */
  postReactionCount: 'post-reactions',
  /** El total de comentarios de una tarjeta («3 comentarios»). */
  postCommentCount: 'post-comments',
  /** «Comentar» en la fila de acciones: abre y cierra el hilo. */
  postCommentsToggle: 'post-action-comment',
  /** El área de texto del comentario raíz (el redactor en línea del hilo). */
  postCommentBody: 'comment-composer-body',
  /** El botón de enviar el comentario raíz. */
  postCommentSubmit: 'comment-composer-submit',
  /** «Recomendar»: clic corto = LIKE o quitarla; mantener abre las cinco reacciones. */
  postLike: 'post-action-like',
  /** «Guardar» en la fila de acciones (`aria-pressed`). */
  postSave: 'post-action-save',
  /** El menú «…» de la tarjeta (Copiar enlace, Denunciar, …). */
  postPreferences: 'post-preferences-trigger',
  /** La pastilla «Crear publicación» de Inicio: abre el redactor en un modal. */
  feedCreateOpen: 'feed-crear-abrir',
  /** El detalle del formulario de denuncia, que reemplaza a la tarjeta en su lugar. */
  reportPostDetail: 'report-post-detail',
  /** Enviar la denuncia. */
  reportPostSubmit: 'report-post-submit',

  // --- P6 · moderación ---
  /** La pestaña de cola. */
  moderationQueueTab: 'moderation-queue-tab',
  /** La pestaña de apelaciones. */
  moderationAppealsTab: 'moderation-appeals-tab',
  /**
   * Una fila de la cola. Lleva el id del **contenido** moderado, que es lo que
   * el journey conoce: la entrada de cola la crea el sistema al reportar.
   */
  moderationQueueRow: (contentRefId: string): string =>
    `moderation-queue-row-${contentRefId}`,
  /** El motivo obligatorio de la decisión. */
  moderationRationale: 'moderation-rationale',
  /** Una fila de apelación, por su id. */
  moderationAppealRow: (appealId: string): string =>
    `moderation-appeal-row-${appealId}`,
} as const;
