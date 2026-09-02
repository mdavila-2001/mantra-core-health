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
  signal,
  type OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import {
  PUBLIC_PROFILE_PREFIX,
  type PublicComment,
  type PublicSocialActor,
} from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';

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
  selector: 'app-publicacion-comentarios',
  imports: [DatePipe, NgTemplateOutlet, RouterLink],
  templateUrl: './publicacion-comentarios.html',
  styleUrl: './publicacion-comentarios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicacionComentarios implements OnInit {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly router = inject(Router);
  private readonly sesion = inject(SessionStore);

  readonly postId = input.required<string>();

  /** Si hay sesión: sin ella, «Responder» manda a entrar con retorno. */
  protected readonly haySesion = this.sesion.isAuthenticated;

  private readonly comentarios = signal<readonly PublicComment[]>([]);
  private readonly cursor = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly fallo = signal(false);

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

    this.cargandoRespuestas.update((ids) => [...ids, commentId]);
    this.directorio.commentReplies(commentId, { limit: TAMANO_DE_PAGINA }).subscribe({
      next: (pagina) => {
        this.respuestas.update((abiertas) => ({ ...abiertas, [commentId]: pagina.items }));
        this.dejarDeCargarRespuestas(commentId);
      },
      error: () => this.dejarDeCargarRespuestas(commentId),
    });
  }

  /**
   * «Responder» (AC-01-12).
   *
   * Sin sesión no se esconde el botón: se ofrece y lleva a `/auth` con retorno
   * a esta misma URL, que es lo que AC-01-17 pide para toda acción que exige
   * cuenta en la superficie pública. Esconderlo dejaría a un anónimo sin saber
   * que puede responder.
   *
   * Con sesión, el redactor vive en el muro con sesión: se lo manda ahí en vez
   * de duplicar acá un compositor que además tendría que resolver el adjunto de
   * AC-01-14, que hoy no tiene dónde guardarse (no existe `comment_media`).
   */
  protected responder(): void {
    if (!this.haySesion()) {
      void this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    void this.router.navigate(['/feed'], { queryParams: { post: this.postId() } });
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
      error: () => {
        this.cargandoMas.set(false);
        this.fallo.set(true);
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
        this.cursor.set(pagina.nextCursor);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.fallo.set(true);
      },
    });
  }
}
