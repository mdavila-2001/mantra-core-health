import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicFeedPost } from '@core/data-access/public-directory/public-directory.types';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { inicialesDe } from '@shared/text/iniciales';
import { ReportPost } from '../../../feed/report-post/report-post';
import { PublicPostCard } from '../../../public-profile/public-post-card/public-post-card';

/** En qué estado está la pantalla, para el `@switch` de la plantilla. */
type EstadoFeed = 'carga' | 'datos' | 'vacio' | 'error';

/**
 * **La portada pública: lo último que publicaron todos los profesionales.**
 *
 * ## Por qué es la primera pantalla y no el buscador
 *
 * Quien entra sin sesión no trae todavía el nombre de un médico en la cabeza:
 * un buscador vacío le pide justamente el dato que no tiene. Un compilado de lo
 * último escrito sí se puede leer sin saber nada de antemano, y de cada tarjeta
 * se llega a la ficha de quien la escribió — que es el camino que el buscador
 * pedía adivinar de entrada.
 *
 * ## Por qué acumula en vez de paginar con botones
 *
 * Es un feed: la lectura es continua y hacia abajo. Cada «Ver más
 * publicaciones» concatena la página siguiente al final en vez de reemplazar
 * la lista, así que volver a lo ya leído es subir, no pedir la página anterior.
 * El cursor viene del servidor y es opaco; cuando llega `null`, no hay más.
 */
@Component({
  selector: 'app-feed-publicaciones',
  imports: [ReportPost, RouterLink, PublicPostCard],
  templateUrl: './feed-publicaciones.html',
  styleUrl: './feed-publicaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedPublicaciones {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly avisos = inject(ToastService);
  private readonly router = inject(Router);

  /* ---- las tres acciones de dominio del menú (AC-01-15) ------------------ */

  /**
   * Qué publicación se está denunciando, o `null`.
   *
   * El formulario de denuncia reemplaza a la tarjeta en su lugar de la lista,
   * como ya hace el muro con sesión (`features/feed/feed.html`): abrirlo en un
   * modal sacaría de contexto de qué publicación se está hablando.
   */
  protected readonly denunciando = signal<string | null>(null);

  protected abrirDenuncia(postId: string): void {
    this.denunciando.set(postId);
  }

  protected cerrarDenuncia(): void {
    this.denunciando.set(null);
  }

  /**
   * «No ver más este tipo de publicaciones» — **sin destino todavía**.
   *
   * No hay dónde guardarlo: no existe tabla de preferencias de feed. Lo más
   * cercano es `community.user_blocks`, que bloquea al **autor** y no es lo
   * mismo, y `community.topics` / `content_hashtags`, que etiquetan el
   * contenido. Cuál de esos tres es «este tipo» es la pregunta abierta P-01-3
   * de la ficha, y hasta que se responda no se modela nada.
   *
   * Se avisa en vez de callar: un ítem de menú que no hace nada al tocarlo se
   * lee como una aplicación rota, y esconderlo iría contra AC-01-15, que exige
   * las siete entradas.
   */
  protected pedirOcultar(): void {
    this.avisos.info('Todavía no podés ajustar qué tipo de publicaciones ves. Está en camino.');
  }

  /**
   * «Contactarme con este doctor» — **sin destino definido** (P-01-1).
   *
   * El pedido no dice por dónde: el chat interno (`community/conversations`,
   * que existe), una solicitud de consulta, o el teléfono de la ficha. Son tres
   * implementaciones distintas y elegir una por cuenta propia es decidir el
   * producto. Mientras tanto se manda a la ficha del profesional, que es donde
   * están sus vías de contacto reales, y se dice que es eso.
   */
  protected pedirContacto(slug: string): void {
    this.avisos.info('Sus vías de contacto están en su perfil.');
    void this.router.navigate(['/p', slug]);
  }

  protected readonly publicaciones = signal<readonly PublicFeedPost[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly fallo = signal(false);

  protected readonly hayMas = computed(() => this.cursor() !== null);

  protected readonly estado = computed<EstadoFeed>(() => {
    if (this.cargando()) return 'carga';
    if (this.fallo()) return 'error';
    return this.publicaciones().length === 0 ? 'vacio' : 'datos';
  });

  constructor() {
    this.cargar();
  }

  /** Las iniciales del autor, para cuando no tiene foto. */
  protected iniciales(post: PublicFeedPost): string {
    return inicialesDe(post.authorDisplayName);
  }

  protected reintentar(): void {
    this.cargar();
  }

  /** La página siguiente se **concatena**: un feed no reemplaza lo ya leído. */
  protected verMas(): void {
    const desde = this.cursor();
    if (desde === null || this.cargandoMas()) return;

    this.cargandoMas.set(true);
    this.directorio.feedPublico({ cursor: desde }).subscribe({
      next: (pagina) => {
        this.publicaciones.update((previas) => [...previas, ...pagina.items]);
        this.cursor.set(pagina.nextCursor);
        this.cargandoMas.set(false);
      },
      error: () => {
        // Un fallo al pedir MÁS no borra lo que ya se está leyendo: se corta
        // la paginación y lo cargado se queda en pantalla.
        this.cursor.set(null);
        this.cargandoMas.set(false);
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.directorio.feedPublico({}).subscribe({
      next: (pagina) => {
        this.publicaciones.set(pagina.items);
        this.cursor.set(pagina.nextCursor);
        this.cargando.set(false);
      },
      error: () => {
        this.fallo.set(true);
        this.cargando.set(false);
      },
    });
  }
}
