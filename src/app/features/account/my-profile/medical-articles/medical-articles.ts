import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';
import { catchError, concatMap, map, switchMap, toArray } from 'rxjs/operators';

import { CommunityClient } from '../../../../core/data-access/community/community.client';
import { FilesClient } from '../../../../core/data-access/files/files.client';
import type {
  CommentThreadItem,
  NewPostMedia,
  OwnPublicProfile,
  PostDetail,
} from '../../../../core/data-access/community/community.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Avatar } from '../../../../shared/components/atoms/avatar/avatar';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { ArticleBody } from '../../../../shared/components/organisms/article-body/article-body';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { articlePlainText } from '../../../../shared/text/article-markup';
import { VitrinaMinima } from '../../../communities/minimal-showcase/minimal-showcase';
import { ArticleComposer, type ArticleDraft } from './article-composer/article-composer';

/**
 * Largo máximo de un artículo, ya convertido a su formato (marcas incluidas).
 *
 * Es el tope de `CreatePostDto.bodyText` desde que se subió de 5 000 a 20 000
 * para los artículos (30/09/2026): antes la pantalla prometía 20 000 y el
 * servidor rechazaba todo lo que pasara de 5 000.
 */
const CUERPO_MAXIMO = 20000;

/** Cuántos caracteres del cuerpo se muestran en la tarjeta antes de «ver más». */
const RESUMEN_MAXIMO = 280;

/** Un artículo médico ya resuelto, con lo que la pantalla necesita de él. */
export interface ArticuloVisible {
  readonly post: PostDetail;
  readonly resumen: string;
  readonly recortado: boolean;
}

/** Una imagen que no se pudo subir: qué número era, para decírselo a quien publica. */
class SubidaFallida extends Error {
  constructor(readonly numero: number) {
    super(`No se pudo subir la imagen ${numero}`);
  }
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
    ArticleBody,
    ArticleComposer,
    Avatar,
    BackLink,
    Card,
    DatePipe,
    FormActions,
    FormField,
    NavIcon,
    PageHeader,
    RouterLink,
    Textarea,
    ViewStateHost,
    VitrinaMinima,
  ],
  templateUrl: './medical-articles.html',
  styleUrl: './medical-articles.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalArticles {
  private readonly community = inject(CommunityClient);
  private readonly files = inject(FilesClient);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly profileId = signal<string | null>(null);

  /* -- Quién firma ------------------------------------------------------------
     Sale de la MISMA lectura de la vitrina que esta pantalla ya hacía para
     saber si existe. No es una petición nueva: es un dato que llegaba y se
     descartaba. */

  private readonly autor = signal<OwnPublicProfile | null>(null);

  /** El nombre con el que se firma. Vacío mientras la vitrina no llegó. */
  protected readonly autorNombre = computed(() => this.autor()?.displayName ?? '');

  /**
   * La foto de la vitrina, resuelta a su URL pública.
   *
   * Mismo camino que «Configurar mi vitrina» (`/public/media/<id>`). Sin foto
   * devuelve `null` y el avatar cae solo a las iniciales del nombre.
   */
  protected readonly autorFoto = computed(() => {
    const id = this.autor()?.avatarFileId;
    return id == null ? null : `/public/media/${id}`;
  });

  /**
   * Si la vitrina está listada públicamente.
   *
   * Gobierna lo que la cabecera DICE, no lo que el compositor hace: publicar en
   * una vitrina privada sigue siendo posible y el backend decide igual que
   * antes. Lo que cambia es que la pantalla deja de prometer «se publica en tu
   * vitrina pública» cuando esa vitrina no es pública.
   */
  protected readonly vitrinaEsPublica = computed(() => this.autor()?.visibility === 'PUBLIC');
  /** Si ya se supo que esta sesión no tiene vitrina. Distinto de «cargando». */
  private readonly sinVitrina = signal(false);

  protected readonly articulos = signal<ViewState<readonly ArticuloVisible[]>>(loading());

  protected readonly cuerpoMaximo = CUERPO_MAXIMO;

  /* -- Publicar --------------------------------------------------------------- */

  private readonly compositor = viewChild(ArticleComposer);

  /** Dónde guarda el compositor el borrador en este navegador: uno por vitrina. */
  protected readonly claveDelBorrador = computed(() => {
    const id = this.profileId();
    return id === null ? null : `mch.article-draft.${id}`;
  });
  protected readonly publicando = signal(false);

  protected readonly puedePublicar = computed(() => this.compositor()?.ready() ?? false);

  /* -- Leer un artículo entero -------------------------------------------------
     La tarjeta muestra el resumen; «Leer artículo» lo despliega con sus
     secciones. Las imágenes se piden al abrir, no al listar: son las propias,
     y bajarlas para cincuenta tarjetas que nadie abrió sería pagar de más. */

  protected readonly leyendo = signal<string | null>(null);
  protected readonly imagenesDelArticulo = signal<readonly (string | null)[]>([]);

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

  /**
   * Recién creada la vitrina, la pantalla pasa a ser la de siempre.
   *
   * Se recarga en vez de sembrar los signals con lo que devolvió el `PUT`:
   * publicar necesita `profileId` y la lista de artículos, y el camino que ya
   * existe los trae juntos. Una vitrina recién creada no tiene artículos, así
   * que la relectura es barata.
   */
  protected alCrearLaVitrina(): void {
    this.cargar();
  }

  private cargar(): void {
    this.articulos.set(loading());
    this.sinVitrina.set(false);
    this.autor.set(null);

    this.community
      .getOwnProfile()
      .pipe(
        switchMap((perfil) => {
          if (perfil === null) {
            return of(null);
          }
          this.profileId.set(perfil.id);
          this.autor.set(perfil);
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

  /**
   * Sube las imágenes, en orden, y publica el artículo con ellas.
   *
   * **En serie y todo o nada.** Si una imagen no sube, no se publica nada: un
   * artículo con un hueco donde iba la radiografía es peor que uno que todavía
   * no salió, y lo escrito queda intacto en el compositor para reintentar.
   * Los archivos que sí subieron quedan huérfanos en `common.files`; no hay
   * contrato para borrarlos desde acá (anotado en PENDIENTES-BACKEND).
   *
   * @param borrador - Lo que armó el compositor.
   */
  protected publicar(borrador: ArticleDraft): void {
    const profileId = this.profileId();
    const cuerpo = borrador.bodyText.trim();
    if (profileId === null || cuerpo === '' || this.publicando()) {
      return;
    }

    this.publicando.set(true);
    const subidas = borrador.images.length === 0
      ? of([] as readonly NewPostMedia[])
      : of(...borrador.images.map((imagen, ordinal) => ({ imagen, ordinal }))).pipe(
          concatMap(({ imagen, ordinal }) =>
            this.files.upload(imagen.file, 'IMAGE', 'NORMAL').pipe(
              map((subido): NewPostMedia => ({ fileId: subido.id, mediaRole: 'IMAGE', altText: imagen.alt, ordinal })),
              catchError(() => throwError(() => new SubidaFallida(ordinal + 1))),
            ),
          ),
          toArray(),
        );

    subidas
      .pipe(switchMap((media) => this.community.publishPost(profileId, { bodyText: cuerpo, media }, true)))
      .subscribe({
        next: () => {
          this.publicando.set(false);
          this.compositor()?.reset();
          this.toasts.success('Su artículo quedó publicado.', 'Artículos médicos');
          this.cargar();
        },
        error: (error: unknown) => {
          this.publicando.set(false);
          this.toasts.error(
            error instanceof SubidaFallida
              ? `No se pudo subir la imagen ${error.numero}. Su artículo no se publicó y sigue acá: pruebe de nuevo.`
              : 'No se pudo publicar el artículo. Su texto sigue acá: pruebe de nuevo.',
            'Artículos médicos',
          );
        },
      });
  }

  /** Despliega un artículo entero, o vuelve al resumen si ya estaba abierto. */
  protected alternarLectura(articulo: ArticuloVisible): void {
    if (this.leyendo() === articulo.post.id) {
      this.leyendo.set(null);
      return;
    }
    this.leyendo.set(articulo.post.id);
    const medios = [...articulo.post.media].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    this.imagenesDelArticulo.set(medios.map(() => null));
    if (medios.length === 0) return;
    // Son archivos propios: el contenido lo entrega `FilesClient` a quien los
    // subió. Si falla, se cae a la URL pública, que sirve las fotos de un post
    // público de una vitrina publicada.
    forkJoin(
      medios.map((medio) =>
        this.files.imageDataUrl(medio.fileId).pipe(catchError(() => of(`/public/media/${medio.fileId}`))),
      ),
    ).subscribe((urls) => {
      if (this.leyendo() === articulo.post.id) this.imagenesDelArticulo.set(urls);
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
          this.toasts.error('No se pudo publicar el comentario. Pruebe de nuevo.', 'Comentarios');
        },
      });
  }
}

/** Recorta el cuerpo para la tarjeta; el detalle completo se ve al abrir. */
function aVisible(post: PostDetail): ArticuloVisible {
  // El resumen se arma sin marcas: una tarjeta que empieza con «## Síntomas»
  // o con «![](imagen:0)» se lee como un error, no como un artículo.
  const plano = articlePlainText(post.bodyText);
  const recortado = plano.length > RESUMEN_MAXIMO;
  return {
    post,
    resumen: recortado ? `${plano.slice(0, RESUMEN_MAXIMO).trimEnd()}…` : plano,
    recortado,
  };
}
