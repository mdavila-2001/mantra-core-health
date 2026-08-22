import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { CommunityClient } from '../../core/data-access/community/community.client';
import type { FeedListItem } from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { Composer } from './composer/composer';
import { PostCard } from './post-card/post-card';
import { ReportPost } from './report-post/report-post';

/** Cuántas publicaciones se piden por página. */
const PAGE_SIZE = 20;

/**
 * El muro profesional.
 *
 * ## Paginación por cursor, sin números de página
 *
 * El contrato del M34 no da totales: trae `count` —cuántas vinieron en **esta**
 * página— y `nextCursor`. Contar el total de un muro obligaría a recorrerlo
 * entero. Por eso hay «ver más» y no «página 3 de 47»: no es una simplificación,
 * es lo único que el contrato permite decir con honestidad.
 *
 * ## Las entradas sin publicación resuelta se omiten
 *
 * `FeedListItem.post` viene resuelto cuando la entrada **es** una publicación;
 * para otros orígenes queda ausente y habría que resolverlo por `sourceRefId`.
 * Hasta que el muro tenga tarjetas para esos otros tipos, se filtran: una
 * tarjeta vacía es peor que una entrada que no está.
 *
 * ## El movimiento llega después
 *
 * La lista está lista para adoptar `appStaggerList` (carril 14, PR #84) en
 * cuanto ese carril mergee: una sola etiqueta en el `div`. No se adelanta acá
 * porque el propio carril 14 pide no aplicar su sistema a pantallas ajenas
 * mientras las dos ramas están en construcción.
 *
 * ## Sin perfil público se puede leer, no reaccionar
 *
 * El muro necesita un `profileId` para pedirse. Quien no tenga perfil público
 * ve la invitación a crearlo en vez de una pantalla rota — es una puerta, no un
 * error.
 */
@Component({
  selector: 'app-feed',
  imports: [
    Alert,
    AppButton,
    Composer,
    EmptyState,
    PageHeader,
    PostCard,
    ReportPost,
  ],
  templateUrl: './feed.html',
  styleUrl: './feed.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Feed {
  private readonly community = inject(CommunityClient);

  protected readonly entradas = signal<readonly FeedListItem[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargoAlgunaVez = signal(false);

  /**
   * El perfil público de quien mira.
   *
   * **No sale de la sesión.** El perfil público de `community` es una entidad
   * aparte del perfil de paciente que el token trae en `pid`: hay que
   * preguntarle al backend. Un `null` significa «todavía no lo creó», que es un
   * estado legítimo y no un error.
   */
  protected readonly perfil = signal<string | null>(null);

  /** Si ya se sabe si hay perfil o no. Antes de eso no se puede decidir nada. */
  protected readonly perfilResuelto = signal(false);

  /**
   * La publicación que se está reportando, si hay alguna.
   *
   * El formulario **reemplaza** a la tarjeta en vez de abrirse debajo: reportar
   * es una acción deliberada y dejar la publicación a la vista mientras se
   * elige el motivo invita a seguir leyéndola en lugar de terminar el reporte.
   * Se guarda uno solo: dos formularios abiertos a la vez no tienen sentido.
   */
  protected readonly reportando = signal<string | null>(null);

  protected readonly hayMas = computed(() => this.cursor() !== null);
  protected readonly vacio = computed(
    () => this.cargoAlgunaVez() && this.entradas().length === 0,
  );

  constructor() {
    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        this.perfil.set(propio?.id ?? null);
        this.perfilResuelto.set(true);
        this.cargar();
      },
      error: () => {
        this.perfilResuelto.set(true);
        this.error.set('No pudimos saber si tenés perfil público.');
      },
    });
  }

  /**
   * Trae la primera página, descartando lo que hubiera.
   *
   * Es también lo que se hace al publicar: la publicación propia entra al muro
   * por el fan-out del worker, no por una inserción del cliente, así que la única
   * forma honesta de mostrarla es volver a pedir la página.
   */
  protected recargar(): void {
    this.entradas.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
    this.cargar();
  }

  /** Abre el formulario de reporte de una publicación. */
  protected abrirReporte(postId: string): void {
    this.reportando.set(postId);
  }

  /**
   * Cierra el formulario, haya reportado o no.
   *
   * No se recarga el muro: reportar **no** baja la publicación —eso lo decide
   * una persona en la cola de moderación—, así que hacerla desaparecer acá
   * prometería algo que no pasó.
   */
  protected cerrarReporte(): void {
    this.reportando.set(null);
  }

  /** Trae la página siguiente y la agrega al final. */
  protected verMas(): void {
    if (this.hayMas() && !this.cargando()) {
      this.cargar();
    }
  }

  private cargar(): void {
    const profileId = this.perfil();
    if (profileId === null || this.cargando()) {
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    const cursorActual = this.cursor();

    this.community
      .listFeed({
        profileId,
        limit: PAGE_SIZE,
        ...(cursorActual === null ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          // Sólo las entradas con publicación resuelta: una tarjeta vacía es
          // peor que una entrada que no está.
          const conPublicacion = pagina.items.filter((e) => e.post !== undefined);
          this.entradas.update((previas) => [...previas, ...conPublicacion]);
          this.cursor.set(pagina.nextCursor);
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
        },
        error: () => {
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
          this.error.set('No pudimos cargar el muro. Reintentá.');
        },
      });
  }
}
