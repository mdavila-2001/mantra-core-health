import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CommunityClient } from '../data-access/community/community.client';
import { FilesClient } from '../data-access/files/files.client';
import { SessionStore } from '../auth/session.store';
import { ChatSocketService } from './chat-socket.service';
import type {
  ConversationListItem,
  DirectMessage,
  ParticipantPreferencesUpdate,
  ProfilePresence,
  PublicDirectoryResult,
} from '../data-access/community/community.types';

/** Cada cuánto se relee la bandeja, en milisegundos. */
const SONDEO_BANDEJA_MS = 60_000;

/** Cada cuánto se relee el hilo abierto. */
const SONDEO_HILO_MS = 30_000;

/** Cuántos mensajes trae cada página del hilo. */
export const PAGINA_DE_MENSAJES = 30;

/** Cuántas conversaciones trae la bandeja de una vez. */
const LIMITE_DE_BANDEJA = 50;

/** Tope de conversaciones que se conservan al releer con «cargar más» abierto. */
const TOPE_DE_BANDEJA = 100;

/** Cuánto dura «escribiendo…» sin que llegue otro aviso (F4.1). */
const ESCRIBIENDO_CADUCA_MS = 6_000;

/** Cada cuánto se repite el aviso de «escribiendo» mientras se teclea. */
const ESCRIBIENDO_REPITE_MS = 3_000;

/**
 * Un mensaje que ya se ve en el hilo pero que el servidor todavía no acusó.
 *
 * Existe para que enviar sea instantáneo: la burbuja aparece con el reloj en el
 * mismo gesto de apretar Enter, y recién después se cambia por la que devuelve
 * el `POST`. Antes de esto el hilo se recargaba entero después de cada envío —
 * la pantalla parpadeaba y el mensaje propio tardaba lo que tardara la red en
 * aparecer, que es exactamente lo que ningún chat hace.
 */
export interface MensajePendiente {
  /** Identidad mientras no tenga la del servidor. Nunca sale de acá. */
  readonly claveTemporal: string;
  readonly conversationId: string;
  readonly bodyText: string;
  readonly replyToMessageId?: string;
  /** Si es un adjunto, lo que hace falta para pintarlo antes de que suba. */
  readonly adjunto?: {
    readonly fileId?: string;
    readonly nombre: string;
    readonly tipo: string;
    /** `blob:` local, para ver la foto sin esperar al servidor. */
    readonly vistaPrevia?: string;
  };
  readonly creadoEn: Date;
  readonly estado: 'enviando' | 'fallado';
}

/**
 * Un mensaje del hilo tal como lo mira la pantalla: el del servidor, o uno
 * todavía en vuelo. Se unifican acá para que la vista no tenga dos listas ni
 * dos formas de dibujar la misma burbuja.
 */
export interface MensajeDelHilo {
  readonly clave: string;
  readonly id: string | null;
  readonly senderProfileId: string;
  readonly bodyText?: string;
  readonly replyToMessageId?: string;
  readonly attachmentFileId?: string;
  readonly sentAt?: Date;
  readonly estado: 'enviando' | 'fallado' | 'enviado';
  /** Si el autor lo corrigió después de mandarlo (F4.5). */
  readonly isEdited?: boolean;
  /** Si el autor lo eliminó: se pinta «Se eliminó este mensaje» (F4.5). */
  readonly deletedAt?: Date;
  /** Sólo en los pendientes: con qué reintentar. */
  readonly pendiente?: MensajePendiente;
}

/**
 * El estado de la mensajería, una sola vez para toda la aplicación.
 *
 * ## Por qué un store y no dos pantallas con lo suyo
 *
 * La bandeja y el hilo eran dos componentes con **dos copias de la misma
 * lista**, dos sondeos y dos suscripciones al socket. Cambiar de conversación
 * destruía uno y creaba el otro: la lista se volvía a pedir, el scroll se
 * perdía y durante un instante no había nada dibujado. En un chat cambiar de
 * conversación no puede costar una recarga de la bandeja — es lo primero que
 * separa esto de WhatsApp.
 *
 * Ahora las dos pantallas leen de acá. `Messaging` monta el marco y la lista;
 * `Thread` se pinta en su `router-outlet` y sólo cambia el panel derecho.
 *
 * ## Root, pero con `iniciar()` y `detener()`
 *
 * Es `providedIn: 'root'` para sobrevivir a la navegación entre hilos, pero no
 * sondea desde que arranca la aplicación: `Messaging` lo enciende al entrar y
 * lo apaga al salir. Quien está en la agenda no tiene por qué estar pidiendo
 * conversaciones cada minuto.
 *
 * ## El socket empuja, el sondeo confirma
 *
 * El socket es la entrega normal; el sondeo (60 s la bandeja, 30 s el hilo) es
 * la red de seguridad si el socket se cayó. Un mensaje que llega por el socket
 * se **aplica en el acto** sobre la fila de la bandeja —último mensaje, hora y
 * un no-leído más— y además dispara una relectura: la fila local alcanza para
 * que la pantalla reaccione ya, y el servidor sigue siendo quien decide el
 * orden y los contadores definitivos.
 *
 * ## Todo lo que se marca se pinta antes de que conteste el servidor
 *
 * Favorito, archivar, fijar, editar, eliminar (F4): la pantalla cambia en el
 * mismo gesto y la llamada sale detrás. Si falla, se vuelve a lo que había y
 * se dice. Esperar la respuesta para mover una estrella es lo que hace que un
 * chat se sienta lento aunque la red sea rápida.
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly community = inject(CommunityClient);
  private readonly archivos = inject(FilesClient);
  private readonly socket = inject(ChatSocketService);
  private readonly sesion = inject(SessionStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /* --- Identidad ---------------------------------------------------------- */

  /** El perfil público propio: quién soy dentro de la mensajería. */
  readonly perfil = signal<string | null>(null);
  readonly perfilResuelto = signal(false);
  readonly creandoPerfil = signal(false);

  /** Lo último que salió mal, para que la pantalla lo diga. */
  readonly error = signal('');

  /* --- Bandeja ------------------------------------------------------------ */

  readonly conversaciones = signal<readonly ConversationListItem[]>([]);
  readonly cargandoBandeja = signal(false);
  readonly bandejaCargada = signal(false);
  /** El cursor para «cargar más» conversaciones, o `null` si ya están todas (F4.3). */
  readonly cursorBandeja = signal<string | null>(null);
  readonly cargandoMasBandeja = signal(false);

  /* --- Hilo abierto ------------------------------------------------------- */

  readonly activaId = signal<string | null>(null);
  /** Del más reciente al más antiguo, como los devuelve el contrato. */
  readonly mensajes = signal<readonly DirectMessage[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly peerReadUpTo = signal<Date | null>(null);
  readonly cargandoHilo = signal(false);
  readonly hiloCargado = signal(false);
  readonly enviando = signal(false);

  /** El mensaje fijado en la barra superior del hilo abierto (F4.6). */
  readonly fijado = signal<DirectMessage | null>(null);

  /** Los que todavía no acusó el servidor, de todas las conversaciones. */
  readonly pendientes = signal<readonly MensajePendiente[]>([]);

  /**
   * El borrador de cada conversación.
   *
   * Cambiar de chat y volver conserva lo que se había escrito, como WhatsApp.
   * Vive en memoria y no en `localStorage`: un borrador a medias es del rato,
   * no de la cuenta.
   */
  private readonly borradores = new Map<string, string>();

  /** A qué mensaje se está respondiendo, si a alguno. */
  readonly respondiendoA = signal<MensajeDelHilo | null>(null);

  /** Qué mensaje propio se está corrigiendo, si alguno (F4.5). */
  readonly editando = signal<MensajeDelHilo | null>(null);

  /**
   * Cuántos sin leer tenía la conversación al abrirla.
   *
   * Se guarda porque abrir el hilo apaga el contador en el acto, y el
   * separador «N mensajes no leídos» —lo que le dice a alguien dónde retomar
   * después de dos días sin entrar— necesita saber cuántos eran **antes** de
   * apagarlo.
   */
  readonly noLeidosAlAbrir = signal(0);

  /* --- Escribiendo y presencia (F4.1 / F4.2) ------------------------------ */

  /** Quién está escribiendo, por conversación. */
  readonly escribiendo = signal<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

  /** En línea o última vez, por perfil. Sólo de los hilos que se abrieron. */
  readonly presencia = signal<ReadonlyMap<string, ProfilePresence>>(new Map());

  private readonly caducidadesDeEscribiendo = new Map<string, ReturnType<typeof setTimeout>>();
  private ultimoAvisoDeEscribiendo = 0;
  private avisandoQueEscribo = false;

  /* --- Buscador de gente nueva -------------------------------------------- */

  readonly resultados = signal<readonly PublicDirectoryResult[]>([]);
  readonly buscandoAhora = signal(false);
  readonly abriendo = signal(false);

  private temporizadorBandeja: ReturnType<typeof setTimeout> | null = null;
  private temporizadorHilo: ReturnType<typeof setTimeout> | null = null;
  private encendido = false;
  private hiloMarcado = new Set<string>();

  /**
   * Los adjuntos ya resueltos, por id de archivo: la `data:` URL lista para un
   * `src` o un `href`, `''` mientras se pide, `null` si no se pudo leer.
   */
  private readonly urlesDeArchivo = signal<ReadonlyMap<string, string | null>>(new Map());

  /**
   * El hilo listo para leer: del más viejo al más nuevo, con los pendientes de
   * esta conversación al final.
   */
  readonly enOrden = computed<readonly MensajeDelHilo[]>(() => {
    const activa = this.activaId();
    const delServidor = [...this.mensajes()]
      .reverse()
      .map<MensajeDelHilo>((mensaje) => ({
        clave: mensaje.id,
        id: mensaje.id,
        senderProfileId: mensaje.senderProfileId,
        bodyText: mensaje.bodyText,
        replyToMessageId: mensaje.replyToMessageId,
        attachmentFileId: mensaje.attachmentFileId,
        sentAt: mensaje.sentAt,
        estado: 'enviado',
        isEdited: mensaje.isEdited,
        deletedAt: mensaje.deletedAt,
      }));

    const enVuelo = this.pendientes()
      .filter((p) => p.conversationId === activa)
      .map<MensajeDelHilo>((pendiente) => ({
        clave: pendiente.claveTemporal,
        id: null,
        senderProfileId: this.perfil() ?? '',
        bodyText: pendiente.bodyText,
        replyToMessageId: pendiente.replyToMessageId,
        attachmentFileId: pendiente.adjunto?.fileId,
        sentAt: pendiente.creadoEn,
        estado: pendiente.estado,
        pendiente,
      }));

    return [...delServidor, ...enVuelo];
  });

  /** La conversación abierta, si está en la bandeja. */
  readonly conversacionActiva = computed(() =>
    this.conversaciones().find((c) => c.id === this.activaId()),
  );

  /** Cuántos mensajes sin leer hay en total, para el título de la pestaña. */
  readonly sinLeer = computed(() =>
    this.conversaciones().reduce((total, c) => total + c.unreadCount, 0),
  );

  /** Quiénes están escribiendo en el hilo abierto, sin uno mismo. */
  readonly escribiendoEnActiva = computed<readonly string[]>(() => {
    const activa = this.activaId();
    if (activa === null) {
      return [];
    }
    const propio = this.perfil();
    return [...(this.escribiendo().get(activa) ?? [])].filter((id) => id !== propio);
  });

  /** La presencia del otro lado, en una conversación directa. */
  readonly presenciaDelOtro = computed<ProfilePresence | null>(() => {
    const activa = this.conversacionActiva();
    if (activa === undefined || activa.peers.length !== 1) {
      return null;
    }
    return this.presencia().get(activa.peers[0].profileId) ?? null;
  });

  constructor() {
    // Mensaje nuevo: se aplica sobre lo que ya hay —el hilo abierto y la fila
    // de la bandeja— y se confirma releyendo. Aplicar y releer no es
    // redundante: lo primero hace que la pantalla reaccione en el acto, lo
    // segundo es lo único que garantiza que el orden y los contadores queden
    // como los pintaría un refresco.
    this.socket.onMessage.pipe(takeUntilDestroyed()).subscribe((mensaje) => {
      if (mensaje.conversationId === this.activaId()) {
        this.absorber([mensaje]);
        this.marcarLeido();
      }
      // Quien mandó algo dejó de escribir, aunque el aviso no haya llegado.
      this.aplicarEscribiendo(mensaje.conversationId, mensaje.senderProfileId, false);
      this.aplicarEnLaFila(mensaje);
      this.recargarBandeja();
    });

    this.socket.onRead.pipe(takeUntilDestroyed()).subscribe((evento) => {
      if (evento.conversationId !== this.activaId()) {
        return;
      }
      const leido = this.mensajes().find((m) => m.id === evento.lastReadMessageId);
      if (leido?.sentAt) {
        this.peerReadUpTo.set(leido.sentAt);
      }
    });

    this.socket.onNewConversation
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.recargarBandeja());

    // F4.1 · escribiendo… Caduca solo a los seis segundos: si el otro cerró
    // la pestaña a mitad de frase, el «escribiendo» no puede quedar para siempre.
    this.socket.onTyping.pipe(takeUntilDestroyed()).subscribe((evento) => {
      this.aplicarEscribiendo(evento.conversationId, evento.profileId, evento.typing);
    });

    // F4.2 · en línea / última vez.
    this.socket.onPresence.pipe(takeUntilDestroyed()).subscribe((presencia) => {
      this.presencia.update((mapa) => new Map(mapa).set(presencia.profileId, presencia));
    });

    // F4.5 · alguien corrigió o eliminó: se refleja donde esté ese mensaje.
    this.socket.onMessageUpdated.pipe(takeUntilDestroyed()).subscribe((mensaje) => {
      this.reemplazar(mensaje);
      this.actualizarVistaPrevia(mensaje);
    });
    this.socket.onMessageDeleted.pipe(takeUntilDestroyed()).subscribe((evento) => {
      const cuando = evento.deletedAt ?? new Date();
      this.marcarEliminado(evento.conversationId, evento.messageId, cuando);
    });

    // F4.6 · cambió el fijado.
    this.socket.onPinned.pipe(takeUntilDestroyed()).subscribe((evento) => {
      this.aplicarFijado(evento.conversationId, evento.pinnedMessageId);
    });

    // Las fotos y documentos que aparecen en el hilo necesitan una URL
    // firmada, y pedirla desde el template sería pedirla en cada ciclo de
    // detección de cambios. Se resuelven acá, una vez por archivo.
    effect(() => this.resolverAdjuntos(this.enOrden()));
  }

  /* --- Encendido ---------------------------------------------------------- */

  /**
   * Enciende la mensajería: resuelve el perfil propio, carga la bandeja y se
   * une al socket. Idempotente — `Messaging` la llama al entrar y volver a
   * entrar no vuelve a pedir el perfil.
   */
  iniciar(): void {
    if (this.encendido) {
      this.recargarBandeja();
      return;
    }
    this.encendido = true;

    if (this.perfilResuelto()) {
      this.arrancarConPerfil();
      return;
    }

    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        this.perfil.set(propio?.id ?? null);
        this.perfilResuelto.set(true);
        if (propio) {
          this.arrancarConPerfil();
        }
      },
      error: () => {
        this.perfilResuelto.set(true);
        this.error.set('No pudimos saber si tenés perfil público.');
      },
    });
  }

  /** Apaga los sondeos. El perfil y lo cargado se conservan. */
  detener(): void {
    this.encendido = false;
    this.pararTemporizadores();
  }

  private arrancarConPerfil(): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.socket.joinInbox(propio);
    this.recargarBandeja();
    this.agendarBandeja();
    // Si el hilo ya estaba elegido —se entró por `/messaging/<id>` directo— hay
    // que cargarlo ahora, que es cuando recién se sabe con qué perfil leerlo.
    // El hilo se marca activo antes de que el perfil esté resuelto: el marco y
    // el panel se construyen en el mismo ciclo, y el `abrir()` del panel llega
    // primero.
    const activa = this.activaId();
    if (activa !== null) {
      this.socket.joinConversation(activa, propio);
      this.cargarHilo(true);
      this.pedirPresencia(activa);
    }
  }

  /**
   * Crea la vitrina pública que la mensajería necesita, sin salir de la
   * pantalla.
   *
   * Se crea con lo mínimo —nombre y slug— y **sin publicarla en el
   * directorio**: `visibility` va omitido a propósito, porque aparecer en la
   * guía pública es una decisión aparte que se toma en «Mi perfil».
   */
  crearPerfil(): void {
    const tenantId = this.sesion.activeTenantId();
    if (tenantId === null || this.creandoPerfil()) {
      if (tenantId === null) {
        this.error.set('No pudimos saber en qué organización estás.');
      }
      return;
    }

    const nombre = this.sesion.displayName() ?? 'Mi perfil';
    this.creandoPerfil.set(true);
    this.community
      .upsertOwnProfile({ tenantId, slug: slugDe(nombre), displayName: nombre })
      .subscribe({
        next: (propio) => {
          this.creandoPerfil.set(false);
          this.perfil.set(propio.id);
          this.error.set('');
          this.arrancarConPerfil();
        },
        error: () => {
          this.creandoPerfil.set(false);
          this.error.set('No pudimos crear tu perfil. Probá de nuevo.');
        },
      });
  }

  /* --- Bandeja ------------------------------------------------------------ */

  recargarBandeja(): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.cargandoBandeja.set(true);
    // Si ya se habían pedido más páginas, releer conserva lo que se veía: no
    // vale que un tic del sondeo te devuelva a las primeras cincuenta.
    const limite = Math.min(
      Math.max(LIMITE_DE_BANDEJA, this.conversaciones().length),
      TOPE_DE_BANDEJA,
    );
    this.community
      .listConversations({ profileId: propio, limit: limite })
      .subscribe({
        next: (pagina) => {
          this.conversaciones.set(pagina.items);
          this.cursorBandeja.set(pagina.nextCursor);
          this.bandejaCargada.set(true);
          this.cargandoBandeja.set(false);
          this.error.set('');
        },
        error: () => {
          this.cargandoBandeja.set(false);
          this.bandejaCargada.set(true);
          // No se vacía lo que ya había: un tic fallido no es motivo para
          // borrarle a alguien la bandeja que estaba mirando.
          this.error.set('No pudimos cargar tus conversaciones.');
        },
      });
  }

  /** Trae la página siguiente de la bandeja (F4.3). */
  cargarMasBandeja(): void {
    const propio = this.perfil();
    const cursor = this.cursorBandeja();
    if (propio === null || cursor === null || this.cargandoMasBandeja()) {
      return;
    }
    this.cargandoMasBandeja.set(true);
    this.community
      .listConversations({ profileId: propio, limit: LIMITE_DE_BANDEJA, cursor })
      .subscribe({
        next: (pagina) => {
          const conocidas = new Set(this.conversaciones().map((c) => c.id));
          this.conversaciones.update((lista) => [
            ...lista,
            ...pagina.items.filter((c) => !conocidas.has(c.id)),
          ]);
          this.cursorBandeja.set(pagina.nextCursor);
          this.cargandoMasBandeja.set(false);
        },
        error: () => {
          this.cargandoMasBandeja.set(false);
          this.error.set('No pudimos cargar más conversaciones.');
        },
      });
  }

  /**
   * Aplica un mensaje recién llegado sobre su fila de la bandeja, sin esperar
   * la relectura: la vista previa cambia, la hora sube y el no-leído aumenta
   * si el hilo no está abierto. La fila también sube, pero **debajo de las
   * fijadas**: fijar es justamente pedir que nada pase por encima.
   */
  private aplicarEnLaFila(mensaje: DirectMessage): void {
    const propio = this.perfil();
    this.conversaciones.update((lista) => {
      const indice = lista.findIndex((c) => c.id === mensaje.conversationId);
      if (indice === -1) {
        return lista;
      }
      const fila = lista[indice];
      const esMio = mensaje.senderProfileId === propio;
      const abierta = mensaje.conversationId === this.activaId();
      const actualizada: ConversationListItem = {
        ...fila,
        lastMessageAt: mensaje.sentAt ?? fila.lastMessageAt,
        lastMessage: {
          id: mensaje.id,
          senderProfileId: mensaje.senderProfileId,
          bodyText: mensaje.bodyText,
          contentTypeConceptId: mensaje.contentTypeConceptId,
          attachmentFileId: mensaje.attachmentFileId,
          sentAt: mensaje.sentAt,
        },
        // Lo recién mandado nadie lo leyó todavía.
        ...(esMio ? { lastMessageReadByPeer: false } : {}),
        unreadCount:
          esMio || abierta ? fila.unreadCount : fila.unreadCount + 1,
      };
      const resto = lista.filter((_, i) => i !== indice);
      const desde = actualizada.isPinned ? 0 : resto.filter((c) => c.isPinned).length;
      return [...resto.slice(0, desde), actualizada, ...resto.slice(desde)];
    });
  }

  /** Cambia la vista previa de una fila si el mensaje editado era el último. */
  private actualizarVistaPrevia(mensaje: DirectMessage): void {
    this.conversaciones.update((lista) =>
      lista.map((c) =>
        c.id === mensaje.conversationId && c.lastMessage?.id === mensaje.id
          ? {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                bodyText: mensaje.bodyText,
                ...(mensaje.deletedAt === undefined ? {} : { deletedAt: mensaje.deletedAt }),
              },
            }
          : c,
      ),
    );
  }

  /** Pone en cero el contador de una fila, al abrirla. */
  private apagarNoLeidos(conversationId: string): void {
    this.conversaciones.update((lista) =>
      lista.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
  }

  /** Marca la conversación como leída sin abrirla (menú de la fila). */
  marcarFilaLeida(conversationId: string): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.apagarNoLeidos(conversationId);
    this.community.markConversationRead(conversationId, propio).subscribe({
      next: () => this.recargarBandeja(),
      error: () => undefined,
    });
  }

  /**
   * Favorita, fijada o archivada, de mi lado (F4.4). Se pinta en el acto y se
   * manda detrás; si falla, se vuelve a lo que había.
   *
   * Archivar quita el favorito acá también, y no sólo en el servidor: la
   * regla es la misma y la pantalla no puede mostrar durante medio segundo
   * una fila que está en las dos listas.
   */
  actualizarPreferencias(conversationId: string, cambios: Omit<ParticipantPreferencesUpdate, 'profileId'>): void {
    const propio = this.perfil();
    const antes = this.conversaciones().find((c) => c.id === conversationId);
    if (propio === null || antes === undefined) {
      return;
    }

    const optimista: ConversationListItem = {
      ...antes,
      ...(cambios.isFavorite === undefined ? {} : { isFavorite: cambios.isFavorite }),
      ...(cambios.isPinned === undefined ? {} : { isPinned: cambios.isPinned }),
    };
    const conArchivo: ConversationListItem =
      cambios.archived === undefined
        ? optimista
        : cambios.archived
          ? { ...optimista, isFavorite: false, archivedAt: antes.archivedAt ?? new Date() }
          : (({ archivedAt: _fuera, ...sinArchivo }) => sinArchivo)(optimista);
    this.reemplazarFila(conArchivo);

    this.community
      .updateParticipant(conversationId, { profileId: propio, ...cambios })
      .subscribe({
        next: (quedo) => {
          if (!quedo) {
            return;
          }
          const actual = this.conversaciones().find((c) => c.id === conversationId);
          if (actual === undefined) {
            return;
          }
          const { archivedAt: _fuera, ...sinArchivo } = actual;
          this.reemplazarFila({
            ...sinArchivo,
            isFavorite: quedo.isFavorite,
            isPinned: quedo.isPinned,
            ...(quedo.archivedAt === undefined ? {} : { archivedAt: quedo.archivedAt }),
          });
        },
        error: () => {
          this.reemplazarFila(antes);
          this.error.set('No pudimos guardar el cambio en la conversación.');
        },
      });
  }

  /** Reemplaza una fila y reordena: fijadas primero, el resto como estaba. */
  private reemplazarFila(fila: ConversationListItem): void {
    this.conversaciones.update((lista) => {
      const reemplazada = lista.map((c) => (c.id === fila.id ? fila : c));
      return [
        ...reemplazada.filter((c) => c.isPinned),
        ...reemplazada.filter((c) => !c.isPinned),
      ];
    });
  }

  /* --- Hilo --------------------------------------------------------------- */

  /**
   * Abre una conversación. Vaciar lo del hilo anterior es obligatorio: sin eso
   * se ven por un instante los mensajes del chat que se acaba de dejar, con el
   * nombre del nuevo en la cabecera.
   */
  abrir(conversationId: string): void {
    if (this.activaId() === conversationId) {
      return;
    }
    const anterior = this.activaId();
    if (anterior !== null) {
      this.dejarDeEscribir();
      this.socket.leaveConversation(anterior, this.perfil() ?? undefined);
    }

    this.activaId.set(conversationId);
    this.mensajes.set([]);
    this.cursor.set(null);
    this.peerReadUpTo.set(null);
    this.fijado.set(null);
    this.hiloCargado.set(false);
    this.respondiendoA.set(null);
    this.editando.set(null);
    this.noLeidosAlAbrir.set(
      this.conversaciones().find((c) => c.id === conversationId)?.unreadCount ?? 0,
    );
    this.apagarNoLeidos(conversationId);

    const propio = this.perfil();
    if (propio !== null) {
      this.socket.joinConversation(conversationId, propio);
      this.cargarHilo(true);
      this.pedirPresencia(conversationId);
    }
  }

  /** Cierra el hilo — se volvió a la bandeja sin ninguno abierto. */
  cerrar(): void {
    const activa = this.activaId();
    if (activa !== null) {
      this.dejarDeEscribir();
      this.socket.leaveConversation(activa, this.perfil() ?? undefined);
    }
    this.activaId.set(null);
    this.mensajes.set([]);
    this.cursor.set(null);
    this.fijado.set(null);
    this.hiloCargado.set(false);
    this.respondiendoA.set(null);
    this.editando.set(null);
    if (this.temporizadorHilo !== null) {
      clearTimeout(this.temporizadorHilo);
      this.temporizadorHilo = null;
    }
  }

  /**
   * Trae una página del hilo.
   *
   * @param primera - Si es la apertura (arranca el sondeo y marca leído) o el
   *   «traeme lo anterior» del scroll.
   */
  private cargarHilo(primera: boolean): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null || this.cargandoHilo()) {
      return;
    }
    this.cargandoHilo.set(true);

    const cursor = primera ? null : this.cursor();
    this.community
      .listMessages(conversationId, {
        profileId: propio,
        limit: PAGINA_DE_MENSAJES,
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          // Sólo si sigue siendo el hilo abierto: entre el pedido y la
          // respuesta se pudo haber cambiado de conversación, y volcar acá lo
          // que llegó tarde mostraría los mensajes de un chat en otro.
          if (this.activaId() !== conversationId) {
            this.cargandoHilo.set(false);
            return;
          }
          if (primera) {
            this.mensajes.set(pagina.items);
            this.fijado.set(pagina.pinnedMessage ?? null);
          } else {
            this.mensajes.update((lista) => [...lista, ...pagina.items]);
          }
          this.cursor.set(pagina.nextCursor);
          this.hiloCargado.set(true);
          this.cargandoHilo.set(false);
          this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
          this.error.set('');
          if (primera) {
            this.agendarHilo();
            this.marcarLeido();
          }
        },
        error: () => {
          this.cargandoHilo.set(false);
          this.hiloCargado.set(true);
          this.error.set('No pudimos cargar la conversación.');
        },
      });
  }

  /** Trae la página anterior — lo que se llama al llegar arriba de todo. */
  cargarAnteriores(): void {
    if (this.cursor() !== null && !this.cargandoHilo()) {
      this.cargarHilo(false);
    }
  }

  /** `true` si todavía queda historia hacia atrás. */
  readonly hayAnteriores = computed(() => this.cursor() !== null);

  /**
   * Suma mensajes que no se tenían, sin duplicar, y descarta el eco de los
   * propios que ya estaban en vuelo: el `POST` devuelve el id y el socket
   * empuja el mismo mensaje, y sin esto la burbuja aparecería dos veces.
   */
  private absorber(items: readonly DirectMessage[]): void {
    const conocidos = new Set(this.mensajes().map((m) => m.id));
    const nuevos = items.filter((m) => !conocidos.has(m.id));
    if (nuevos.length > 0) {
      this.mensajes.update((lista) => [...nuevos, ...lista]);
    }
  }

  /** Reemplaza un mensaje del hilo abierto por su versión nueva, si está. */
  private reemplazar(mensaje: DirectMessage): void {
    if (mensaje.conversationId !== this.activaId()) {
      return;
    }
    this.mensajes.update((lista) => lista.map((m) => (m.id === mensaje.id ? mensaje : m)));
    if (this.fijado()?.id === mensaje.id) {
      this.fijado.set(mensaje);
    }
  }

  /** Deja un mensaje como eliminado: sin cuerpo ni adjunto, con la fecha. */
  private marcarEliminado(conversationId: string, messageId: string, cuando: Date): void {
    if (conversationId === this.activaId()) {
      this.mensajes.update((lista) =>
        lista.map((m) =>
          m.id === messageId
            ? { ...m, bodyText: undefined, attachmentFileId: undefined, deletedAt: cuando }
            : m,
        ),
      );
      if (this.fijado()?.id === messageId) {
        this.fijado.set(null);
      }
    }
    this.conversaciones.update((lista) =>
      lista.map((c) =>
        c.id === conversationId && c.lastMessage?.id === messageId
          ? {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                bodyText: undefined,
                attachmentFileId: undefined,
                deletedAt: cuando,
              },
            }
          : c,
      ),
    );
  }

  /** Una vez por apertura del hilo, no una por tic de sondeo. */
  private marcarLeido(): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null) {
      return;
    }
    const marca = `${conversationId}:${this.mensajes()[0]?.id ?? ''}`;
    if (this.hiloMarcado.has(marca)) {
      return;
    }
    this.hiloMarcado.add(marca);
    this.apagarNoLeidos(conversationId);
    this.community.markConversationRead(conversationId, propio).subscribe({
      next: () => this.recargarBandeja(),
      // Que el acuse falle no vale un cartel: no cambia lo que se lee.
      error: () => undefined,
    });
  }

  /* --- Escribiendo y presencia (F4.1 / F4.2) ------------------------------ */

  private aplicarEscribiendo(conversationId: string, profileId: string, activo: boolean): void {
    const clave = `${conversationId}:${profileId}`;
    const caducidad = this.caducidadesDeEscribiendo.get(clave);
    if (caducidad !== undefined) {
      clearTimeout(caducidad);
      this.caducidadesDeEscribiendo.delete(clave);
    }
    this.escribiendo.update((mapa) => {
      const copia = new Map(mapa);
      const quienes = new Set(copia.get(conversationId) ?? []);
      if (activo) {
        quienes.add(profileId);
      } else {
        quienes.delete(profileId);
      }
      if (quienes.size === 0) {
        copia.delete(conversationId);
      } else {
        copia.set(conversationId, quienes);
      }
      return copia;
    });
    if (activo && this.isBrowser) {
      this.caducidadesDeEscribiendo.set(
        clave,
        setTimeout(() => this.aplicarEscribiendo(conversationId, profileId, false), ESCRIBIENDO_CADUCA_MS),
      );
    }
  }

  /**
   * Avisa a los demás que se está escribiendo en el hilo abierto (F4.1).
   *
   * Un aviso cada tres segundos mientras haya teclas, no uno por tecla: el
   * otro lado lo deja caducar a los seis, así que con eso alcanza para que
   * «escribiendo…» no parpadee ni inunde el socket.
   *
   * @param hayTexto - `false` cuando el campo quedó vacío: se avisa que se dejó.
   */
  avisarEscribiendo(hayTexto: boolean): void {
    const propio = this.perfil();
    const activa = this.activaId();
    if (propio === null || activa === null) {
      return;
    }
    if (!hayTexto) {
      this.dejarDeEscribir();
      return;
    }
    const ahora = Date.now();
    if (this.avisandoQueEscribo && ahora - this.ultimoAvisoDeEscribiendo < ESCRIBIENDO_REPITE_MS) {
      return;
    }
    this.avisandoQueEscribo = true;
    this.ultimoAvisoDeEscribiendo = ahora;
    this.socket.typing(activa, propio, true);
  }

  private dejarDeEscribir(): void {
    const propio = this.perfil();
    const activa = this.activaId();
    if (!this.avisandoQueEscribo || propio === null || activa === null) {
      return;
    }
    this.avisandoQueEscribo = false;
    this.socket.typing(activa, propio, false);
  }

  /** Pide de una vez quién está en línea al abrir el hilo (F4.2). */
  private pedirPresencia(conversationId: string): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.community.conversationPresence(conversationId, propio).subscribe({
      next: (presencia) => {
        if (!presencia) {
          return;
        }
        this.presencia.update((mapa) => {
          const copia = new Map(mapa);
          for (const peer of presencia.peers) {
            copia.set(peer.profileId, peer);
          }
          return copia;
        });
      },
      // Sin presencia no hay «en línea», y ya está: la cabecera muestra lo de siempre.
      error: () => undefined,
    });
  }

  /* --- Envío -------------------------------------------------------------- */

  /** Lo escrito en la conversación abierta. */
  borrador(): string {
    const activa = this.activaId();
    return activa === null ? '' : (this.borradores.get(activa) ?? '');
  }

  guardarBorrador(texto: string): void {
    const activa = this.activaId();
    if (activa !== null) {
      if (texto === '') {
        this.borradores.delete(activa);
      } else {
        this.borradores.set(activa, texto);
      }
    }
  }

  responder(mensaje: MensajeDelHilo | null): void {
    this.respondiendoA.set(mensaje);
    if (mensaje !== null) {
      this.editando.set(null);
    }
  }

  /**
   * Manda un mensaje y lo pinta antes de que el servidor conteste.
   *
   * El pendiente se saca de la lista recién cuando el mensaje real ya está en
   * `mensajes`: quitarlo antes deja un hueco de un cuadro en el que la burbuja
   * desaparece y vuelve.
   */
  enviar(texto: string): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    const cuerpo = texto.trim();
    if (propio === null || conversationId === null || cuerpo === '') {
      return;
    }

    const responde = this.respondiendoA();
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      bodyText: cuerpo,
      ...(responde?.id ? { replyToMessageId: responde.id } : {}),
      creadoEn: new Date(),
      estado: 'enviando',
    };

    this.pendientes.update((lista) => [...lista, pendiente]);
    this.guardarBorrador('');
    this.respondiendoA.set(null);
    this.dejarDeEscribir();
    this.despachar(pendiente);
  }

  /**
   * Reenvía un mensaje —su texto y su adjunto— a otra conversación.
   *
   * Va por el mismo camino que un envío normal: si la conversación destino no
   * es la abierta, la burbuja no se pinta acá pero la fila de la bandeja se
   * actualiza en cuanto el servidor acusa. El adjunto se manda por su
   * `fileId`: es el mismo archivo, no una copia.
   */
  reenviar(mensaje: MensajeDelHilo, conversationId: string): void {
    const propio = this.perfil();
    if (propio === null || mensaje.estado !== 'enviado') {
      return;
    }
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      bodyText: mensaje.bodyText ?? '',
      ...(mensaje.attachmentFileId
        ? { adjunto: { fileId: mensaje.attachmentFileId, nombre: 'Archivo adjunto', tipo: '' } }
        : {}),
      creadoEn: new Date(),
      estado: 'enviando',
    };
    this.pendientes.update((lista) => [...lista, pendiente]);
    this.despachar(pendiente);
  }

  /** Reintenta uno que falló. */
  reintentar(pendiente: MensajePendiente): void {
    this.pendientes.update((lista) =>
      lista.map((p) =>
        p.claveTemporal === pendiente.claveTemporal
          ? { ...p, estado: 'enviando' as const }
          : p,
      ),
    );
    this.despachar(pendiente);
  }

  /** Descarta uno que falló y no se va a reintentar. */
  descartar(pendiente: MensajePendiente): void {
    this.pendientes.update((lista) =>
      lista.filter((p) => p.claveTemporal !== pendiente.claveTemporal),
    );
  }

  private despachar(pendiente: MensajePendiente): void {
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.enviando.set(true);

    this.community
      .sendMessage(pendiente.conversationId, {
        senderProfileId: propio,
        bodyText: pendiente.bodyText,
        ...(pendiente.replyToMessageId
          ? { replyToMessageId: pendiente.replyToMessageId }
          : {}),
        ...(pendiente.adjunto?.fileId
          ? {
              contentType: 'MEDIA' as const,
              attachmentFileId: pendiente.adjunto.fileId,
            }
          : {}),
      })
      .subscribe({
        next: (acuse) => {
          this.enviando.set(false);
          // El mensaje real entra en la lista y el pendiente sale en el mismo
          // paso, así la burbuja no parpadea.
          if (pendiente.conversationId === this.activaId()) {
            this.absorber([
              {
                id: acuse.id,
                conversationId: pendiente.conversationId,
                senderProfileId: propio,
                contentTypeConceptId: '',
                bodyText: pendiente.bodyText,
                ...(pendiente.replyToMessageId
                  ? { replyToMessageId: pendiente.replyToMessageId }
                  : {}),
                ...(pendiente.adjunto?.fileId
                  ? { attachmentFileId: pendiente.adjunto.fileId }
                  : {}),
                sentAt: acuse.sentAt ?? pendiente.creadoEn,
              },
            ]);
          }
          this.pendientes.update((lista) =>
            lista.filter((p) => p.claveTemporal !== pendiente.claveTemporal),
          );
          this.recargarBandeja();
        },
        error: () => {
          this.enviando.set(false);
          this.pendientes.update((lista) =>
            lista.map((p) =>
              p.claveTemporal === pendiente.claveTemporal
                ? { ...p, estado: 'fallado' as const }
                : p,
            ),
          );
        },
      });
  }

  /**
   * Sube un archivo y lo manda como adjunto.
   *
   * La burbuja aparece antes de que empiece a subir, con la miniatura local
   * (`blob:`) si es una imagen: esperar a que termine la subida para recién
   * mostrar algo es lo que hace que mandar una foto se sienta lento.
   */
  enviarAdjunto(archivo: File, leyenda: string): void {
    const conversationId = this.activaId();
    if (conversationId === null) {
      return;
    }

    const esImagen = archivo.type.startsWith('image/');
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      bodyText: leyenda.trim(),
      creadoEn: new Date(),
      estado: 'enviando',
      adjunto: {
        nombre: archivo.name,
        tipo: archivo.type,
        ...(esImagen && this.isBrowser
          ? { vistaPrevia: URL.createObjectURL(archivo) }
          : {}),
      },
    };
    this.pendientes.update((lista) => [...lista, pendiente]);
    this.dejarDeEscribir();

    // `PHI` y no `NORMAL`: lo que se adjunta en un chat entre paciente y
    // profesional es, con toda probabilidad, la foto de un análisis o de una
    // receta. La sensibilidad cambia cómo se guarda y quién puede descargarlo,
    // así que el defecto tiene que ser el que protege, no el que conviene.
    this.archivos
      .upload(archivo, esImagen ? 'IMAGE' : 'DOCUMENT', 'PHI')
      .subscribe({
      next: (subido) => {
        const conFileId: MensajePendiente = {
          ...pendiente,
          adjunto: { ...pendiente.adjunto!, fileId: subido.id },
        };
        this.pendientes.update((lista) =>
          lista.map((p) =>
            p.claveTemporal === pendiente.claveTemporal ? conFileId : p,
          ),
        );
        this.despachar(conFileId);
      },
      error: () => {
        this.pendientes.update((lista) =>
          lista.map((p) =>
            p.claveTemporal === pendiente.claveTemporal
              ? { ...p, estado: 'fallado' as const }
              : p,
          ),
        );
        this.error.set('No pudimos subir el archivo.');
      },
    });
  }

  /* --- Editar, eliminar y fijar (F4.5 / F4.6) ----------------------------- */

  /** Empieza a corregir un mensaje propio: el composer toma su texto. */
  empezarAEditar(mensaje: MensajeDelHilo | null): void {
    this.editando.set(mensaje);
    if (mensaje !== null) {
      this.respondiendoA.set(null);
    }
  }

  /**
   * Manda el texto corregido del mensaje en edición. Se pinta ya, con la marca
   * «editado»; si el servidor lo rechaza, vuelve el texto anterior.
   */
  confirmarEdicion(texto: string): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    const mensaje = this.editando();
    const cuerpo = texto.trim();
    if (propio === null || conversationId === null || mensaje?.id == null || cuerpo === '') {
      return;
    }
    const messageId = mensaje.id;
    const anterior = this.mensajes().find((m) => m.id === messageId);
    this.editando.set(null);
    if (anterior === undefined || cuerpo === anterior.bodyText) {
      return;
    }

    this.reemplazar({ ...anterior, bodyText: cuerpo, isEdited: true });
    this.actualizarVistaPrevia({ ...anterior, bodyText: cuerpo, isEdited: true });
    this.community
      .editMessage(conversationId, messageId, { senderProfileId: propio, bodyText: cuerpo })
      .subscribe({
        next: (editado) => {
          if (editado) {
            this.reemplazar(editado);
            this.actualizarVistaPrevia(editado);
          }
        },
        error: () => {
          this.reemplazar(anterior);
          this.actualizarVistaPrevia(anterior);
          this.error.set('No pudimos guardar la corrección.');
        },
      });
  }

  /** Elimina un mensaje propio. Queda «Se eliminó este mensaje» en su lugar. */
  eliminar(mensaje: MensajeDelHilo): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null || mensaje.id === null) {
      return;
    }
    const messageId = mensaje.id;
    const anterior = this.mensajes().find((m) => m.id === messageId);
    const filaAnterior = this.conversaciones().find((c) => c.id === conversationId);
    const fijadoAnterior = this.fijado();
    if (anterior === undefined) {
      return;
    }

    this.marcarEliminado(conversationId, messageId, new Date());
    this.community.deleteMessage(conversationId, messageId, propio).subscribe({
      next: (borrado) => {
        if (borrado?.deletedAt) {
          this.marcarEliminado(conversationId, messageId, borrado.deletedAt);
        }
      },
      error: () => {
        this.reemplazar(anterior);
        if (filaAnterior !== undefined) {
          this.reemplazarFila(filaAnterior);
        }
        if (fijadoAnterior?.id === messageId) {
          this.fijado.set(fijadoAnterior);
        }
        this.error.set('No pudimos eliminar el mensaje.');
      },
    });
  }

  /** Fija un mensaje en la barra superior. Uno a la vez: el nuevo reemplaza al anterior. */
  fijar(mensaje: MensajeDelHilo): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    if (propio === null || conversationId === null || mensaje.id === null) {
      return;
    }
    const messageId = mensaje.id;
    const anterior = this.fijado();
    const enHilo = this.mensajes().find((m) => m.id === messageId);
    if (enHilo !== undefined) {
      this.fijado.set(enHilo);
    }
    this.marcarFijadoEnLaFila(conversationId, messageId);

    this.community.pinMessage(conversationId, propio, messageId).subscribe({
      next: () => undefined,
      error: () => {
        this.fijado.set(anterior);
        this.marcarFijadoEnLaFila(conversationId, anterior?.id ?? null);
        this.error.set('No pudimos fijar el mensaje.');
      },
    });
  }

  /** Suelta el mensaje fijado del hilo abierto. */
  soltarFijado(): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    const anterior = this.fijado();
    if (propio === null || conversationId === null) {
      return;
    }
    this.fijado.set(null);
    this.marcarFijadoEnLaFila(conversationId, null);

    this.community.unpinMessage(conversationId, propio).subscribe({
      next: () => undefined,
      error: () => {
        this.fijado.set(anterior);
        this.marcarFijadoEnLaFila(conversationId, anterior?.id ?? null);
        this.error.set('No pudimos soltar el mensaje fijado.');
      },
    });
  }

  /** Lo que llega por el socket cuando otro fija o suelta. */
  private aplicarFijado(conversationId: string, pinnedMessageId: string | null): void {
    this.marcarFijadoEnLaFila(conversationId, pinnedMessageId);
    if (conversationId !== this.activaId()) {
      return;
    }
    if (pinnedMessageId === null) {
      this.fijado.set(null);
      return;
    }
    const enHilo = this.mensajes().find((m) => m.id === pinnedMessageId);
    if (enHilo !== undefined) {
      this.fijado.set(enHilo);
      return;
    }
    // No está en lo cargado: la primera página lo trae completo.
    const propio = this.perfil();
    if (propio === null) {
      return;
    }
    this.community
      .listMessages(conversationId, { profileId: propio, limit: 1 })
      .subscribe({
        next: (pagina) => {
          if (this.activaId() === conversationId) {
            this.fijado.set(pagina.pinnedMessage ?? null);
          }
        },
        error: () => undefined,
      });
  }

  private marcarFijadoEnLaFila(conversationId: string, pinnedMessageId: string | null): void {
    this.conversaciones.update((lista) =>
      lista.map((c) => {
        if (c.id !== conversationId) {
          return c;
        }
        const { pinnedMessageId: _fuera, ...sinFijado } = c;
        return pinnedMessageId === null ? sinFijado : { ...sinFijado, pinnedMessageId };
      }),
    );
  }

  /* --- Adjuntos ----------------------------------------------------------- */

  /** El adjunto como `data:` URL, si ya se leyó; `null` si todavía no o si falló. */
  urlDe(fileId: string): string | null {
    return this.urlesDeArchivo().get(fileId) || null;
  }

  /** `true` si el archivo se pidió y no se pudo leer. */
  adjuntoNoDisponible(fileId: string): boolean {
    return this.urlesDeArchivo().get(fileId) === null;
  }

  /**
   * Lee los adjuntos que se van a pintar y todavía no están. Una vez por
   * archivo, por sesión de la pantalla.
   *
   * ## Por qué `contentDataUrl` y no `downloadUrl`
   *
   * Porque lo que devuelve `downloadUrl` **no es una URL de navegador**: el
   * backend arma `file://local/<sha>?signature=…`, que ningún `<img>` carga, y
   * la CSP del proyecto sólo admite `img-src 'self' data:`. Es el mismo motivo
   * por el que la foto de perfil se pinta con `imageDataUrl` (ver
   * `FilesClient`). Bajar los bytes por `HttpClient` deja además que el
   * interceptor mande la sesión, que `GET …/content` exige.
   *
   * El backend hoy sólo entrega el contenido a quien subió el archivo o a un
   * rol revisor: el adjunto **ajeno** de una conversación puede responder 403,
   * y la burbuja lo dice («Archivo no disponible») en vez de quedarse
   * «subiendo» para siempre. Que un participante pueda leer los adjuntos de su
   * conversación está anotado en F4 del plan.
   */
  private resolverAdjuntos(mensajes: readonly MensajeDelHilo[]): void {
    if (!this.isBrowser) {
      return;
    }
    const yaResueltos = this.urlesDeArchivo();
    for (const mensaje of mensajes) {
      const fileId = mensaje.attachmentFileId;
      if (fileId === undefined || yaResueltos.has(fileId)) {
        continue;
      }
      // Se reserva el lugar antes de pedir, para no pedir dos veces el mismo
      // archivo mientras la primera petición está en vuelo.
      this.urlesDeArchivo.update((mapa) => new Map(mapa).set(fileId, ''));
      this.archivos.contentDataUrl(fileId).subscribe({
        next: (url) =>
          this.urlesDeArchivo.update((mapa) => new Map(mapa).set(fileId, url)),
        error: () =>
          this.urlesDeArchivo.update((mapa) => new Map(mapa).set(fileId, null)),
      });
    }
  }

  /* --- Escribirle a alguien nuevo ----------------------------------------- */

  buscarGente(consulta: string): void {
    const q = consulta.trim();
    if (q === '') {
      this.resultados.set([]);
      return;
    }
    this.buscandoAhora.set(true);
    this.community.searchPractitioners(q, 10).subscribe({
      next: (items) => {
        this.resultados.set(items);
        this.buscandoAhora.set(false);
      },
      error: () => {
        this.buscandoAhora.set(false);
        this.error.set('No pudimos buscar profesionales.');
      },
    });
  }

  limpiarBusqueda(): void {
    this.resultados.set([]);
  }

  /**
   * Abre —o crea— el hilo con quien tenga ese slug, y devuelve su id por el
   * callback.
   *
   * Son dos llamadas y no una porque la superficie pública devuelve `slug` y no
   * `profileId`: no publica identificadores internos. La segunda es idempotente
   * desde este carril: si el hilo ya existe, el backend devuelve ése.
   */
  escribirA(slug: string, alAbrir: (conversationId: string) => void): void {
    const propio = this.perfil();
    if (propio === null || this.abriendo()) {
      return;
    }
    this.abriendo.set(true);

    this.community.readProfileBySlug(slug).subscribe({
      next: (ficha) => {
        // Uno no se escribe a sí mismo. Sin esto, «Enviar mensaje» en la propia
        // ficha pública pedía una conversación con un solo participante
        // repetido y el backend devolvía **otra** conversación cualquiera.
        if (ficha.id === propio) {
          this.abriendo.set(false);
          this.error.set('Ese es tu propio perfil: no podés escribirte.');
          return;
        }

        this.community
          .createConversation({ participantProfileIds: [propio, ficha.id] })
          .subscribe({
            next: ({ id }) => {
              this.abriendo.set(false);
              this.recargarBandeja();
              alAbrir(id);
            },
            error: () => {
              this.abriendo.set(false);
              this.error.set('No pudimos abrir la conversación.');
            },
          });
      },
      error: () => {
        this.abriendo.set(false);
        this.error.set('No pudimos encontrar a esa persona.');
      },
    });
  }

  /* --- Sondeo ------------------------------------------------------------- */

  private agendarBandeja(): void {
    if (!this.isBrowser || this.temporizadorBandeja !== null) {
      return;
    }
    this.temporizadorBandeja = setTimeout(() => {
      this.temporizadorBandeja = null;
      if (this.encendido) {
        this.recargarBandeja();
        this.agendarBandeja();
      }
    }, SONDEO_BANDEJA_MS);
  }

  /**
   * Relee **la primera página** del hilo abierto.
   *
   * Releer sólo la primera y no todo lo paginado es deliberado: lo nuevo llega
   * arriba, y volver a pedir las cinco páginas que alguien fue abriendo hacia
   * atrás sería releer una conversación entera cada 30 segundos.
   */
  private agendarHilo(): void {
    if (!this.isBrowser || this.temporizadorHilo !== null) {
      return;
    }
    this.temporizadorHilo = setTimeout(() => {
      this.temporizadorHilo = null;
      const propio = this.perfil();
      const conversationId = this.activaId();
      if (!this.encendido || propio === null || conversationId === null) {
        return;
      }
      this.community
        .listMessages(conversationId, {
          profileId: propio,
          limit: PAGINA_DE_MENSAJES,
        })
        .subscribe({
          next: (pagina) => {
            if (this.activaId() === conversationId) {
              this.absorber(pagina.items);
              // Lo que cambió en los que ya estaban —editados, eliminados—
              // también llega por acá si el socket se perdió el aviso.
              for (const mensaje of pagina.items) {
                this.reemplazar(mensaje);
              }
              this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
              this.fijado.set(pagina.pinnedMessage ?? null);
            }
          },
          error: () => undefined,
        });
      this.agendarHilo();
    }, SONDEO_HILO_MS);
  }

  private pararTemporizadores(): void {
    if (this.temporizadorBandeja !== null) {
      clearTimeout(this.temporizadorBandeja);
      this.temporizadorBandeja = null;
    }
    if (this.temporizadorHilo !== null) {
      clearTimeout(this.temporizadorHilo);
      this.temporizadorHilo = null;
    }
  }
}

/** Identidad de un mensaje mientras no tenga la del servidor. */
function claveTemporal(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Un slug legible a partir del nombre, con una cola al azar.
 *
 * La cola no es decoración: el slug es único en toda la plataforma y hay más de
 * una «María López». Sin ella, la segunda que entra a los chats se choca con un
 * 409 en el peor momento —al pulsar «crear mi perfil»— y no tiene forma de
 * arreglarlo desde esa pantalla.
 */
function slugDe(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const cola = Math.random().toString(36).slice(2, 8);
  return `${base === '' ? 'perfil' : base}-${cola}`;
}
