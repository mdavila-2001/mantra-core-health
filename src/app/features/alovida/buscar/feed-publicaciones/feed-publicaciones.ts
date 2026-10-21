import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { CommunityClient } from '@core/data-access/community/community.client';
import type { FeedListItem, PostDetail } from '@core/data-access/community/community.types';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicFeedPost,
  PublicProfileDetail,
} from '@core/data-access/public-directory/public-directory.types';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { PostActorStateStore } from '@core/social/post-actor-state.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { SegmentedControl } from '@shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '@shared/components/molecules/segmented-control/segmented-control.types';
import { PublicPostCard } from '../../../public-profile/public-post-card/public-post-card';
import { ReportPost } from '../../../social/report-post/report-post';
import { FeedBanner } from './feed-banner/feed-banner';
import { FeedCrearPublicacion } from './feed-crear-publicacion/feed-crear-publicacion';
import { FeedPerfilMini } from './feed-perfil-mini/feed-perfil-mini';
import { FeedTendencias } from './feed-tendencias/feed-tendencias';
import { dePublicacion, deRecientes, deSiguiendo, type PostVista } from './feed-publicaciones.vista';

/** Cuántas publicaciones se piden por página del feed personal. */
const PAGINA_SIGUIENDO = 10;

type EstadoFeed = 'carga' | 'datos' | 'vacio' | 'error';

/** Qué lista se está mirando. */
export type ModoDelFeed = 'recientes' | 'siguiendo';

/**
 * El inicio de la red social (`/posts`), al estilo de una red profesional.
 *
 * ## Tres columnas, en el orden de LinkedIn
 *
 * Izquierda: **quién soy** (tarjeta de perfil con sus números y sus accesos).
 * Centro: **crear publicación** y el feed. Derecha: **a quién seguir** y los
 * espacios pagados. Sin sesión la izquierda no se reserva (nunca una columna
 * vacía, `composition-rules.md` §5) y el feed se queda con ese ancho.
 *
 * ## Dos listas, y por qué «Recientes» es la de entrada
 *
 * - **Recientes** (`GET /public/posts`): todo lo público. Funciona siempre.
 * - **Siguiendo** (`GET /community/feed`): lo de a quién sigue la persona.
 *   Depende de un reparto asíncrono a `community.feed_items` (un worker aparte)
 *   que no en todos los entornos corre; cuando no corre, la lista está vacía
 *   para cualquiera. Por eso no es la de entrada: abrir la red social y ver el
 *   vacío sería lo primero que se ve.
 *
 * La elegida vive en la URL (`?feed=siguiendo`), así que se puede compartir, el
 * botón «atrás» la respeta y un aviso puede llevar directo a ella.
 *
 * Las dos listas se normalizan al mismo modelo (`PostVista`) y se dibujan con la
 * misma tarjeta.
 */
@Component({
  selector: 'app-feed-publicaciones',
  imports: [
    FeedBanner,
    FeedCrearPublicacion,
    FeedPerfilMini,
    FeedTendencias,
    PublicPostCard,
    ReportPost,
    RouterLink,
    SegmentedControl,
  ],
  templateUrl: './feed-publicaciones.html',
  styleUrl: './feed-publicaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedPublicaciones {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly community = inject(CommunityClient);
  private readonly avisos = inject(ToastService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly sesion = inject(SessionStore);
  private readonly propio = inject(OwnProfileStore);
  private readonly estadoDelActor = inject(PostActorStateStore);
  private readonly resumenes = inject(ProfileSummaryStore);

  /* ---- quien mira ------------------------------------------------------- */

  protected readonly conSesion = this.sesion.isAuthenticated;
  protected readonly perfil = this.propio.perfil;
  protected readonly perfilResuelto = this.propio.resuelto;
  protected readonly actor = this.propio.id;

  /** La ficha pública del profesional (foto, portada, valoración); sólo si ejerce. */
  protected readonly detalle = signal<PublicProfileDetail | null>(null);

  private readonly leerDetalle = effect(() => {
    const propio = this.perfil();
    untracked(() => {
      if (propio === null || this.sesion.practitionerProfileId() === null) {
        this.detalle.set(null);
        return;
      }
      this.directorio.getProfile('PRACTITIONER', propio.slug).subscribe({
        next: (d) => this.detalle.set(d),
        error: () => this.detalle.set(null),
      });
    });
  });

  /* ---- qué lista se mira ------------------------------------------------ */

  private readonly parametros = toSignal(this.ruta.queryParamMap, { requireSync: true });

  /** «Siguiendo» exige perfil público: el feed personal se pide con él. */
  protected readonly puedeVerSiguiendo = computed(() => this.actor() !== null);

  /**
   * Con `?feed=siguiendo` en la dirección, «Siguiendo» manda **también mientras
   * el perfil propio se lee**: sin eso, al recargar se pintaba primero la lista
   * de «Recientes» y de golpe saltaba a «Siguiendo» (contenido equivocado
   * durante un instante, visto en el build de producción). Cuando el perfil
   * termina de leerse y no hay vitrina, cae a «Recientes».
   */
  protected readonly modo = computed<ModoDelFeed>(() => {
    if (this.parametros().get('feed') !== 'siguiendo') return 'recientes';
    return this.puedeVerSiguiendo() || !this.perfilResuelto() ? 'siguiendo' : 'recientes';
  });

  protected readonly opcionesDeModo: readonly SegmentedOption<ModoDelFeed>[] = [
    { value: 'recientes', label: 'Recientes' },
    { value: 'siguiendo', label: 'Siguiendo' },
  ];

  protected cambiarModo(modo: ModoDelFeed): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { feed: modo === 'siguiendo' ? 'siguiendo' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /* ---- las acciones de dominio del menú (AC-01-15) ----------------------- */

  /** Qué publicación se está denunciando, o `null`. El formulario reemplaza a la tarjeta en su lugar. */
  protected readonly denunciando = signal<string | null>(null);

  protected abrirDenuncia(postId: string): void {
    this.denunciando.set(postId);
  }

  protected cerrarDenuncia(): void {
    this.denunciando.set(null);
  }

  /**
   * «No ver más este tipo de publicaciones» — **sin destino todavía**: no existe
   * tabla de preferencias de feed (P-01-3). Se avisa en vez de callar.
   */
  protected pedirOcultar(): void {
    this.avisos.info('Todavía no puede ajustar qué tipo de publicaciones ve. Está en camino.');
  }

  /** «Contactarme con este doctor» — sin destino definido (P-01-1): se manda a la ficha. */
  protected pedirContacto(slug: string): void {
    this.avisos.info('Sus vías de contacto están en su perfil.');
    void this.router.navigate(['/p', slug]);
  }

  /* ---- Recientes: el feed público --------------------------------------- */

  private readonly recientes = signal<readonly PublicFeedPost[]>([]);
  private readonly cursorRecientes = signal<string | null>(null);
  private readonly cargandoRecientes = signal(true);
  private readonly falloRecientes = signal(false);
  private readonly cargandoMasRecientes = signal(false);

  /* ---- Siguiendo: el feed personal -------------------------------------- */

  private readonly entradasSiguiendo = signal<readonly FeedListItem[]>([]);
  private readonly cursorSiguiendo = signal<string | null>(null);
  private readonly cargandoSiguiendo = signal(false);
  private readonly falloSiguiendo = signal(false);
  private readonly cargadoSiguiendo = signal(false);
  private readonly cargandoMasSiguiendo = signal(false);

  /**
   * Lo que la persona publicó en esta visita, leído por id.
   *
   * Va **primero** en las dos pestañas, como en una red social: «Recientes» sólo
   * trae lo público y «Siguiendo» lo de los demás, así que sin esto una
   * publicación para seguidores o privada desaparecería apenas se publica.
   */
  private readonly propias = signal<readonly PostDetail[]>([]);

  /** Lo que se dibuja: las dos fuentes normalizadas al mismo modelo, con lo propio recién publicado arriba. */
  protected readonly vista = computed<readonly PostVista[]>(() => {
    const base = this.vistaDeLaFuente();
    const yaEstan = new Set(base.map((v) => v.post.id));
    const nuevas = this.propias()
      .filter((p) => !yaEstan.has(p.id))
      .map((p) =>
        dePublicacion(
          p,
          new Date(),
          this.resumenes.resumen(p.authorPublicProfileId),
          p.media.map((m) => m.fileId),
        ),
      );
    return [...nuevas, ...base];
  });

  private readonly vistaDeLaFuente = computed<readonly PostVista[]>(() => {
    if (this.modo() === 'recientes') {
      return this.recientes().map(deRecientes);
    }
    return this.entradasSiguiendo()
      .map((entrada) =>
        deSiguiendo(
          entrada,
          entrada.post === undefined ? null : this.resumenes.resumen(entrada.post.authorPublicProfileId),
          entrada.post === undefined ? undefined : this.estadoDelActor.imagenesDe(entrada.post.id),
        ),
      )
      .filter((v): v is PostVista => v !== null);
  });

  protected readonly estado = computed<EstadoFeed>(() => {
    const siguiendo = this.modo() === 'siguiendo';
    // «Siguiendo» pedido pero todavía sin saber quién es la persona: se está cargando, no está vacío.
    if (siguiendo && !this.puedeVerSiguiendo()) return 'carga';
    if (siguiendo ? this.cargandoSiguiendo() : this.cargandoRecientes()) return 'carga';
    if (siguiendo ? this.falloSiguiendo() : this.falloRecientes()) return 'error';
    return this.vista().length === 0 ? 'vacio' : 'datos';
  });

  protected readonly hayMas = computed(() =>
    this.modo() === 'siguiendo' ? this.cursorSiguiendo() !== null : this.cursorRecientes() !== null,
  );

  protected readonly cargandoMas = computed(() =>
    this.modo() === 'siguiendo' ? this.cargandoMasSiguiendo() : this.cargandoMasRecientes(),
  );

  constructor() {
    this.cargarRecientes();
  }

  /** Al entrar en «Siguiendo» por primera vez (o al cambiar de sesión) se pide el feed personal. */
  private readonly pedirSiguiendo = effect(() => {
    const quiere = this.modo() === 'siguiendo';
    const actor = this.actor();
    untracked(() => {
      if (quiere && actor !== null && !this.cargadoSiguiendo() && !this.cargandoSiguiendo()) {
        this.cargarSiguiendo(actor);
      }
    });
  });

  /**
   * Al cerrar sesión se olvida el feed personal: nada del usuario anterior
   * queda en pantalla. (Las reacciones propias las olvida su store, que es el
   * dueño: esta pantalla no tiene por qué estar montada cuando cambia la sesión.)
   */
  private readonly olvidarAlSalir = effect(() => {
    if (this.actor() === null) {
      untracked(() => {
        this.entradasSiguiendo.set([]);
        this.cursorSiguiendo.set(null);
        this.cargadoSiguiendo.set(false);
        this.falloSiguiendo.set(false);
      });
    }
  });

  protected alPublicar(postId: string): void {
    // Se relee «Recientes» (si fue pública, aparece en su lugar) y se lee la
    // publicación por id para ponerla arriba sea cual sea su visibilidad.
    this.cargarRecientes();
    this.community.readPost(postId).subscribe({
      next: (p) => this.propias.update((lista) => [p, ...lista.filter((x) => x.id !== p.id)]),
      // Si la lectura falla, igual quedó publicada: la relectura del feed la trae si es pública.
      error: () => undefined,
    });
  }

  protected reintentar(): void {
    if (this.modo() === 'siguiendo') {
      const actor = this.actor();
      if (actor !== null) this.cargarSiguiendo(actor);
    } else {
      this.cargarRecientes();
    }
  }

  protected verMas(): void {
    if (this.modo() === 'siguiendo') this.masSiguiendo();
    else this.masRecientes();
  }

  private masRecientes(): void {
    const desde = this.cursorRecientes();
    if (desde === null || this.cargandoMasRecientes()) return;

    this.cargandoMasRecientes.set(true);
    this.directorio.feedPublico({ cursor: desde }).subscribe({
      next: (pagina) => {
        this.recientes.update((previas) => [...previas, ...pagina.items]);
        this.cursorRecientes.set(pagina.nextCursor);
        this.cargandoMasRecientes.set(false);
      },
      error: () => {
        // Se deja de ofrecer «ver más»: no es una pantalla de error, sólo se acabó lo que pudo leerse.
        this.cursorRecientes.set(null);
        this.cargandoMasRecientes.set(false);
      },
    });
  }

  private cargarRecientes(): void {
    this.cargandoRecientes.set(true);
    this.falloRecientes.set(false);
    this.directorio.feedPublico({}).subscribe({
      next: (pagina) => {
        this.recientes.set(pagina.items);
        this.cursorRecientes.set(pagina.nextCursor);
        this.cargandoRecientes.set(false);
      },
      error: () => {
        this.falloRecientes.set(true);
        this.cargandoRecientes.set(false);
      },
    });
  }

  private cargarSiguiendo(actor: string): void {
    this.cargandoSiguiendo.set(true);
    this.falloSiguiendo.set(false);
    this.community.listFeed({ profileId: actor, limit: PAGINA_SIGUIENDO }).subscribe({
      next: (pagina) => {
        // Sólo las entradas con publicación resuelta: una tarjeta vacía es peor que una entrada que no está.
        const conPublicacion = pagina.items.filter((e) => e.post !== undefined);
        this.entradasSiguiendo.set(conPublicacion);
        this.cursorSiguiendo.set(pagina.nextCursor);
        this.cargadoSiguiendo.set(true);
        this.cargandoSiguiendo.set(false);
        this.leerDetalles(conPublicacion, actor);
      },
      error: () => {
        this.falloSiguiendo.set(true);
        this.cargandoSiguiendo.set(false);
      },
    });
  }

  private masSiguiendo(): void {
    const actor = this.actor();
    const desde = this.cursorSiguiendo();
    if (actor === null || desde === null || this.cargandoMasSiguiendo()) return;

    this.cargandoMasSiguiendo.set(true);
    this.community.listFeed({ profileId: actor, limit: PAGINA_SIGUIENDO, cursor: desde }).subscribe({
      next: (pagina) => {
        const conPublicacion = pagina.items.filter((e) => e.post !== undefined);
        this.entradasSiguiendo.update((previas) => [...previas, ...conPublicacion]);
        this.cursorSiguiendo.set(pagina.nextCursor);
        this.cargandoMasSiguiendo.set(false);
        this.leerDetalles(conPublicacion, actor);
      },
      error: () => {
        this.cursorSiguiendo.set(null);
        this.cargandoMasSiguiendo.set(false);
      },
    });
  }

  /** Pide el detalle de cada publicación del feed personal: de ahí salen sus imágenes y la reacción propia. */
  private leerDetalles(entradas: readonly FeedListItem[], actor: string): void {
    this.estadoDelActor.cargar(
      entradas.flatMap((e) => (e.post === undefined ? [] : [e.post.id])),
      actor,
    );
  }
}
