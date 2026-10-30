import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { debounceTime, filter, map, Subject } from 'rxjs';

import { ChatStore, SIN_NOMBRE } from '../../core/messaging/chat.store';
import { loading } from '../../core/view-state/view-state';
import { ChatPreferences } from '../../core/messaging/chat-preferences';
import { conversationLabel } from '../../core/messaging/conversation-label';
import type { ContextoDeChat } from '../../core/messaging/contexto-de-chat';
import {
  almacenDeLaPestana,
  destinoDeLaQuery,
  nonceDeLaQuery,
  tomarContexto,
  type DestinoDeChat,
} from '../../core/messaging/enlace-de-chat';
import { PharmacyOrdersClient } from '../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { ConversationListItem } from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Avatar } from '../../shared/components/atoms/avatar/avatar';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { SegmentedControl } from '../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';
import { ConversationList, type AccionDeFila } from './conversation-list/conversation-list';

/** Los cuatro filtros de la bandeja, en el orden en que se muestran. */
const FILTROS = ['todos', 'no-leidos', 'favoritos', 'grupos'] as const;

type Filtro = (typeof FILTROS)[number];

/**
 * Con quién se escribe: `'propio'` o el `profileId` de una vitrina de
 * organización (puede haber más de una: quien atiende dos farmacias).
 */
type PerfilElegible = string;

/** El valor del selector para el perfil propio. */
const PERFIL_PROPIO = 'propio';

/** Cuánto se espera antes de preguntarle al directorio, al tipear. */
const ESPERA_DE_BUSQUEDA_MS = 300;

/**
 * El marco de la mensajería — carril P2.
 *
 * ## Una sola pantalla
 *
 * La bandeja y el hilo eran dos pantallas hermanas: abrir una conversación
 * destruía la lista y la volvía a pedir. Ahora esto es el marco —lista a la
 * izquierda, `router-outlet` a la derecha— y el hilo es una ruta **hija**: al
 * cambiar de conversación la lista no se entera, que es lo primero que separa
 * esto de un chat de verdad.
 *
 * El estado no vive acá sino en `ChatStore`, que es de la aplicación y no de la
 * pantalla: el hilo lee del mismo store y por eso no necesita volver a pedir
 * nada para saber con quién está hablando.
 *
 * ## El buscador busca dos cosas
 *
 * Lo que se escribe filtra **las conversaciones que ya tenés** y, en paralelo,
 * busca **gente a la que todavía no le escribiste**. Son las dos razones por
 * las que alguien abre un buscador de chat, y separarlas en dos cajas —una
 * arriba y otra detrás de un botón— obligaba a saber de antemano cuál de las
 * dos cosas estabas por hacer.
 */
@Component({
  selector: 'app-messaging',
  imports: [
    Alert,
    AppButton,
    Avatar,
    ConversationList,
    EmptyState,
    FormsModule,
    NgTemplateOutlet,
    RouterOutlet,
    SegmentedControl,
  ],
  templateUrl: './messaging.html',
  styleUrl: './messaging.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // El chat ocupa la ventana entera: el marco de la aplicación le saca su
    // relleno sólo a esta pantalla. Sin esto el hilo quedaría con 40 px de aire
    // alrededor y el composer flotando lejos del borde.
    class: 'pantalla-a-sangre',
  },
})
export class Messaging {
  protected readonly store = inject(ChatStore);
  private readonly preferencias = inject(ChatPreferences);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly titulo = inject(Title);
  private readonly pedidos = inject(PharmacyOrdersClient);
  /** Donde los botones «Chatear» dejan el contexto; `null` en el servidor. */
  private readonly almacen = almacenDeLaPestana();

  /**
   * `true` cuando la pantalla ya se destruyó. Abrir un chat tarda dos o tres
   * peticiones; si mientras tanto la persona se fue a otra pantalla, el hilo
   * que termina de abrirse no la puede arrastrar de vuelta a Chats.
   */
  private destruida = false;

  protected readonly filtros = FILTROS;

  protected readonly consulta = signal('');
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly verArchivados = signal(false);
  protected readonly verBloqueados = signal(false);

  /** Los perfiles bloqueados, para marcar sus filas. */
  protected readonly idsBloqueados = computed<ReadonlySet<string>>(
    () => new Set(this.store.bloqueados().map((b) => b.profileId)),
  );

  private readonly tecleado = new Subject<string>();

  /**
   * La dirección actual, para saber si hay un hilo abierto.
   *
   * Hace falta en angosto, donde la lista y la conversación no caben juntas:
   * con hilo abierto se ve sólo el hilo, y sin él sólo la lista.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly hayHiloAbierto = computed(() =>
    /\/messaging\/[^/?#]+/.test(this.url()),
  );

  /** Las archivadas, que no se mezclan con el resto. */
  protected readonly archivadas = computed(() =>
    this.store
      .conversaciones()
      .filter((c) => this.preferencias.isArchived(c.id)),
  );

  /**
   * Lo que se ve en la lista: el filtro elegido, menos lo archivado, y
   * recortado por lo que se haya escrito en el buscador.
   */
  protected readonly visibles = computed<readonly ConversationListItem[]>(() => {
    const consulta = this.consulta().trim().toLowerCase();
    const filtro = this.filtro();
    const enArchivados = this.verArchivados();

    return this.store.conversaciones().filter((conversacion) => {
      if (this.preferencias.isArchived(conversacion.id) !== enArchivados) {
        return false;
      }
      if (filtro === 'no-leidos' && conversacion.unreadCount === 0) {
        return false;
      }
      if (filtro === 'favoritos' && !this.preferencias.isFavorite(conversacion.id)) {
        return false;
      }
      if (
        filtro === 'grupos' &&
        conversacion.groupId === undefined &&
        conversacion.peers.length <= 1
      ) {
        return false;
      }
      if (consulta === '') {
        return true;
      }
      const nombre = conversationLabel(conversacion).toLowerCase();
      const ultimo = (conversacion.lastMessage?.bodyText ?? '').toLowerCase();
      return nombre.includes(consulta) || ultimo.includes(consulta);
    });
  });

  /**
   * «Yo» y cada vitrina de organización que la sesión puede atender: las
   * identidades con las que se puede escribir. Vacío —sin selector— para
   * quien no atiende ninguna.
   */
  protected readonly opcionesDePerfil = computed<readonly SegmentedOption<PerfilElegible>[]>(() => {
    const vitrinas = this.store.vitrinasDeOrganizacion();
    return vitrinas.length === 0
      ? []
      : [
          { value: PERFIL_PROPIO, label: 'Yo' },
          ...vitrinas.map((v) => ({ value: v.profileId, label: v.nombre })),
        ];
  });

  protected readonly perfilElegido = computed<PerfilElegible>(() =>
    this.store.actuandoComoOrganizacion() ? (this.store.perfil() ?? PERFIL_PROPIO) : PERFIL_PROPIO,
  );

  /**
   * El nombre de la vitrina con la que se escribe, o `null` si se escribe como
   * uno mismo. En ese modo el buscador sólo filtra los chats que ya hay: la
   * API no deja buscar contactos ni iniciar chats con la vitrina.
   */
  protected readonly comoOrganizacion = computed<string | null>(() =>
    this.store.actuandoComoOrganizacion() ? (this.store.vitrinaDeOrganizacion()?.nombre ?? null) : null,
  );

  protected readonly textoDelBuscador = computed(() => {
    const nombre = this.comoOrganizacion();
    return nombre === null ? 'Buscar un chat o iniciar uno nuevo' : `Buscar en los chats de ${nombre}`;
  });

  /**
   * Cambia de identidad. Con un hilo abierto se vuelve primero a la bandeja:
   * ese hilo es de la otra identidad y, con la nueva, puede no existir.
   */
  protected elegirPerfil(valor: PerfilElegible): void {
    const destino = valor === PERFIL_PROPIO ? null : valor;
    if (destino !== null && !this.store.vitrinasDeOrganizacion().some((v) => v.profileId === destino)) {
      return;
    }
    const cambiar = (): void => this.store.actuarComo(destino);
    if (this.hayHiloAbierto()) {
      void this.router.navigate(['/messaging']).then(cambiar);
    } else {
      cambiar();
    }
  }

  /**
   * Cuántos **chats** tienen algo sin leer. Es la unidad de la píldora de la
   * cabecera y del chip «No leídos»: antes la píldora contaba mensajes y el
   * chip conversaciones, y «4 sin leer» al lado de «No leídos 2» parecía un
   * error.
   */
  protected readonly noLeidas = computed(
    () => this.store.conversaciones().filter((c) => c.unreadCount > 0).length,
  );

  /** «1 chat sin leer», «3 chats sin leer». */
  protected readonly rotuloNoLeidas = computed(() => {
    const n = this.noLeidas();
    return n === 1 ? '1 chat sin leer' : `${n} chats sin leer`;
  });

  /** S2 mientras se resuelve el perfil. */
  protected readonly cargando = loading();

  /**
   * «Tenés 3 chats archivados». Con todo archivado la bandeja **no** está
   * vacía: decir «Todavía no tenés chats» (S3) sería mentir, y la salida es
   * abrir el cajón, no ir a buscar con quién hablar.
   */
  protected readonly rotuloArchivadas = computed(() => {
    const n = this.archivadas().length;
    return n === 1 ? 'Tiene 1 chat archivado.' : `Tiene ${n} chats archivados.`;
  });

  protected readonly vacio = computed(() => this.visibles().length === 0);

  /** Para el nombre de quien se muestra en «Bloqueados» sin ficha resuelta. */
  protected readonly sinNombre = SIN_NOMBRE;

  /** `true` si hay algo escrito pero ninguna conversación propia casa. */
  protected readonly sinCoincidencias = computed(
    () => this.consulta().trim() !== '' && this.visibles().length === 0,
  );

  constructor() {
    this.store.iniciar();
    inject(DestroyRef).onDestroy(() => {
      this.destruida = true;
      this.store.detener();
    });

    // El carril de filtros nace cuando se resuelve el perfil: se mide al
    // aparecer y cada vez que cambia de ancho, para prender las flechas justas.
    effect((onCleanup) => {
      const el = this.carril()?.nativeElement;
      if (el === undefined) return;
      untracked(() => this.medirCarril());
      if (typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(() => this.medirCarril());
      observador.observe(el);
      onCleanup(() => observador.disconnect());
    });

    // Al directorio se le pregunta cuando la persona dejó de escribir: una
    // petición por tecla contra un buscador que atraviesa todos los tenants es
    // ruido para el servidor y resultados que parpadean para quien mira.
    this.tecleado
      .pipe(debounceTime(ESPERA_DE_BUSQUEDA_MS), takeUntilDestroyed())
      .subscribe((texto) => this.store.buscarGente(texto));

    // El `?escribirA=<slug>` con el que llegan el botón «Enviar mensaje» de una
    // ficha pública y «Hablar con el broker» del directorio de aseguradoras. Se
    // atiende cuando el perfil propio ya está resuelto: sin eso no hay con qué
    // abrir el hilo. La ruta llega antes que el perfil: `ChatStore.escribirA`
    // y `abrirConversacion` encolan el pedido hasta tenerlo (`conPerfil`), y
    // antes, atenderlo en el acto lo descartaba en silencio —la bandeja
    // quedaba abierta sin hilo—.
    //
    // Los botones del marketplace («Chatear con la farmacia», «Consultar por
    // chat») dejan de qué se trata en `sessionStorage` y mandan sólo su nonce
    // (`ctx=`): la tarjeta sale **sólo** si el nonce existe en esta pestaña
    // —un enlace de afuera no puede fabricarlo— y se consume al leerlo. Sin
    // nonce válido el hilo se abre igual, sin tarjeta. Al abrir se navega al
    // hilo **reemplazando** esta dirección.
    //
    // `?pedido=<id>` es el chat de un pedido de farmacia: el hilo lo abre la
    // API (`POST /pharmacy/orders/:id/conversation`), no la bandeja.
    this.ruta.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const destino = destinoDeLaQuery(query);
      if (destino !== null) {
        // Leído, borrado y validado otra vez (`tomarContexto`), y sólo si el
        // botón lo dejó para este mismo destino.
        const contexto =
          tomarContexto(nonceDeLaQuery(query), destino, this.almacen) ?? undefined;
        this.abrirDesdeEnlace(destino, contexto);
      }
    });

    // «(3) AloVida - Chats» en la pestaña mientras haya sin leer, como
    // cualquier chat: es lo que avisa desde otra pestaña sin abrir ésta. La
    // `TitleStrategy` vuelve a estampar el título en cada navegación —el hilo
    // es una ruta hija—, así que se aplica también tras cada `NavigationEnd`.
    effect(() => {
      this.store.sinLeer();
      this.estamparTitulo();
    });
    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => queueMicrotask(() => this.estamparTitulo()));
    inject(DestroyRef).onDestroy(() => this.titulo.setTitle(sinContador(this.titulo.getTitle())));
  }

  protected alEscribir(texto: string): void {
    this.consulta.set(texto);
    // Invalida en la misma tecla cualquier HTTP anterior. Esperar al debounce
    // dejaba que una respuesta vieja apareciera durante 300 ms bajo el texto
    // nuevo. También se emite el vacío para cancelar una consulta pendiente.
    this.store.limpiarBusqueda();
    this.tecleado.next(texto);
  }

  protected limpiarBusqueda(): void {
    this.consulta.set('');
    this.store.limpiarBusqueda();
  }

  /* ---- el carril de filtros, paginado con flechas ---------------------- */

  private readonly carril = viewChild<ElementRef<HTMLElement>>('carril');
  protected readonly puedeRetroceder = signal(false);
  protected readonly puedeAvanzar = signal(false);

  /** Prende o apaga cada flecha según dónde quedó el carril. */
  protected medirCarril(): void {
    const el = this.carril()?.nativeElement;
    if (el === undefined) return;
    this.puedeRetroceder.set(el.scrollLeft > 1);
    this.puedeAvanzar.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  /** Una «página» de filtros: lo que se ve del carril, menos un chip de solapa. */
  protected pasarFiltros(sentido: 1 | -1): void {
    const el = this.carril()?.nativeElement;
    if (el === undefined) return;
    el.scrollBy({ left: sentido * Math.max(el.clientWidth - 48, 48), behavior: 'smooth' });
  }

  protected elegirFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
    this.verArchivados.set(false);
    this.verBloqueados.set(false);
  }

  protected rotulo(filtro: Filtro): string {
    switch (filtro) {
      case 'todos':
        return 'Todos';
      case 'no-leidos':
        return 'No leídos';
      case 'favoritos':
        return 'Favoritos';
      case 'grupos':
        return 'Grupos';
    }
  }

  protected alternarArchivados(): void {
    this.verArchivados.set(!this.verArchivados());
    this.verBloqueados.set(false);
    this.filtro.set('todos');
  }

  /** La lista de a quiénes bloqueaste, con el botón para desbloquear. */
  protected alternarBloqueados(): void {
    this.verBloqueados.set(!this.verBloqueados());
    this.verArchivados.set(false);
    this.filtro.set('todos');
  }

  protected desbloquear(profileId: string): void {
    this.store.desbloquear(profileId);
  }

  private estamparTitulo(): void {
    const base = sinContador(this.titulo.getTitle());
    const cuantos = this.store.sinLeer();
    this.titulo.setTitle(cuantos > 0 ? `(${cuantos}) ${base}` : base);
  }

  /** Lo que pide el menú de una fila. */
  protected atender(accion: AccionDeFila): void {
    switch (accion.tipo) {
      case 'favorito':
        this.preferencias.toggleFavorite(accion.conversationId);
        break;
      case 'archivar':
        this.preferencias.toggleArchived(accion.conversationId);
        break;
      case 'leer':
        this.store.marcarFilaLeida(accion.conversationId);
        break;
      case 'perfil':
        this.verPerfil(accion.conversationId);
        break;
      case 'bloquear':
      case 'desbloquear': {
        const peer = this.store
          .conversaciones()
          .find((c) => c.id === accion.conversationId)?.peers[0];
        if (peer === undefined) {
          break;
        }
        if (accion.tipo === 'bloquear') {
          this.store.bloquear(peer.profileId, peer.displayName);
        } else {
          this.store.desbloquear(peer.profileId);
        }
        break;
      }
    }
  }

  /**
   * Abre la conversación con la hoja del contacto desplegada.
   *
   * Antes navegaba a `/public-profile/<profileId>`, **una ruta que no existe**
   * —las fichas públicas son `/p|o|f|l|s/:slug`—, así que «Ver perfil» caía en
   * el 404. Ahora abre el hilo pidiéndole la hoja con `?contacto=1`: es el
   * mismo destino que el «Ver perfil» del menú del hilo, y desde la bandeja
   * hace falta pasar por el hilo porque en angosto la fila no lo tiene abierto.
   */
  private verPerfil(conversationId: string): void {
    void this.router.navigate(['/messaging', conversationId], {
      queryParams: { contacto: 1 },
    });
  }

  /** Abre el hilo con alguien del directorio. */
  protected escribirA(slug: string): void {
    this.abrirConSlug(slug);
  }

  /** Abre el contacto autenticado sin resolverlo otra vez por slug público. */
  protected escribirAPerfil(profileId: string): void {
    this.store.escribirAPerfil(profileId, (conversationId) => {
      this.limpiarBusqueda();
      void this.router.navigate(['/messaging', conversationId]);
    });
  }

  private abrirConSlug(slug: string, contexto?: ContextoDeChat): void {
    this.store.escribirA(
      slug,
      (conversationId) => this.irAlHilo(conversationId),
      contexto,
    );
  }

  private irAlHilo(conversationId: string): void {
    // La apertura terminó con la pantalla ya cerrada: no se navega.
    if (this.destruida) {
      return;
    }
    this.limpiarBusqueda();
    // Sin `queryParams`: la dirección del hilo no hereda `escribirA` ni el
    // contexto, que ya se mandó.
    void this.router.navigate(['/messaging', conversationId], { replaceUrl: true });
  }

  /**
   * Abre el hilo pedido por `?escribirA=` o `?pedido=` **reemplazando** esa
   * entrada del historial.
   *
   * Con un `navigate` común quedaban dos entradas de chat apiladas —
   * `/messaging?escribirA=…` y `/messaging/<id>`—, y la flecha «Volver» caía en
   * la primera, que reabría el hilo: quien tocaba «Hablar con el broker» no
   * podía salir del chat. Reemplazando (`irAlHilo`), atrás vuelve a la ficha de
   * donde vino.
   */
  private abrirDesdeEnlace(destino: DestinoDeChat, contexto?: ContextoDeChat): void {
    if ('pedido' in destino) {
      this.store.abrirConversacion(
        this.pedidos.abrirConversacion(destino.pedido).pipe(map((r) => r.conversationId)),
        (conversationId) => this.irAlHilo(conversationId),
        contexto,
      );
    } else {
      this.abrirConSlug(destino.escribirA, contexto);
    }
  }
}

/** Quita el «(3) » del frente de un título, si lo tiene. */
function sinContador(titulo: string): string {
  return titulo.replace(/^\(\d+\)\s+/u, '');
}
