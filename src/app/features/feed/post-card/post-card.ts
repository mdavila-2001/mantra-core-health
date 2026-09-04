import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type {
  CommentThreadItem,
  NewCommentMedia,
  PostListItem,
  ReactionType,
} from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../shared/components/molecules/card/card';
import { CommentMediaPicker } from '../../../shared/components/molecules/comment-media-picker/comment-media-picker';
import { FilePreviewImage } from '../../../shared/components/molecules/file-preview-image/file-preview-image';

/** Cuántos comentarios raíz se piden por página del hilo. */
const COMMENTS_PAGE_SIZE = 20;

/** Las dos reacciones que la tarjeta ofrece, con su etiqueta. */
export const REACCIONES_OFRECIDAS: readonly {
  readonly tipo: ReactionType;
  readonly label: string;
}[] = [
  { tipo: 'LIKE', label: 'Me sirve' },
  { tipo: 'INSIGHTFUL', label: 'Me hizo pensar' },
];

/**
 * Una publicación del muro.
 *
 * ## Está en `features/feed/` y no en el banco, a propósito
 *
 * El carril la pedía reusable por el muro por-perfil. Reusable no es lo mismo
 * que del banco: una pieza del banco no conoce el dominio, y ésta habla de
 * publicaciones, reacciones y `CommunityClient`. Vive acá y se importa desde
 * donde haga falta — el día que exista una segunda superficie que la use se ve
 * si conviene mover algo, pero adelantarlo sería inventar la abstracción antes
 * del segundo caso.
 *
 * ## El conteo lo trae la lectura, no el gesto
 *
 * `post().reactions` y `post().commentCount` vienen con la fila. Antes el
 * contador arrancaba en cero y sólo subía con lo que el usuario acababa de
 * hacer: al recargar, una publicación con doce reacciones mostraba cero, y el
 * botón propio aparecía apagado aunque la reacción estuviera guardada. Los
 * signals locales son **delta sobre lo leído**, no la verdad.
 *
 * ## La reacción es optimista, y por qué eso está bien acá
 *
 * El conteo se mueve antes de que el servidor conteste, y vuelve atrás si falla.
 * Es aceptable porque **una reacción no es un dato clínico**: si se pierde, no
 * pasa nada grave y el gesto se repite. La misma técnica sobre una receta sería
 * inaceptable.
 *
 * Dos clicks rápidos no producen dos reacciones: `reaccionando` corta la segunda
 * llamada, y de todos modos el backend hace *upsert* sobre la clave
 * `(actor, objeto)`.
 *
 * ## Lo que no hace
 *
 * No trae el nombre del autor: la lectura del muro devuelve
 * `authorPublicProfileId` y nada más. Resolverlo serían N peticiones por
 * pantalla; lo correcto es que el backend lo incluya en `FeedListItem`, y hasta
 * entonces se muestra el identificador acortado en vez de inventar un nombre.
 *
 * ## Puntos de extensión
 *
 * - **Imágenes (P5).** `PostListItem` no trae medios; el detalle sí. Cuando P5
 *   los habilite, se pintan entre el cuerpo y el pie sin tocar el resto.
 * - **Reportar (P6).** La acción se pinta sólo si `puedeReportar` la habilita y
 *   se emite como `reportar`: un botón que no reporta nada es peor que ninguno.
 */
@Component({
  selector: 'app-post-card',
  imports: [AppButton, Badge, Card, CommentMediaPicker, DatePipe, FilePreviewImage, Textarea],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  private readonly community = inject(CommunityClient);

  private readonly mediaPicker = viewChild(CommentMediaPicker);

  /** La publicación a pintar. */
  readonly post = input.required<PostListItem>();

  /**
   * Quién mira, si hay sesión con perfil público.
   *
   * Sin actor la tarjeta se lee igual pero **no se puede escribir**: reaccionar,
   * comentar y guardar exigen el perfil, y el contrato no lo deduce de la
   * sesión.
   */
  readonly actorProfileId = input<string | null>(null);

  /**
   * Si la publicación está guardada por quien mira.
   *
   * Lo sabe quien contiene la tarjeta —la lista de marcadores es una lectura
   * aparte, y pedirla una vez por tarjeta serían N peticiones—. `null` es «no se
   * sabe», y entonces el botón no afirma ninguno de los dos estados.
   */
  readonly guardado = input<boolean | null>(null);

  /**
   * Punto de extensión P6: habilita la acción «Reportar».
   *
   * Es un input explícito y no la mera presencia de un suscriptor de `reportar`,
   * porque Angular no publica cuántos oyentes tiene un `output()` — y adivinarlo
   * dejaría el botón dependiendo de un detalle que el framework no garantiza.
   * Mientras nadie lo habilite, la acción no se pinta: un botón que no reporta
   * nada es peor que ninguno.
   */
  readonly puedeReportar = input(false);

  /**
   * Se emite con el id de la publicación cuando se pide reportarla.
   *
   * No hay estado propio ni llamada acá: reportar es una escritura de
   * moderación, y quien la conoce es el carril que la implementa.
   */
  readonly reportar = output<string>();

  /** Se emite cuando algo quedó guardado en el servidor, por si la lista recarga. */
  readonly cambio = output<void>();

  /** Se emite al alternar el marcador, con el estado que quedó pedido. */
  readonly guardarCambiado = output<boolean>();

  protected readonly reacciones = REACCIONES_OFRECIDAS;

  /** Delta local sobre el total leído, por la reacción optimista. */
  private readonly deltaReacciones = signal(0);

  /**
   * La reacción propia mientras dura el gesto.
   *
   * `undefined` significa «lo que dijo el servidor»; cualquier otro valor es lo
   * que el usuario acaba de elegir y todavía no se confirmó.
   */
  private readonly reaccionLocal = signal<ReactionType | null | undefined>(
    undefined,
  );

  private readonly reaccionando = signal(false);
  protected readonly error = signal('');

  protected readonly comentarios = signal<readonly CommentThreadItem[]>([]);
  protected readonly hiloAbierto = signal(false);
  protected readonly cargandoHilo = signal(false);
  protected readonly nuevoComentario = signal('');
  protected readonly comentando = signal(false);
  private readonly comentariosAgregados = signal(0);

  /** Lo que el picker de adjuntos (REQ-01-011) tiene listo para mandar. */
  protected readonly mediaAdjunta = signal<readonly NewCommentMedia[]>([]);

  protected readonly puedeEscribir = computed(
    () => this.actorProfileId() !== null,
  );

  /** El autor, acortado. No es su nombre: la lectura no lo trae. */
  protected readonly autor = computed(() =>
    this.post().authorPublicProfileId.slice(0, 8),
  );

  /** Lo leído más lo que este gesto sumó o restó. */
  protected readonly totalReacciones = computed(
    () => this.post().reactions.total + this.deltaReacciones(),
  );

  /** La reacción propia: la local si hay gesto en curso, si no la del servidor. */
  protected readonly reaccionPropia = computed(() => {
    const local = this.reaccionLocal();
    return local === undefined
      ? (this.post().reactions.actorReactionType ?? null)
      : local;
  });

  protected readonly totalComentarios = computed(
    () => this.post().commentCount + this.comentariosAgregados(),
  );

  /** Los comentarios se pueden abrir sólo si la publicación los admite. */
  protected readonly admiteComentarios = computed(
    () => this.post().commentsEnabled !== false,
  );

  protected reaccionar(tipo: ReactionType): void {
    const actor = this.actorProfileId();
    if (actor === null || this.reaccionando()) {
      return;
    }

    const anterior = this.reaccionPropia();
    const deltaAnterior = this.deltaReacciones();

    // Optimista: el gesto se siente inmediato. Sólo suma si antes no había
    // ninguna reacción propia; cambiar de tipo no agrega una segunda, porque el
    // backend hace upsert sobre `(actor, objeto)`.
    this.reaccionando.set(true);
    this.reaccionLocal.set(tipo);
    if (anterior === null) {
      this.deltaReacciones.update((delta) => delta + 1);
    }
    this.error.set('');

    this.community
      .react({
        actorProfileId: actor,
        reactableType: 'POST',
        reactableRefId: this.post().id,
        reactionType: tipo,
      })
      .subscribe({
        next: () => {
          this.reaccionando.set(false);
          this.cambio.emit();
        },
        error: () => {
          this.reaccionLocal.set(anterior);
          this.deltaReacciones.set(deltaAnterior);
          this.reaccionando.set(false);
          this.error.set('No pudimos guardar tu reacción.');
        },
      });
  }

  /**
   * Abre o cierra el hilo, releyéndolo cada vez que se abre.
   *
   * **No se cachea**, y no por descuido: un hilo guardado de la vez anterior
   * muestra la conversación de hace diez minutos como si fuera la de ahora, y
   * quien lo abre lo hace justamente para ver si alguien contestó. Es una
   * petición por gesto deliberado, no por render.
   */
  protected alternarHilo(): void {
    const abierto = !this.hiloAbierto();
    this.hiloAbierto.set(abierto);
    if (abierto) {
      this.cargarHilo();
    }
  }

  protected alternarGuardado(): void {
    const actor = this.actorProfileId();
    if (actor === null) {
      return;
    }

    // `null` —no se sabe si estaba guardado— se trata como «no estaba»: es lo
    // único que se puede intentar sin afirmar un estado que no se leyó.
    const estaba = this.guardado() === true;
    const marcador = {
      profileId: actor,
      bookmarkableType: 'POST' as const,
      bookmarkableRefId: this.post().id,
    };
    this.error.set('');

    // `Observable<unknown>`: las dos llamadas devuelven formas distintas —una el
    // id creado, la otra si quitó algo— y acá no se usa ninguna de las dos. Sin
    // el tipo común, TypeScript no puede suscribirse a la unión.
    const peticion: Observable<unknown> = estaba
      ? this.community.unbookmark(marcador)
      : this.community.bookmark(marcador);

    peticion.subscribe({
      next: () => {
        this.guardarCambiado.emit(!estaba);
        this.cambio.emit();
      },
      error: () =>
        this.error.set(
          estaba
            ? 'No pudimos quitar el marcador.'
            : 'No pudimos guardar la publicación.',
        ),
    });
  }

  protected comentar(): void {
    const actor = this.actorProfileId();
    const texto = this.nuevoComentario().trim();
    if (actor === null || texto.length === 0 || this.comentando()) {
      return;
    }

    this.comentando.set(true);
    this.error.set('');

    const media = this.mediaAdjunta();

    this.community
      .createComment({
        authorProfileId: actor,
        commentableRefId: this.post().id,
        bodyText: texto,
        ...(media.length > 0 ? { media } : {}),
      })
      .subscribe({
        next: () => {
          this.nuevoComentario.set('');
          this.mediaAdjunta.set([]);
          this.mediaPicker()?.limpiar();
          this.comentando.set(false);
          this.comentariosAgregados.update((cuantos) => cuantos + 1);
          // Se relee el hilo en vez de insertar a mano: el servidor decide la
          // profundidad, el orden y el `rootCommentId`, y componer eso en el
          // cliente es reimplementar su regla de anidado.
          this.cargarHilo();
          this.cambio.emit();
        },
        error: () => {
          this.comentando.set(false);
          this.error.set('No pudimos publicar tu comentario.');
        },
      });
  }

  private cargarHilo(): void {
    const actor = this.actorProfileId();
    this.cargandoHilo.set(true);

    this.community
      .listComments(this.post().id, {
        limit: COMMENTS_PAGE_SIZE,
        ...(actor === null ? {} : { actorProfileId: actor }),
      })
      .subscribe({
        next: (pagina) => {
          this.comentarios.set(pagina.items);
          this.cargandoHilo.set(false);
        },
        error: () => {
          this.cargandoHilo.set(false);
          this.error.set('No pudimos cargar los comentarios.');
        },
      });
  }
}
