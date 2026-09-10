import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { CommunityClient } from '../../core/data-access/community/community.client';
import type { GroupListItem, Topic } from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { GroupDetail } from '../groups/group-detail/group-detail';

/** Cuántos grupos se piden por tema de la comunidad. */
const TOPE_POR_TEMA = 50;

/** Una comunidad: un tema raíz y los temas que cuelgan de él. */
export interface Comunidad {
  readonly tema: Topic;
  /** El tema y sus hijos: de todos ellos se juntan los grupos. */
  readonly temas: readonly Topic[];
}

/** En qué nivel está la navegación interna del modal. */
export type NivelDeComunidades = 'comunidades' | 'comunidad' | 'grupo';

/**
 * **Comunidades**: los grupos de la organización, agrupados por comunidad.
 *
 * ## Qué es una comunidad acá, y por qué no es una invención
 *
 * Es un **tema** (`community.topics`), que es la agrupación que el dominio ya
 * tiene: la columna `groups.topic_id` existe, el alta de grupo la manda y
 * `GET /community/groups` filtra por ella. La corrección del 10/09/2026 pide
 * organizar «Grupos y foros» por comunidades y sus grupos, y esa relación ya
 * estaba guardada — lo que faltaba era mostrarla: la pantalla anterior pintaba
 * los grupos en una rejilla plana y usaba el tema sólo como un botón de filtro.
 *
 * Los temas tienen `parentTopicId`, así que una comunidad puede reunir varios.
 * Cuando el árbol es plano —como hoy—, cada comunidad es un tema con sus
 * grupos. No se fuerza una jerarquía que los datos no tengan.
 *
 * **No hay comunidad de demostración.** Si la organización no tiene temas con
 * grupos, el estado vacío lo dice; envolver todos los grupos en una comunidad
 * fija sería exactamente la «comunidad decorativa» que el pedido prohíbe.
 *
 * ## Los grupos se piden por comunidad, no se agrupan en el navegador
 *
 * `GroupListItem` no trae `topicId` —sólo `GroupDetail`—, así que repartir en
 * memoria una lista plana era imposible sin pedir la ficha de cada grupo. Se
 * pide `listGroups({ topicId })` por cada tema de la comunidad, que es el
 * filtro que el contrato ya ofrece: el reparto lo hace el servidor.
 *
 * ## La conversación de un grupo es la de siempre
 *
 * Al abrir un grupo se monta `app-group-detail` con `embedded`, el **mismo**
 * componente que la pantalla del grupo: su muro, sus hilos, sus altas
 * pendientes y su moderación, con sus permisos. Reescribir el muro acá era el
 * camino corto a perder hilos —dos implementaciones del mismo muro divergen a
 * la segunda corrección— y a inventar una moderación que no respeta los roles.
 *
 * ## Anuncios: el sitio está, el soporte del dominio falta
 *
 * El pedido lo describe como un espacio distinto de las conversaciones. El
 * dominio tiene dos tipos de grupo —`GENERAL` y `SUPPORT`, en
 * `GROUP_TYPE_BY_CODE` del backend— y **ninguno es un canal de anuncios**: no
 * hay concepto, ni columna, ni endpoint. Así que la sección se dibuja y dice
 * qué falta, en vez de mostrar un canal decorativo o de disfrazar de anuncios
 * el muro del primer grupo. Mientras eso no exista, la organización por
 * comunidades **no** se declara terminada.
 *
 * ## Es el cuerpo de un modal, no una página
 *
 * No lleva `app-page-header`: lo monta `app-communities-dialog` y el título
 * «Comunidades» es el del diálogo. La navegación interna —comunidades →
 * comunidad → grupo— es de este componente y se hace con «Volver», sin cambiar
 * de ruta: cerrar el modal tiene que devolver la pantalla de atrás intacta.
 */
@Component({
  selector: 'app-communities',
  imports: [Alert, AppButton, Card, EmptyState, GroupDetail, SearchField],
  templateUrl: './communities.html',
  styleUrl: './communities.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Communities {
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);

  /** La organización activa. `null` mientras la persona no eligió. */
  protected readonly tenantId = this.auth.activeTenantId;

  protected readonly comunidades = signal<readonly Comunidad[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly cargoAlgunaVez = signal(false);

  /** Los grupos de la comunidad abierta. */
  protected readonly gruposDeLaComunidad = signal<readonly GroupListItem[]>([]);
  protected readonly cargandoGrupos = signal(false);
  protected readonly cargoGruposAlgunaVez = signal(false);

  protected readonly comunidadAbierta = signal<Comunidad | null>(null);
  protected readonly grupoAbierto = signal<GroupListItem | null>(null);

  protected readonly busqueda = signal('');

  /** Dónde está la navegación interna. Lo lee el modal para su «Volver». */
  readonly nivel = computed<NivelDeComunidades>(() => {
    if (this.grupoAbierto() !== null) {
      return 'grupo';
    }
    return this.comunidadAbierta() === null ? 'comunidades' : 'comunidad';
  });

  /** El rastro de dónde está, para la bajada del modal. */
  readonly rastro = computed(() => {
    const comunidad = this.comunidadAbierta();
    const grupo = this.grupoAbierto();
    if (comunidad === null) {
      return 'Cada comunidad reúne los grupos de un mismo tema.';
    }
    return grupo === null
      ? comunidad.tema.name
      : `${comunidad.tema.name} · ${grupo.name}`;
  });

  /** Las comunidades que el texto de búsqueda deja pasar. */
  protected readonly comunidadesVisibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (texto === '') {
      return this.comunidades();
    }
    return this.comunidades().filter((comunidad) =>
      comunidad.tema.name.toLowerCase().includes(texto),
    );
  });

  protected readonly vacio = computed(
    () => this.cargoAlgunaVez() && this.comunidades().length === 0,
  );

  protected readonly sinGrupos = computed(
    () => this.cargoGruposAlgunaVez() && this.gruposDeLaComunidad().length === 0,
  );

  /** Si esa comunidad es la que está abierta. */
  protected estaAbierta(comunidad: Comunidad): boolean {
    return this.comunidadAbierta()?.tema.id === comunidad.tema.id;
  }

  /** Las iniciales de la comunidad, cuando no hay imagen que mostrar. */
  protected iniciales(nombre: string): string {
    return nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
  }

  constructor() {
    this.cargar();
  }

  /** Vuelve un escalón: del grupo a la comunidad, de la comunidad al listado. */
  volver(): void {
    if (this.grupoAbierto() !== null) {
      this.grupoAbierto.set(null);
      return;
    }
    this.comunidadAbierta.set(null);
    this.gruposDeLaComunidad.set([]);
    this.cargoGruposAlgunaVez.set(false);
  }

  protected abrirComunidad(comunidad: Comunidad): void {
    this.comunidadAbierta.set(comunidad);
    this.grupoAbierto.set(null);
    this.cargarGrupos(comunidad);
  }

  protected abrirGrupo(grupo: GroupListItem): void {
    this.grupoAbierto.set(grupo);
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
  }

  /**
   * Arma las comunidades a partir del árbol de temas.
   *
   * `listTopics` no pagina —son decenas— y trae el árbol entero, así que la
   * jerarquía se resuelve con una sola lectura.
   */
  private cargar(): void {
    if (this.cargando()) {
      return;
    }
    this.cargando.set(true);
    this.error.set('');

    this.community.listTopics().subscribe({
      next: (pagina) => {
        this.comunidades.set(this.armarComunidades(pagina.items));
        this.cargando.set(false);
        this.cargoAlgunaVez.set(true);
      },
      error: () => {
        this.cargando.set(false);
        this.cargoAlgunaVez.set(true);
        // Distinguir el fallo del vacío: «no tenés comunidades» sobre un error
        // de red es la mentira que hace que nadie reintente.
        this.error.set('No pudimos cargar las comunidades. Reintentá.');
      },
    });
  }

  /** Los temas raíz son las comunidades; los hijos, sus secciones. */
  private armarComunidades(temas: readonly Topic[]): readonly Comunidad[] {
    const raices = temas.filter((tema) => tema.parentTopicId === undefined);
    return raices.map((tema) => ({
      tema,
      temas: [tema, ...temas.filter((otro) => otro.parentTopicId === tema.id)],
    }));
  }

  /**
   * Los grupos de la comunidad: una lectura por tema suyo.
   *
   * Un tema que falle no tumba la comunidad —`catchError` devuelve su página
   * vacía—, y tampoco se disimula: si todos fallan, la comunidad queda sin
   * grupos y el estado vacío lo dice como lo que es.
   */
  private cargarGrupos(comunidad: Comunidad): void {
    const tenantId = this.tenantId();
    if (tenantId === null) {
      return;
    }

    this.cargandoGrupos.set(true);
    this.cargoGruposAlgunaVez.set(false);
    this.gruposDeLaComunidad.set([]);

    forkJoin(
      comunidad.temas.map((tema) =>
        this.community.listGroups({ tenantId, topicId: tema.id, limit: TOPE_POR_TEMA }).pipe(
          map((pagina) => pagina.items),
          catchError(() => of([] as readonly GroupListItem[])),
        ),
      ),
    ).subscribe({
      next: (paginas) => {
        // Un grupo puede venir por más de un tema: se une por id.
        const porId = new Map<string, GroupListItem>();
        for (const grupo of paginas.flat()) {
          porId.set(grupo.id, grupo);
        }
        this.gruposDeLaComunidad.set([...porId.values()]);
        this.cargandoGrupos.set(false);
        this.cargoGruposAlgunaVez.set(true);
      },
      error: () => {
        this.cargandoGrupos.set(false);
        this.cargoGruposAlgunaVez.set(true);
        this.error.set('No pudimos cargar los grupos de esta comunidad.');
      },
    });
  }
}
