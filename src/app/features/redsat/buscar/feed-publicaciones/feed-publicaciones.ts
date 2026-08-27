import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicFeedPost } from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';
import { PublicacionPost } from '../../../public-profile/publicacion-post/publicacion-post';

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
  imports: [RouterLink, PublicacionPost],
  templateUrl: './feed-publicaciones.html',
  styleUrl: './feed-publicaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedPublicaciones {
  private readonly directorio = inject(PublicDirectoryClient);

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
