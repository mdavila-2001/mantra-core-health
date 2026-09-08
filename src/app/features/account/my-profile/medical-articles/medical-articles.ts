import { DatePipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { CommunityClient } from '../../../../core/data-access/community/community.client';
import type {
  CommentThreadItem,
  PostDetail,
} from '../../../../core/data-access/community/community.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** Largo máximo de un artículo. El backend no lo acota más de lo que la prosa pide. */
const CUERPO_MAXIMO = 20000;

/** Cuántos caracteres del cuerpo se muestran en la tarjeta antes de «ver más». */
const RESUMEN_MAXIMO = 280;

/** Un artículo médico ya resuelto, con lo que la pantalla necesita de él. */
export interface ArticuloVisible {
  readonly post: PostDetail;
  readonly resumen: string;
  readonly recortado: boolean;
}

/**
 * **Mis artículos médicos** — publicar, revisar los ya publicados y ver sus
 * comentarios.
 *
 * ## Por qué un artículo es un post con una etiqueta, y no un tipo nuevo
 *
 * El backend no distingue un «artículo» de cualquier otra publicación: los dos
 * son un `post` de la vitrina. Inventar un tipo de contenido nuevo —tabla,
 * endpoints, validaciones— para lo que ya se puede expresar con un post y un
 * hashtag habría duplicado un módulo entero que ya funciona. `articulo-medico`
 * es la única diferencia, y la pone `CommunityClient.publishPost` cuando se
 * publica desde acá.
 *
 * ## Por qué la lista se arma con una lectura por artículo
 *
 * El listado de publicaciones (`GET .../posts`) no trae hashtags — sólo el
 * detalle de cada una los trae. Distinguir cuáles son artículos exige pedir el
 * detalle de cada publicación de la página. Es aceptable acá porque **es la
 * propia vitrina**: una página acotada (50) de las publicaciones de una sola
 * persona, no un muro ajeno ni un listado sin límite.
 *
 * ## Los comentarios se piden al abrir, no al listar
 *
 * Mostrar un contador de comentarios en cada tarjeta exigiría una lectura más
 * por artículo además de la que ya hace falta para saber si es un artículo. Se
 * prefiere pedir el hilo completo sólo cuando alguien lo abre: el costo cae
 * sobre quien realmente lo necesita, no sobre cada carga de la pantalla.
 */
@Component({
  selector: 'app-medical-articles',
  imports: [
    Alert,
    AppButton,
    Card,
    DatePipe,
    FormActions,
    FormField,
    PageHeader,
    RouterLink,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './medical-articles.html',
  styleUrl: './medical-articles.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalArticles {
  /**
   * Montado dentro de otra pantalla —la pestaña «Mis Artículos» de
   * `/my-account`— en vez de como ruta propia.
   *
   * Lo único que cambia es la cabecera: una pestaña que repite el
   * `app-page-header` de la página que la contiene dibuja dos títulos y dos
   * migas de pan, una debajo de la otra. El resto —publicar, listar, comentar—
   * es idéntico, y por eso es un input y no un componente aparte.
   */
  readonly embedded = input(false, { transform: booleanAttribute });

  private readonly community = inject(CommunityClient);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly profileId = signal<string | null>(null);
  /** Si ya se supo que esta sesión no tiene vitrina. Distinto de «cargando». */
  private readonly sinVitrina = signal(false);

  protected readonly articulos = signal<ViewState<readonly ArticuloVisible[]>>(loading());

  protected readonly cuerpoMaximo = CUERPO_MAXIMO;

  /* -- Publicar --------------------------------------------------------------- */

  protected readonly nuevoCuerpo = signal('');
  protected readonly publicando = signal(false);

  protected readonly puedePublicar = computed(() => this.nuevoCuerpo().trim() !== '');

  /* -- Comentarios, por artículo ------------------------------------------------
     Un solo hilo abierto a la vez: dos hilos abiertos y dos formularios de
     comentario en la misma pantalla es más superficie de la que hace falta
     para leer los comentarios de un artículo. */

  protected readonly abierto = signal<string | null>(null);
  protected readonly comentarios = signal<ViewState<readonly CommentThreadItem[]>>(loading());
  protected readonly nuevoComentario = signal('');
  protected readonly comentando = signal(false);

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  protected readonly sinVitrinaTodavia = this.sinVitrina.asReadonly();

  private cargar(): void {
    this.articulos.set(loading());
    this.sinVitrina.set(false);

    this.community
      .getOwnProfile()
      .pipe(
        switchMap((perfil) => {
          if (perfil === null) {
            return of(null);
          }
          this.profileId.set(perfil.id);
          return this.community.listProfilePosts(perfil.id, { limit: 50 });
        }),
        switchMap((pagina) => {
          if (pagina === null || pagina.items.length === 0) {
            return of([] as readonly PostDetail[]);
          }
          // Una lectura por publicación de la página: ver la nota de clase
          // sobre por qué es aceptable acá.
          return forkJoin(pagina.items.map((item) => this.community.readPost(item.id)));
        }),
      )
      .subscribe({
        next: (detalles) => {
          if (this.profileId() === null) {
            this.sinVitrina.set(true);
            this.articulos.set(ready([]));
            return;
          }
          const soloArticulos = detalles
            .filter((post) => post.hashtags.some((h) => h.tag === 'articulo-medico'))
            .map(aVisible);
          this.articulos.set(ready(soloArticulos));
        },
        error: (error: unknown) =>
          this.articulos.set(errorToViewState<readonly ArticuloVisible[]>(error)),
      });
  }

  protected publicar(): void {
    const profileId = this.profileId();
    const cuerpo = this.nuevoCuerpo().trim();
    if (profileId === null || cuerpo === '' || this.publicando()) {
      return;
    }

    this.publicando.set(true);
    this.community.publishPost(profileId, { bodyText: cuerpo }, true).subscribe({
      next: () => {
        this.publicando.set(false);
        this.nuevoCuerpo.set('');
        this.toasts.success('Tu artículo quedó publicado.', 'Artículos médicos');
        this.cargar();
      },
      error: () => {
        this.publicando.set(false);
        this.toasts.error('No se pudo publicar el artículo. Probá de nuevo.', 'Artículos médicos');
      },
    });
  }

  /** Abre el hilo de un artículo, o lo cierra si ya estaba abierto. */
  protected alternarComentarios(postId: string): void {
    if (this.abierto() === postId) {
      this.abierto.set(null);
      return;
    }
    this.abierto.set(postId);
    this.nuevoComentario.set('');
    this.comentarios.set(loading());
    this.community
      .listComments(postId)
      .pipe(
        catchError((error: unknown) => of(errorToViewState<readonly CommentThreadItem[]>(error))),
      )
      .subscribe((resultado) => {
        // Un hilo vacío se resuelve `ready([])` y no `empty(...)`: no hay una
        // acción de salida sensata para «todavía no hay comentarios en ESTE
        // artículo» —no es «elegí otra organización» ni «volvé al listado»—, así
        // que la plantilla dice el vacío directamente sobre la lista vacía.
        this.comentarios.set('items' in resultado ? ready(resultado.items) : resultado);
      });
  }

  protected comentar(): void {
    const profileId = this.profileId();
    const postId = this.abierto();
    const cuerpo = this.nuevoComentario().trim();
    if (profileId === null || postId === null || cuerpo === '' || this.comentando()) {
      return;
    }

    this.comentando.set(true);
    this.community
      .createComment({ authorProfileId: profileId, commentableRefId: postId, bodyText: cuerpo })
      .subscribe({
        next: () => {
          this.comentando.set(false);
          this.nuevoComentario.set('');
          this.alternarComentarios(postId); // cierra
          this.alternarComentarios(postId); // reabre: recarga el hilo con lo nuevo
        },
        error: () => {
          this.comentando.set(false);
          this.toasts.error('No se pudo publicar el comentario. Probá de nuevo.', 'Comentarios');
        },
      });
  }
}

/** Recorta el cuerpo para la tarjeta; el detalle completo se ve al abrir. */
function aVisible(post: PostDetail): ArticuloVisible {
  const recortado = post.bodyText.length > RESUMEN_MAXIMO;
  return {
    post,
    resumen: recortado ? `${post.bodyText.slice(0, RESUMEN_MAXIMO).trimEnd()}…` : post.bodyText,
    recortado,
  };
}
