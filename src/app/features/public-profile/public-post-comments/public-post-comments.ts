/* ============================================================================
    El hilo de comentarios de una publicación pública (AC-01-11 a AC-01-13).

    ## Desplegable, no modal — y es una decisión del pedido

    El propietario lo dice explícito: los likes en modal, los comentarios en un
    desplegable. Tiene sentido: la lista de quién reaccionó se mira y se cierra,
    mientras que leer comentarios es leer la publicación, y un modal tapa
    justamente el texto del que se está hablando.

    ## El más destacado primero (AC-01-13), y por qué ese criterio

    La ficha deja abierto qué es «destacado» (P-01-4). De lo que la API sirve por
    comentario —`replyCount`, `createdAt`, autor— **el único indicador de que
    algo generó conversación es la cantidad de respuestas**: el recuento de
    reacciones por comentario existe en el modelo (`comments.reaction_count`)
    pero la lectura pública no lo proyecta.

    Así que el criterio es: **el que más respuestas tiene**, y a igual cantidad
    el más viejo —que es el que estuvo más tiempo disponible para que le
    respondieran—. Está escrito acá y no implícito en un `sort` perdido, y hay
    una prueba que lo fija: si mañana la API sirve reacciones por comentario,
    esto es lo único que hay que cambiar.

    Un comentario destacado **no se repite** abajo: se lo saca de la lista
    cronológica. Verlo dos veces se lee como un error de carga.
    ========================================================================== */

import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { describeApiFailure } from '@core/http/api-failure';
import {
  PUBLIC_PROFILE_PREFIX,
  type PublicComment,
  type PublicSocialActor,
} from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';
import { CommentComposer } from '../comment-composer/comment-composer';

type EstadoHilo = 'carga' | 'datos' | 'vacio' | 'error';

/** Cuántos comentarios trae cada página. El servidor recorta a `[1, 50]`. */
const TAMANO_DE_PAGINA = 20;

/**
 * El comentario más destacado de una tanda, o `null` si no hay ninguno con
 * conversación.
 *
 * Exportada para que la prueba fije el criterio sin montar el componente.
 */
export function comentarioDestacado(
  comentarios: readonly PublicComment[],
): PublicComment | null {
  // Sin respuestas nadie es «destacado»: elegir el primero por antigüedad sería
  // llamar destacado al que simplemente llegó antes.
  const conConversacion = comentarios.filter((c) => c.replyCount > 0);
  if (conConversacion.length === 0) {
    return null;
  }
  return conConversacion.reduce((mejor, actual) => {
    if (actual.replyCount !== mejor.replyCount) {
      return actual.replyCount > mejor.replyCount ? actual : mejor;
    }
    // A igual conversación gana el más viejo: estuvo más tiempo disponible.
    return actual.createdAt < mejor.createdAt ? actual : mejor;
  });
}

@Component({
  selector: 'app-public-post-comments',
  imports: [CommentComposer, DatePipe, NgTemplateOutlet, RouterLink],
  templateUrl: './public-post-comments.html',
  styleUrl: './public-post-comments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPostComments implements OnInit {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly router = inject(Router);
  private readonly sesion = inject(SessionStore);

  readonly postId = input.required<string>();

  /**
   * La vitrina de quien mira. Con ella el hilo dibuja su propio redactor
   * arriba —«Agregá un comentario…»—, como en cualquier red profesional; sin
   * ella «Responder» sigue mandando a entrar o al muro, como antes.
   */
  readonly actorProfileId = input<string | null>(null);

  /** Se publicó un comentario desde este hilo: la tarjeta suma al contador. */
  readonly comentado = output<void>();


  protected readonly haySesion = this.sesion.isAuthenticated;

  private readonly comentarios = signal<readonly PublicComment[]>([]);
  private readonly cursor = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly fallo = signal(false);
  /** Qué decir cuando la lectura falló: el motivo de la API o qué hacer, con el código de soporte. */
  protected readonly motivoDelFallo = signal('');

  /** Qué hilos de respuestas están abiertos, por id del comentario padre. */
  private readonly respuestas = signal<Readonly<Record<string, readonly PublicComment[]>>>({});
  private readonly cargandoRespuestas = signal<readonly string[]>([]);

  protected readonly estado = computed<EstadoHilo>(() => {
    if (this.fallo()) return 'error';
    if (this.cargando()) return 'carga';
    return this.comentarios().length === 0 ? 'vacio' : 'datos';
  });

  protected readonly destacado = computed(() => comentarioDestacado(this.comentarios()));

  /** El resto, en orden cronológico y sin repetir al destacado. */
  protected readonly resto = computed(() => {
    const elegido = this.destacado();
    return this.comentarios().filter((c) => c.id !== elegido?.id);
  });

  protected readonly hayMas = computed(() => this.cursor() !== null);

  /**
   * La primera lectura va en `ngOnInit` y **no** en el constructor.
   *
   * `postId` es un `input.required`, y en el constructor todavía no tiene
   * valor: leerlo ahí lanza `NG0950`. Es la clase de error que no se ve
   * escribiendo el componente —el constructor «anda»— y aparece recién cuando
   * alguien lo monta de verdad.
   */
  ngOnInit(): void {
    this.leer();
  }

  protected enlaceAutor(autor: PublicSocialActor): readonly string[] | null {
    if (autor.kind === 'MEDICATION') {
      return null;
    }
    return [`/${PUBLIC_PROFILE_PREFIX[autor.kind]}`, autor.slug];
  }

  protected iniciales(autor: PublicSocialActor): string {
    return inicialesDe(autor.displayName);
  }

  protected respuestasDe(commentId: string): readonly PublicComment[] {
    return this.respuestas()[commentId] ?? [];
  }

  protected respuestasAbiertas(commentId: string): boolean {
    return this.respuestas()[commentId] !== undefined;
  }

  protected cargandoRespuestasDe(commentId: string): boolean {
    return this.cargandoRespuestas().includes(commentId);
  }

  /** Abre o cierra las respuestas de un comentario (AC-01-12). */
  protected alternarRespuestas(commentId: string): void {
    if (this.respuestasAbiertas(commentId)) {
      this.respuestas.update((abiertas) => {
        const { [commentId]: _cerrado, ...resto } = abiertas;
        return resto;
      });
      return;
    }

    this.cargarRespuestas(commentId);
  }

  /**
   * Qué comentario tiene abierto su redactor de respuesta, o `null`.
   *
   * Uno solo a la vez: dos redactores abiertos en un hilo son dos borradores
   * que la persona tiene que recordar.
   */
  protected readonly respondiendoA = signal<string | null>(null);

  /** Respuestas agregadas en esta sesión por comentario, para que el contador acompañe. */
  private readonly respuestasNuevas = signal<Readonly<Record<string, number>>>({});

  /**
   * «Responder» abre el redactor **en línea**, bajo el comentario.
   *
   * Antes mandaba a `/feed?post=` porque el redactor con adjuntos vivía sólo en
   * el muro viejo; ese muro se eliminó y el hilo es autosuficiente. Sin sesión
   * se manda a entrar con retorno a esta misma URL (AC-01-17); con sesión pero
   * sin vitrina pública —el contrato exige el perfil del autor y no lo deduce
   * de la sesión— se lleva a crearla, igual que «Recomendar».
   */
  protected responder(commentId: string): void {
    if (!this.haySesion()) {
      void this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.actorProfileId() === null) {
      void this.router.navigate(['/my-account/profile/edit']);
      return;
    }
    this.respondiendoA.update((abierto) => (abierto === commentId ? null : commentId));
  }

  protected cerrarRespuesta(): void {
    this.respondiendoA.set(null);
  }

  /** Cuántas respuestas tiene un comentario: las que leyó el servidor más las de esta sesión. */
  protected cuantasRespuestas(comentario: PublicComment): number {
    return comentario.replyCount + (this.respuestasNuevas()[comentario.id] ?? 0);
  }

  /** Un comentario de primer nivel se publicó: se relee el hilo (el servidor decide el orden). */
  protected alComentar(): void {
    this.comentado.emit();
    this.leer();
  }

  /** Una respuesta se publicó: se cierra el redactor y se muestran las respuestas con la nueva. */
  protected alResponder(commentId: string): void {
    this.respondiendoA.set(null);
    this.respuestasNuevas.update((nuevas) => ({ ...nuevas, [commentId]: (nuevas[commentId] ?? 0) + 1 }));
    this.comentado.emit();
    this.cargarRespuestas(commentId);
  }

  private cargarRespuestas(commentId: string): void {
    this.cargandoRespuestas.update((ids) => (ids.includes(commentId) ? ids : [...ids, commentId]));
    this.directorio.commentReplies(commentId, { limit: TAMANO_DE_PAGINA }).subscribe({
      next: (pagina) => {
        this.respuestas.update((abiertas) => ({ ...abiertas, [commentId]: pagina.items }));
        this.dejarDeCargarRespuestas(commentId);
      },
      error: () => this.dejarDeCargarRespuestas(commentId),
    });
  }

  protected reintentar(): void {
    this.leer();
  }

  protected verMas(): void {
    const cursor = this.cursor();
    if (cursor === null || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.directorio.postComments(this.postId(), { cursor, limit: TAMANO_DE_PAGINA }).subscribe({
      next: (pagina) => {
        this.comentarios.update((previos) => [...previos, ...pagina.items]);
        this.cursor.set(pagina.nextCursor);
        this.cargandoMas.set(false);
      },
      error: (error: unknown) => {
        this.cargandoMas.set(false);
        this.fallar(error);
      },
    });
  }

  private dejarDeCargarRespuestas(commentId: string): void {
    this.cargandoRespuestas.update((ids) => ids.filter((id) => id !== commentId));
  }

  private leer(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.directorio.postComments(this.postId(), { limit: TAMANO_DE_PAGINA }).subscribe({
      next: (pagina) => {
        this.comentarios.set(pagina.items);
        // El `replyCount` releído ya incluye las respuestas de esta sesión:
        // sumarlas otra vez contaba dos veces.
        this.respuestasNuevas.set({});
        this.cursor.set(pagina.nextCursor);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.fallar(error);
      },
    });
  }

  private fallar(error: unknown): void {
    this.motivoDelFallo.set(describeApiFailure(error, 'Vuelva a intentarlo en un momento.'));
    this.fallo.set(true);
  }
}
