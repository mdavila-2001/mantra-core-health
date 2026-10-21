import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { CommunityClient } from '@core/data-access/community/community.client';
import type { PostVisibility, ReactionType } from '@core/data-access/community/community.types';
import type { PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';
import { describeApiFailure } from '@core/http/api-failure';
import { BookmarkStore } from '@core/social/bookmark.store';
import { PostActorStateStore } from '@core/social/post-actor-state.store';
import { Menu } from '@shared/components/molecules/menu/menu';
import { MenuItem } from '@shared/components/molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '@shared/components/molecules/menu/menu-trigger/menu-trigger';
import { PostPreferencesMenu } from '@shared/components/molecules/post-preferences-menu/post-preferences-menu';
import { ReactionButton } from '@shared/components/molecules/reaction-button/reaction-button';
import { reaccionOfrecida } from '@shared/components/molecules/reaction-button/reaction-button.types';
import { ArticleBody } from '@shared/components/organisms/article-body/article-body';
import { tiempoRelativo } from '@shared/date/tiempo-relativo';
import { hasArticleStructure } from '@shared/text/article-markup';
import { FollowButton } from '../../social/follow-button/follow-button';
import { PublicPostComments } from '../public-post-comments/public-post-comments';
import { PublicPostReactions } from '../public-post-reactions/public-post-reactions';

/**
 * Una publicación, con la anatomía de una entrada de feed de red social:
 * firma, cuerpo, imágenes y la fila de interacción.
 *
 * Vive en su propio componente porque se dibuja en **dos** pantallas —el feed
 * de la ficha pública y la vista de una publicación suelta (`/p/:slug/post/:id`)—
 * y dos copias del mismo marcado divergen en la primera corrección. La única
 * diferencia entre las dos es `enfocada`: en la vista suelta el cuerpo va
 * entero y no se recorta.
 */
@Component({
  selector: 'app-public-post-card',
  imports: [
    ArticleBody,
    DatePipe,
    FollowButton,
    Menu,
    MenuItem,
    MenuTrigger,
    PostPreferencesMenu,
    PublicPostComments,
    PublicPostReactions,
    ReactionButton,
    RouterLink,
  ],
  templateUrl: './public-post-card.html',
  styleUrl: './public-post-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPostCard {
  readonly post = input.required<PublicPostSummary>();
  readonly autorNombre = input.required<string>();
  readonly autorHeadline = input<string | null>(null);
  readonly autorAvatar = input<string | null>(null);
  readonly autorIniciales = input.required<string>();
  /** El slug del perfil dueño: la firma y la fecha enlazan a la publicación. */
  readonly slug = input.required<string>();
  /** En la vista de una publicación suelta el cuerpo no se recorta. */
  readonly enfocada = input(false);
  /**
   * Si el nombre del autor lleva al perfil.
   *
   * En la ficha de alguien, no: el nombre de arriba de cada post es el dueño de
   * la página que ya se está mirando, y un enlace que no lleva a ningún lado
   * nuevo es ruido. En el feed mezclado, sí: es cómo se pasa de leer algo a
   * ver quién lo escribió.
   */
  readonly autorEnlazado = input(false);

  /**
   * La vitrina de quien mira, cuando la tiene.
   *
   * Es lo que habilita **escribir** desde la tarjeta: recomendar y comentar
   * exigen `actorProfileId` en el contrato, que no se deduce de la sesión. Sin
   * ella la fila de acciones se ve igual y cada acción manda a entrar (o a
   * crear la vitrina) con retorno: esconderla dejaría a quien lee sin saber
   * que puede participar.
   */
  readonly actorProfileId = input<string | null>(null);

  /**
   * Si se dibuja la fila de acciones (Recomendar · Comentar · Compartir).
   *
   * Encendida en el feed de la red social; la ficha de un profesional y la
   * vista suelta todavía no la piden y quedan como estaban.
   */
  readonly conAcciones = input(false);

  /**
   * Quién puede leerla: `PUBLIC` (🌐), `FOLLOWERS` (👥) o `PRIVATE` (🔒).
   *
   * El feed público sólo trae publicaciones públicas, así que por defecto es
   * `PUBLIC`; la pestaña «Siguiendo» puede traer las de seguidores y las
   * propias privadas, y la cabecera lo dice con un ícono y un texto.
   *
   * `null` es «no se sabe»: la lectura del feed personal trae la visibilidad
   * como concept id y el cliente no la traduce, y afirmar 🌐 para una
   * publicación sólo de seguidores sería mentir. Sin dato no se dibuja nada.
   */
  readonly visibilidad = input<PostVisibility | null>('PUBLIC');

  /**
   * El id de perfil del autor, si quien monta la tarjeta lo conoce (el feed
   * personal lo trae). El feed público sólo trae el `slug`; el botón «Seguir»
   * lo resuelve solo cuando no se lo pasan.
   */
  readonly autorPerfilId = input<string | null>(null);

  /**
   * Cuántas reacciones de cada tipo, si quien monta la tarjeta lo sabe.
   *
   * El feed público trae sólo el total (`reactionCount`); el personal trae el
   * desglose. Con él el resumen muestra los íconos de los tipos que hay; sin
   * él, el de la reacción propia o el de `LIKE`.
   */
  readonly reaccionesPorTipo = input<Readonly<Partial<Record<ReactionType, number>>> | null>(null);

  /* ---- menú de preferencias (AC-01-15 a AC-01-18) ------------------------ */

  /**
   * Las tres acciones que exigen dominio suben a quien monte la tarjeta.
   *
   * La molécula del menú resuelve sola copiar, compartir, navegar y mandar a
   * `/auth` con retorno; lo que toca a la comunidad —denunciar, dejar de ver,
   * contactar— sale por acá porque el destinatario cambia según la pantalla, y
   * porque una tarjeta que llamara a `community.client` dejaría de servir para
   * dibujar una publicación de cualquier otra cosa.
   */
  readonly pedidoDeOcultar = output<string>();
  readonly pedidoDeDenuncia = output<string>();
  readonly pedidoDeContacto = output<string>();

  private readonly sesion = inject(SessionStore);
  private readonly community = inject(CommunityClient);
  private readonly router = inject(Router);
  private readonly estadoDelActor = inject(PostActorStateStore);
  private readonly marcadores = inject(BookmarkStore);

  private readonly menu = viewChild(PostPreferencesMenu);

  /**
   * Pide qué reaccionó la persona a esta publicación. El feed público no la
   * conoce (no sabe quién lee), y sin este dato el botón arrancaba siempre
   * apagado aunque el servidor tuviera la reacción guardada.
   */
  private readonly pedirEstadoDelActor = effect(() => {
    const id = this.post().id;
    const actor = this.actorProfileId();
    untracked(() => {
      if (actor !== null) this.estadoDelActor.cargar([id], actor);
    });
  });

  /* ---- la fila de acciones del feed ------------------------------------- */

  /**
   * Qué reaccionó quien mira: un tipo, `null` (no reaccionó) o `undefined`
   * (todavía no se sabe). Sin vitrina no hay reacción posible.
   */
  protected readonly miReaccion = computed<ReactionType | null | undefined>(() =>
    this.actorProfileId() === null ? null : this.estadoDelActor.reaccionDe(this.post().id),
  );

  private readonly reaccionando = signal(false);
  protected readonly ocupadoReaccionando = this.reaccionando.asReadonly();

  /** Lo que las reacciones propias de esta visita sumaron al recuento del servidor. */
  private readonly deltaReacciones = signal(0);
  /** Comentarios escritos desde esta tarjeta, hasta la próxima carga. */
  private readonly deltaComentarios = signal(0);

  protected readonly totalReacciones = computed(
    () => Math.max(0, this.post().reactionCount + this.deltaReacciones()),
  );
  protected readonly totalComentarios = computed(
    () => this.post().commentCount + this.deltaComentarios(),
  );

  /**
   * Los íconos del resumen: los tipos que hay (máximo tres, de más a menos), o
   * —cuando sólo se conoce el total— la reacción propia o `LIKE`.
   */
  protected readonly iconosDeReacciones = computed<readonly string[]>(() => {
    const desglose = this.reaccionesPorTipo();
    if (desglose !== null) {
      const tipos = (Object.entries(desglose) as [ReactionType, number][])
        .filter(([, cuantas]) => cuantas > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tipo]) => reaccionOfrecida(tipo).emoji);
      if (tipos.length > 0) return tipos;
    }
    const propia = this.miReaccion();
    return [reaccionOfrecida(propia ?? 'LIKE').emoji];
  });

  /** Por qué no se pudo reaccionar, quitar la reacción, guardar o quitar el marcador. */
  protected readonly errorAlRecomendar = signal<string | null>(null);

  /**
   * Reaccionar — **upsert** en el servidor: una reacción por actor y objeto.
   *
   * Reaccionar con otro tipo la cambia; reaccionar con el mismo la deja igual.
   * **No hay forma de quitarla con este llamado**: para eso existe
   * `unreact()`. (Esta tarjeta creía lo contrario —que repetir `LIKE` la
   * retiraba— porque el simulador alternaba; la API real no lo hace, y el botón
   * decía «ya no recomendás» con la reacción todavía puesta.)
   *
   * El cambio es optimista y vuelve atrás si falla. El total sube sólo si la
   * reacción es nueva: la respuesta trae `created`, y cuando no se sabía si ya
   * había reaccionado se corrige con ella.
   */
  protected reaccionar(tipo: ReactionType): void {
    const actor = this.actorProfileId();
    if (actor === null) {
      this.pedirCuenta();
      return;
    }
    if (this.reaccionando()) return;

    const id = this.post().id;
    const anterior = this.miReaccion();
    const sumaba = anterior === null || anterior === undefined;

    this.errorAlRecomendar.set(null);
    this.reaccionando.set(true);
    this.estadoDelActor.fijar(id, tipo, actor);
    if (sumaba) this.deltaReacciones.update((d) => d + 1);

    this.community
      .react({ actorProfileId: actor, reactableType: 'POST', reactableRefId: id, reactionType: tipo })
      .subscribe({
        next: (respuesta) => {
          // No se sabía si ya había reaccionado, se asumió que no, y el
          // servidor dice que ya existía: el total no tenía que subir.
          if (anterior === undefined && respuesta.created === false) {
            this.deltaReacciones.update((d) => d - 1);
          }
          this.reaccionando.set(false);
        },
        error: (error: unknown) => {
          this.estadoDelActor.restaurar(id, anterior, actor);
          if (sumaba) this.deltaReacciones.update((d) => d - 1);
          this.reaccionando.set(false);
          // El botón vuelve a su estado; sin este aviso, la vuelta parecía un
          // clic que no llegó a registrarse.
          this.errorAlRecomendar.set(describeApiFailure(error, 'No pudimos guardar su reacción.'));
        },
      });
  }

  /** Quitar la reacción propia (`DELETE /community/reactions`), optimista y con reversa. */
  protected quitarReaccion(): void {
    const actor = this.actorProfileId();
    if (actor === null) {
      this.pedirCuenta();
      return;
    }
    const anterior = this.miReaccion();
    if (this.reaccionando() || anterior === null || anterior === undefined) return;

    const id = this.post().id;
    this.errorAlRecomendar.set(null);
    this.reaccionando.set(true);
    this.estadoDelActor.fijar(id, null, actor);
    this.deltaReacciones.update((d) => d - 1);

    this.community.unreact({ actorProfileId: actor, reactableType: 'POST', reactableRefId: id }).subscribe({
      next: (resultado) => {
        // Nada que quitar (otra pestaña ya lo hizo): el total no baja.
        if (!resultado.removed) this.deltaReacciones.update((d) => d + 1);
        this.reaccionando.set(false);
      },
      error: (error: unknown) => {
        this.estadoDelActor.restaurar(id, anterior, actor);
        this.deltaReacciones.update((d) => d + 1);
        this.reaccionando.set(false);
        this.errorAlRecomendar.set(describeApiFailure(error, 'No pudimos quitar su reacción.'));
      },
    });
  }

  /* ---- guardar ----------------------------------------------------------- */

  /** `true`/`false`, o `null` mientras no se sabe: el botón no afirma ninguna de las dos. */
  protected readonly guardada = computed(() => this.marcadores.estaGuardada(this.post().id));

  protected alternarGuardado(): void {
    if (this.actorProfileId() === null) {
      this.pedirCuenta();
      return;
    }
    const id = this.post().id;
    if (this.marcadores.ocupado(id)) return;

    const estaba = this.guardada() === true;
    this.errorAlRecomendar.set(null);
    (estaba ? this.marcadores.quitar(id) : this.marcadores.guardar(id)).subscribe({
      error: (error: unknown) =>
        this.errorAlRecomendar.set(
          describeApiFailure(error, estaba ? 'No pudimos quitarla de sus guardados.' : 'No pudimos guardarla.'),
        ),
    });
  }

  /* ---- la cabecera: cuándo y para quién ---------------------------------- */

  /** «hace 2 h», «ayer»; pasada una semana, `null` y la plantilla cae a la fecha. */
  protected readonly hace = computed(() => tiempoRelativo(this.post().publishedAt));

  protected readonly textoDeVisibilidad = computed(() => {
    switch (this.visibilidad()) {
      case null:
        return '';
      case 'FOLLOWERS':
        return 'Sólo para quienes siguen a este autor';
      case 'PRIVATE':
        return 'Sólo la ve quien la escribió';
      default:
        return 'Publicación pública';
    }
  });

  /** «Comentar» abre el hilo, que es donde está el redactor. */
  protected comentar(): void {
    this.comentariosAbiertos.set(true);
  }

  /** El hilo avisa que se publicó un comentario: el contador acompaña. */
  protected alComentar(): void {
    this.deltaComentarios.update((d) => d + 1);
  }

  /** «Compartir…» abre la hoja nativa del dispositivo; sin ella, copia el enlace. Una sola lógica con el menú. */
  protected compartir(): void {
    this.menu()?.compartir();
  }

  /** «Copiar enlace» a la publicación. */
  protected copiarEnlace(): void {
    this.menu()?.copiarEnlace();
  }

  /**
   * Sin sesión, a entrar con retorno; con sesión y sin vitrina, a crearla.
   * Es lo que AC-01-17 pide para toda acción que exige cuenta.
   */
  private pedirCuenta(): void {
    if (this.sesion.isAuthenticated()) {
      void this.router.navigate(['/my-account/profile/edit']);
      return;
    }
    void this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
  }

  /** Si hay sesión: decide si el menú actúa o manda a entrar (AC-01-17). */
  protected readonly haySesion = this.sesion.isAuthenticated;

  /* ---- los dos contadores, ahora cliqueables (AC-01-9, AC-01-11) --------- */

  /**
   * El modal de reacciones y el desplegable de comentarios se montan **sólo
   * mientras están abiertos**, y no ocultos con CSS.
   *
   * Los dos piden datos en su constructor. Dejarlos montados haría que cada
   * tarjeta del feed pidiera su lista de reacciones y su hilo de comentarios al
   * dibujarse: veinticinco publicaciones en pantalla serían cincuenta
   * peticiones que nadie miró. Es el mismo defecto que `app-tab` tenía en
   * `/my-account`.
   */
  protected readonly reaccionesAbiertas = signal(false);
  protected readonly comentariosAbiertos = signal(false);

  protected abrirReacciones(): void {
    this.reaccionesAbiertas.set(true);
  }

  protected cerrarReacciones(): void {
    this.reaccionesAbiertas.set(false);
  }

  protected alternarComentarios(): void {
    this.comentariosAbiertos.update((abierto) => !abierto);
  }

  private readonly expandido = signal(false);

  private readonly TOPE_RECORTE = 360;

  protected readonly recortable = computed(
    () => !this.enfocada() && this.post().bodyText.length > this.TOPE_RECORTE,
  );

  protected readonly recortado = computed(() => this.recortable() && !this.expandido());

  protected readonly enlacePost = computed(() => [
    '/p',
    this.slug(),
    'post',
    this.post().id,
  ]);

  /* ---- galería de imágenes (AC-01-7, AC-01-8) ---------------------------- */

  /**
   * Qué imagen se está viendo, en base 0.
   *
   * Se reinicia sola cuando cambia la publicación: el mismo componente se
   * reutiliza al paginar el feed, y sin esto una publicación de dos imágenes
   * que cae donde había una de cinco abriría en el índice 4 —fuera de rango—.
   * Por eso el índice se acota al leerlo en vez de guardarse ya acotado: es un
   * `computed` derivado, no un estado que haya que recordar sincronizar.
   */
  private readonly indiceElegido = signal(0);

  /**
   * Si el cuerpo es un artículo (títulos, listas o imágenes intercaladas).
   *
   * Se decide por el contenido y no por la etiqueta porque el resumen público
   * no trae etiquetas. Un artículo se pinta con sus secciones desplegables y
   * sus imágenes en el lugar del texto donde van, así que ni el «Ver más» ni
   * la galería aplican.
   */
  protected readonly esArticulo = computed(() => hasArticleStructure(this.post().bodyText));

  protected readonly tieneVariasImagenes = computed(() => this.post().mediaUrls.length > 1);

  /** El índice válido: acotado al rango de la publicación que se esté viendo. */
  protected readonly indiceVisible = computed(() => {
    const ultimo = Math.max(0, this.post().mediaUrls.length - 1);
    return Math.min(Math.max(this.indiceElegido(), 0), ultimo);
  });

  /** Lo que ve una persona: 1 de N, no 0 de N. */
  protected readonly numeroVisible = computed(() => this.indiceVisible() + 1);

  protected readonly imagenVisible = computed(
    () => this.post().mediaUrls[this.indiceVisible()] ?? '',
  );

  /**
   * En los extremos el botón queda `disabled` en vez de dar la vuelta.
   *
   * Un carrusel circular sin aviso hace que «siguiente» en la última imagen
   * devuelva a la primera sin decirlo, y quien no ve la pantalla no tiene cómo
   * saber que ya recorrió todo.
   */
  protected readonly hayAnterior = computed(() => this.indiceVisible() > 0);

  protected readonly haySiguiente = computed(
    () => this.indiceVisible() < this.post().mediaUrls.length - 1,
  );

  protected verAnterior(): void {
    this.indiceElegido.set(Math.max(0, this.indiceVisible() - 1));
  }

  protected verSiguiente(): void {
    const ultimo = this.post().mediaUrls.length - 1;
    this.indiceElegido.set(Math.min(ultimo, this.indiceVisible() + 1));
  }

  protected readonly enlaceAutor = computed(() => ['/p', this.slug()]);

  protected alternar(): void {
    this.expandido.update((v) => !v);
  }

  /**
   * Parte el cuerpo en texto y enlaces, para pintar las URLs como `<a>` sin
   * pasar por `innerHTML`. Reconoce `http(s)://…` y `www.…`.
   */
  protected readonly segmentos = computed<
    readonly { readonly texto: string; readonly href: string | null }[]
  >(() => {
    const texto = this.post().bodyText;
    const patron = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const salida: { texto: string; href: string | null }[] = [];
    let ultimo = 0;
    for (const coincidencia of texto.matchAll(patron)) {
      const inicio = coincidencia.index ?? 0;
      if (inicio > ultimo) salida.push({ texto: texto.slice(ultimo, inicio), href: null });
      const crudo = coincidencia[0];
      const limpio = crudo.replace(/[.,;:)\]]+$/, '');
      const sobra = crudo.slice(limpio.length);
      salida.push({ texto: limpio, href: limpio.startsWith('http') ? limpio : `https://${limpio}` });
      if (sobra) salida.push({ texto: sobra, href: null });
      ultimo = inicio + crudo.length;
    }
    if (ultimo < texto.length) salida.push({ texto: texto.slice(ultimo), href: null });
    return salida.length > 0 ? salida : [{ texto, href: null }];
  });
}
