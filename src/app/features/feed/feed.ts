import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CommunityClient } from '../../core/data-access/community/community.client';
import type {
  FeedListItem,
  GroupListItem,
  OwnPublicProfile,
} from '../../core/data-access/community/community.types';
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
 * Cuántos grupos se traen para elegir las tendencias.
 *
 * El endpoint no ordena por integrantes, así que el recorte lo hace el
 * cliente: se pide una página y se ordena. Veinte es suficiente para que el
 * más poblado esté casi siempre adentro, y bastante menos que traer el
 * directorio entero para mostrar cinco renglones.
 */
const TENDENCIAS_CANDIDATAS = 20;

/** Cuántas se muestran. Cinco renglones entran sin desplazar la columna. */
const TENDENCIAS_VISIBLES = 5;

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
 *
 * ## Tres columnas, y cada una contesta una pregunta distinta (AC-E1-03)
 *
 * - **Izquierda — quién soy acá**: la vitrina propia con su nombre, su titular
 *   y el enlace a `/p/:slug`, más los accesos que uno usa mirando el muro.
 * - **Centro — qué se publicó**: el compositor y las publicaciones. Es lo único
 *   que existía antes y lo único que no cambia de comportamiento.
 * - **Derecha — qué se está moviendo**: las comunidades clínicas más pobladas.
 *
 * Las columnas laterales son **acompañamiento**: en teléfono se apilan debajo
 * del muro, no encima. Lo que se viene a hacer a esta pantalla es leer y
 * publicar, y empujar eso media pantalla hacia abajo para mostrar una tarjeta
 * de perfil sería cobrarle el adorno a lo que importa.
 *
 * ## Por qué las «tendencias» son grupos y no etiquetas
 *
 * Porque no hay endpoint de tendencias, y no se inventa uno: `PostListItem`
 * —lo que trae el muro— **no declara `hashtags`**; sólo los trae `PostDetail`,
 * que exige una petición por publicación. Contar etiquetas acá costaría veinte
 * peticiones para un recuento que igual sería el de una página, no el del
 * sistema.
 *
 * Lo que sí es un dato real del servidor y sí es una tendencia clínica es
 * cuánta gente se juntó alrededor de cada tema: `GET /community/groups`
 * devuelve `memberCount`. Se ordena por eso y se dice con esas palabras —«N
 * integrantes»—, para que nadie lea un número como si fuera otra cosa. El
 * recuento de etiquetas del período queda anotado en `PENDIENTES-BACKEND.md`.
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
    RouterLink,
  ],
  templateUrl: './feed.html',
  styleUrl: './feed.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Feed {
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);

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

  /**
   * La vitrina propia entera, para la columna de la izquierda.
   *
   * Señal aparte de {@link perfil} y no la misma con el objeto adentro: el id
   * es lo que el muro necesita para pedirse —y lo comparan media docena de
   * lugares—, mientras que esto es material de presentación. Juntarlos obligaría
   * a `perfil()?.id` en cada una de esas comparaciones.
   */
  protected readonly perfilPublico = signal<OwnPublicProfile | null>(null);

  /** Si ya se sabe si hay perfil o no. Antes de eso no se puede decidir nada. */
  protected readonly perfilResuelto = signal(false);

  /**
   * Las comunidades clínicas más pobladas — la columna de la derecha.
   *
   * Vacía mientras no cargue, y vacía también si la lectura falla: la columna
   * entonces no se dibuja. Es acompañamiento, y un acompañamiento que falla no
   * puede poner un cartel de error encima del muro, que es lo que la persona
   * vino a leer.
   */
  protected readonly tendencias = signal<readonly GroupListItem[]>([]);

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
        this.perfilPublico.set(propio ?? null);
        this.perfilResuelto.set(true);
        this.cargar();
      },
      error: () => {
        this.perfilResuelto.set(true);
        this.error.set('No pudimos saber si tenés perfil público.');
      },
    });

    this.cargarTendencias();
  }

  /**
   * Las comunidades clínicas más pobladas, para la columna de la derecha.
   *
   * Se piden **sin esperar al perfil**: el directorio de grupos no depende de
   * tener vitrina propia, y encadenarlo a `getOwnProfile` retrasaría la columna
   * sin motivo. El orden lo pone el cliente porque el endpoint no ofrece
   * `sort`: se traen los primeros y se ordenan por `memberCount` — es un
   * recorte honesto de lo que el servidor dio, y así lo dice el rótulo.
   *
   * Sin `memberCount` un grupo cuenta como cero y baja al final: el campo es
   * opcional en el contrato, y ordenar con `undefined` de por medio deja una
   * lista en orden arbitrario.
   */
  private cargarTendencias(): void {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null) {
      return;
    }

    this.community.listGroups({ tenantId, limit: TENDENCIAS_CANDIDATAS }).subscribe({
      next: (pagina) =>
        this.tendencias.set(
          [...pagina.items]
            .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
            .slice(0, TENDENCIAS_VISIBLES),
        ),
      // En silencio: es acompañamiento. Un cartel de error acá taparía el muro,
      // que es lo que la persona vino a leer.
      error: () => this.tendencias.set([]),
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
