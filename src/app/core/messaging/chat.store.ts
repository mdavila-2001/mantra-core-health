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
import { ChatAutoReply } from './chat-auto-reply';
import { stickerDe, type Sticker } from './sticker-pack.generated';
import type {
  ConversationListItem,
  DirectMessage,
  PublicDirectoryResult,
} from '../data-access/community/community.types';

/** Cada cuánto se relee la bandeja, en milisegundos. */
const SONDEO_BANDEJA_MS = 60_000;

/** Cada cuánto se relee el hilo abierto. */
const SONDEO_HILO_MS = 30_000;

/** Cuántos mensajes trae cada página del hilo. */
export const PAGINA_DE_MENSAJES = 30;

/** Cuántas conversaciones trae la bandeja. */
const LIMITE_DE_BANDEJA = 50;

/**
 * Cuánto tiempo se puede editar un mensaje después de mandarlo.
 *
 * Cinco minutos, contados contra `sentAt` — la hora del servidor, no la del
 * navegador de quien edita: el reloj local se puede atrasar, y la ventana sería
 * la que quisiera cada máquina.
 *
 * **La regla también vive en el servidor.** Acá se aplica para que el menú no
 * ofrezca algo que va a fallar; ocultar el botón no es la barrera. La maqueta
 * responde 422 fuera de la ventana, igual que la API.
 */
export const VENTANA_DE_EDICION_MS = 5 * 60_000;

/**
 * `true` si el mensaje todavía se puede editar.
 *
 * Se pide `ahora` en vez de leer el reloj adentro para que la vista pueda
 * recalcular con un tic propio —y para que una prueba pueda pararlo.
 *
 * @param mensaje - El mensaje a mirar.
 * @param propio - El perfil de quien está mirando.
 * @param ahora - En qué instante se pregunta.
 */
export function editable(
  mensaje: MensajeDelHilo,
  propio: string | null,
  ahora: number,
): boolean {
  return (
    mensaje.estado === 'enviado' &&
    mensaje.id !== null &&
    propio !== null &&
    mensaje.senderProfileId === propio &&
    // Sin texto no hay nada que editar: una foto sola se borra, no se corrige.
    (mensaje.bodyText ?? '').trim() !== '' &&
    mensaje.sentAt !== undefined &&
    ahora - mensaje.sentAt.getTime() <= VENTANA_DE_EDICION_MS
  );
}

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
  /** Si su texto se cambió después de mandarlo — se dice en la burbuja. */
  readonly isEdited?: boolean;
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
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly community = inject(CommunityClient);
  private readonly archivos = inject(FilesClient);
  private readonly socket = inject(ChatSocketService);
  private readonly autoReply = inject(ChatAutoReply);
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

  /* --- Hilo abierto ------------------------------------------------------- */

  readonly activaId = signal<string | null>(null);
  /** Del más reciente al más antiguo, como los devuelve el contrato. */
  readonly mensajes = signal<readonly DirectMessage[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly peerReadUpTo = signal<Date | null>(null);
  readonly cargandoHilo = signal(false);
  readonly hiloCargado = signal(false);
  readonly enviando = signal(false);

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

  /**
   * Qué mensaje propio se está editando, si alguno.
   *
   * Responder y editar son excluyentes: el composer es uno solo, y las dos
   * cosas quieren el mismo campo con distinto significado.
   */
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

  /* --- Buscador de gente nueva -------------------------------------------- */

  readonly resultados = signal<readonly PublicDirectoryResult[]>([]);
  readonly buscandoAhora = signal(false);
  readonly abriendo = signal(false);

  private temporizadorBandeja: ReturnType<typeof setTimeout> | null = null;
  private temporizadorHilo: ReturnType<typeof setTimeout> | null = null;
  private encendido = false;
  private hiloMarcado = new Set<string>();

  /**
   * Cuándo se le mandó la última respuesta automática a cada conversación.
   *
   * En memoria y no en el navegador a propósito: el descanso entre avisos
   * protege a la otra persona de recibir cinco carteles seguidos, y una sesión
   * nueva es un momento razonable para volver a empezar. Persistirlo sería
   * guardar un dato de comportamiento ajeno sin necesidad.
   */
  private readonly ultimoAvisoPorConversacion = new Map<string, number>();

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
      this.aplicarEnLaFila(mensaje);
      this.recargarBandeja();
      this.quizasResponderSolo(mensaje);
    });

    // Edición ajena: se aplica sobre la burbuja que ya está en pantalla. Sin
    // esto, el otro lado corregiría su mensaje y acá seguiría el texto viejo
    // hasta el próximo tic de sondeo.
    this.socket.onMessageUpdated
      .pipe(takeUntilDestroyed())
      .subscribe((mensaje) => {
        if (mensaje.conversationId === this.activaId()) {
          this.aplicarTexto(mensaje.id, mensaje.bodyText, mensaje.isEdited ?? true);
        }
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
    // Entrar a la mensajería cuenta como estar: es lo primero que desactiva la
    // respuesta automática.
    this.autoReply.marcarActividad();
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
    this.community
      .listConversations({ profileId: propio, limit: LIMITE_DE_BANDEJA })
      .subscribe({
        next: (pagina) => {
          this.conversaciones.set(pagina.items);
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

  /**
   * Aplica un mensaje recién llegado sobre su fila de la bandeja, sin esperar
   * la relectura: la vista previa cambia, la hora sube y el no-leído aumenta
   * si el hilo no está abierto. La fila también salta al tope, que es donde la
   * pone el servidor.
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
          sentAt: mensaje.sentAt,
        },
        unreadCount:
          esMio || abierta ? fila.unreadCount : fila.unreadCount + 1,
      };
      return [actualizada, ...lista.filter((_, i) => i !== indice)];
    });
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

  /* --- Hilo --------------------------------------------------------------- */

  /**
   * Abre una conversación. Vaciar lo del hilo anterior es obligatorio: sin eso
   * se ven por un instante los mensajes del chat que se acaba de dejar, con el
   * nombre del nuevo en la cabecera.
   */
  abrir(conversationId: string): void {
    // Abrir un chat es la prueba más clara de que estás mirando: le corre el
    // reloj a la respuesta automática.
    this.autoReply.marcarActividad();
    if (this.activaId() === conversationId) {
      return;
    }
    const anterior = this.activaId();
    if (anterior !== null) {
      this.socket.leaveConversation(anterior);
    }

    this.activaId.set(conversationId);
    this.mensajes.set([]);
    this.cursor.set(null);
    this.peerReadUpTo.set(null);
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
    }
  }

  /** Cierra el hilo — se volvió a la bandeja sin ninguno abierto. */
  cerrar(): void {
    const activa = this.activaId();
    if (activa !== null) {
      this.socket.leaveConversation(activa);
    }
    this.activaId.set(null);
    this.mensajes.set([]);
    this.cursor.set(null);
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
            this.descartarYPedirElActual();
            return;
          }
          if (primera) {
            this.mensajes.set(pagina.items);
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
          if (this.activaId() !== conversationId) {
            this.descartarYPedirElActual();
            return;
          }
          this.cargandoHilo.set(false);
          this.hiloCargado.set(true);
          this.error.set('No pudimos cargar la conversación.');
        },
      });
  }

  /**
   * Descarta una respuesta que llegó tarde y pide la conversación que **sí**
   * está abierta ahora.
   *
   * ## El defecto que cierra
   *
   * `cargarHilo()` sale temprano si ya hay una carga en vuelo. Cambiando de
   * chat rápido —o volviendo al anterior antes de que conteste el servidor—
   * pasaba esto: el segundo `abrir()` vaciaba los mensajes y llamaba a
   * `cargarHilo()`, que se iba sin pedir nada porque el primero seguía viajando;
   * y cuando el primero llegaba, se descartaba por ser de otra conversación.
   * Resultado: **el hilo quedaba en blanco** —con la cabecera y la bandeja
   * correctas— hasta que el sondeo lo rescatara treinta segundos después.
   *
   * Lo encontró el navegador, no las unitarias: hace falta una respuesta que
   * tarde entre dos clics para que la carrera exista.
   */
  private descartarYPedirElActual(): void {
    this.cargandoHilo.set(false);
    if (this.activaId() !== null && !this.hiloCargado()) {
      this.cargarHilo(true);
    }
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

  /* --- Editar un mensaje propio (F4.5) ------------------------------------ */

  /**
   * Entra —o sale— del modo edición.
   *
   * Rechaza en silencio el mensaje que ya no se puede editar: entre que se
   * abrió el menú y se eligió «Editar» pudo vencer la ventana, y abrir el
   * composer para que el servidor conteste 422 es peor que no abrirlo.
   */
  editar(mensaje: MensajeDelHilo | null): void {
    if (mensaje === null) {
      this.editando.set(null);
      return;
    }
    if (!editable(mensaje, this.perfil(), Date.now())) {
      return;
    }
    this.respondiendoA.set(null);
    this.editando.set(mensaje);
  }

  /**
   * Guarda el texto nuevo del mensaje que se está editando.
   *
   * Se pinta antes de que el servidor conteste, igual que un envío, y **se
   * revierte** si falla: dejar el texto nuevo en pantalla después de un 422
   * sería mostrar como guardado algo que no se guardó.
   */
  confirmarEdicion(texto: string): void {
    const mensaje = this.editando();
    const propio = this.perfil();
    const conversationId = this.activaId();
    const cuerpo = texto.trim();
    if (
      mensaje === null ||
      mensaje.id === null ||
      propio === null ||
      conversationId === null
    ) {
      return;
    }
    // Sin cambios no se toca nada: un PATCH que deja el texto igual marcaría el
    // mensaje como editado sin que nadie lo haya editado.
    if (cuerpo === '' || cuerpo === (mensaje.bodyText ?? '')) {
      this.editando.set(null);
      return;
    }

    const messageId = mensaje.id;
    const anterior = mensaje.bodyText;
    this.editando.set(null);
    this.aplicarTexto(messageId, cuerpo, true);

    this.community
      .editMessage(conversationId, messageId, {
        senderProfileId: propio,
        bodyText: cuerpo,
      })
      .subscribe({
        next: (editado) => {
          this.aplicarTexto(messageId, editado.bodyText ?? cuerpo, true);
          this.recargarBandeja();
        },
        error: () => {
          this.aplicarTexto(messageId, anterior, mensaje.isEdited ?? false);
          this.error.set('No pudimos editar el mensaje. Pasaron más de 5 minutos o ya no se puede cambiar.');
        },
      });
  }

  /** Cambia el texto de un mensaje ya cargado, y su marca de editado. */
  private aplicarTexto(
    messageId: string,
    bodyText: string | undefined,
    isEdited: boolean,
  ): void {
    this.mensajes.update((lista) =>
      lista.map((m) =>
        m.id === messageId ? { ...m, bodyText, isEdited } : m,
      ),
    );
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
    this.autoReply.marcarActividad();

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

  /**
   * Manda un sticker del pack.
   *
   * Viaja como cualquier adjunto —`MEDIA` con su `attachmentFileId`—, así que
   * no hace falta ningún tipo de mensaje nuevo en el modelo. Lo que lo
   * distingue de una foto es que su id está en el pack, que es del producto y
   * el cliente ya tiene: por eso no se sube nada y no se le piden los bytes al
   * servidor.
   */
  enviarSticker(sticker: Sticker): void {
    const conversationId = this.activaId();
    if (this.perfil() === null || conversationId === null) {
      return;
    }
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId,
      bodyText: '',
      adjunto: {
        fileId: sticker.id,
        nombre: sticker.nombre,
        tipo: 'image/svg+xml',
        vistaPrevia: sticker.url,
      },
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

  /* --- Adjuntos ----------------------------------------------------------- */

  /**
   * El adjunto como `data:` URL, si ya se leyó; `null` si todavía no o falló.
   *
   * Un sticker se resuelve en el acto y sin red: es un archivo del producto,
   * servido con la aplicación, no algo que subió alguien.
   */
  urlDe(fileId: string): string | null {
    const key = this.attachmentKey(fileId);
    return stickerDe(fileId)?.url ?? this.urlesDeArchivo().get(key) ?? null;
  }

  /** `true` si el archivo se pidió y no se pudo leer. */
  adjuntoNoDisponible(fileId: string): boolean {
    return this.urlesDeArchivo().get(this.attachmentKey(fileId)) === null;
  }

  /**
   * Lee los adjuntos que se van a pintar y todavía no están. Una vez por
   * archivo, por sesión de la pantalla.
   *
   * Se usa la ruta contextual de community, con conversación y perfil propio.
   * La ruta genérica de archivos sólo autoriza dueño/revisor y no puede probar
   * que un receptor participa del hilo; usarla acá volvería el UUID la única
   * relación entre la burbuja y sus bytes.
   */
  private resolverAdjuntos(mensajes: readonly MensajeDelHilo[]): void {
    if (!this.isBrowser) {
      return;
    }
    const conversationId = this.activaId();
    const profileId = this.perfil();
    if (conversationId === null || profileId === null) return;
    const yaResueltos = this.urlesDeArchivo();
    for (const mensaje of mensajes) {
      const fileId = mensaje.attachmentFileId;
      const key = fileId ? `${conversationId}:${fileId}` : '';
      // Un sticker no se pide: su URL sale del pack, que viene con la
      // aplicación. Pedirlo sería un 404 por cada sticker de la conversación.
      if (
        fileId === undefined ||
        yaResueltos.has(key) ||
        stickerDe(fileId) !== undefined
      ) {
        continue;
      }
      // Se reserva el lugar antes de pedir, para no pedir dos veces el mismo
      // archivo mientras la primera petición está en vuelo.
      this.urlesDeArchivo.update((mapa) => new Map(mapa).set(key, ''));
      this.community
        .conversationAttachmentDataUrl(conversationId, profileId, fileId)
        .subscribe({
          next: (url) =>
            this.urlesDeArchivo.update((mapa) => new Map(mapa).set(key, url)),
          error: () =>
            this.urlesDeArchivo.update((mapa) => new Map(mapa).set(key, null)),
        });
    }
  }

  /** La caché en memoria no cruza conversaciones. */
  private attachmentKey(fileId: string): string {
    return `${this.activaId() ?? 'sin-conversacion'}:${fileId}`;
  }

  /* --- Respuesta automática por inactividad -------------------------------- */

  /**
   * Contesta sola, si corresponde, al mensaje que acaba de llegar.
   *
   * La regla entera —«hace N minutos que no aparezco, y a esta persona no le
   * avisé en las últimas M horas, y estamos fuera de mi horario»— la decide
   * `ChatAutoReply`; acá sólo se descarta lo que no es un mensaje ajeno y se
   * manda el texto.
   *
   * **Sólo funciona con la aplicación abierta.** Una respuesta automática de
   * verdad la manda el servidor aunque el navegador esté cerrado; eso exige la
   * tabla que el modelo todavía no declara. Está dicho en `ChatAutoReply` y en
   * la pantalla que la configura, para que nadie la confunda con un contestador
   * del servidor.
   */
  private quizasResponderSolo(mensaje: DirectMessage): void {
    const propio = this.perfil();
    if (propio === null || mensaje.senderProfileId === propio) {
      return;
    }
    const ahora = Date.now();
    const ultimo = this.ultimoAvisoPorConversacion.get(mensaje.conversationId) ?? null;
    if (!this.autoReply.corresponde(ahora, ultimo)) {
      return;
    }

    this.ultimoAvisoPorConversacion.set(mensaje.conversationId, ahora);
    const pendiente: MensajePendiente = {
      claveTemporal: claveTemporal(),
      conversationId: mensaje.conversationId,
      bodyText: this.autoReply.configuracion().texto,
      creadoEn: new Date(),
      estado: 'enviando',
    };
    this.pendientes.update((lista) => [...lista, pendiente]);
    this.despachar(pendiente);
  }

  /* --- Descargar la conversación ------------------------------------------ */

  /** `true` mientras se junta la conversación para bajarla. */
  readonly exportando = signal(false);

  /**
   * Junta la conversación entera y la entrega como JSON.
   *
   * ## Por qué recorre todas las páginas
   *
   * Porque bajar «la conversación» y entregar los últimos treinta mensajes
   * sería mentir en el nombre del archivo. Se pide página por página con el
   * mismo cursor del hilo, hasta que el servidor deja de dar más.
   *
   * ## Qué lleva y qué no
   *
   * Lleva el texto, quién lo escribió, cuándo, si fue editado, a qué mensaje
   * respondía y **la referencia** de cada adjunto. No lleva los bytes de los
   * adjuntos: un chat con tres radiografías daría un archivo de decenas de
   * megas que nadie puede abrir en un editor de texto, y las referencias
   * alcanzan para volver a pedirlos.
   *
   * @param alTerminar - Recibe el JSON ya armado, o `null` si algo falló.
   */
  exportarConversacion(alTerminar: (json: string | null) => void): void {
    const propio = this.perfil();
    const conversationId = this.activaId();
    const conversacion = this.conversacionActiva();
    if (propio === null || conversationId === null || this.exportando()) {
      alTerminar(null);
      return;
    }

    this.exportando.set(true);
    const juntados: DirectMessage[] = [];

    const pedir = (cursor: string | null): void => {
      this.community
        .listMessages(conversationId, {
          profileId: propio,
          limit: PAGINA_DE_MENSAJES,
          ...(cursor === null ? {} : { cursor }),
        })
        .subscribe({
          next: (pagina) => {
            juntados.push(...pagina.items);
            if (pagina.nextCursor !== null) {
              pedir(pagina.nextCursor);
              return;
            }
            this.exportando.set(false);
            alTerminar(
              JSON.stringify(
                armarExportacion(conversationId, propio, conversacion, juntados),
                null,
                2,
              ),
            );
          },
          error: () => {
            this.exportando.set(false);
            this.error.set('No pudimos descargar la conversación.');
            alTerminar(null);
          },
        });
    };

    pedir(null);
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
              this.peerReadUpTo.set(pagina.peerReadUpTo ?? null);
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

/**
 * La conversación lista para escribirse en un archivo.
 *
 * Es el formato del archivo que baja la persona, así que se declara acá y no se
 * arma al vuelo: alguien lo va a abrir, y los nombres de sus claves son parte
 * de lo que entregamos.
 */
export interface ConversacionExportada {
  /** Qué es este archivo, para quien lo abra sin contexto. */
  readonly formato: 'alovida.conversacion';
  readonly version: 1;
  readonly exportadoEn: string;
  readonly conversacion: {
    readonly id: string;
    readonly esGrupo: boolean;
    readonly participantes: readonly {
      readonly profileId: string;
      readonly nombre: string;
      readonly soyYo: boolean;
    }[];
  };
  readonly mensajes: readonly {
    readonly id: string;
    readonly autorProfileId: string;
    readonly autor: string;
    readonly propio: boolean;
    readonly texto: string | null;
    readonly enviadoEn: string | null;
    readonly editado: boolean;
    readonly respondeA: string | null;
    readonly adjunto: { readonly fileId: string; readonly sticker: string | null } | null;
  }[];
}

function armarExportacion(
  conversationId: string,
  propio: string,
  conversacion: ConversationListItem | undefined,
  mensajes: readonly DirectMessage[],
): ConversacionExportada {
  const nombrePorPerfil = new Map<string, string>(
    (conversacion?.peers ?? []).map((peer) => [
      peer.profileId,
      peer.displayName ?? 'Alguien',
    ]),
  );

  return {
    formato: 'alovida.conversacion',
    version: 1,
    exportadoEn: new Date().toISOString(),
    conversacion: {
      id: conversationId,
      esGrupo: (conversacion?.peers.length ?? 0) > 1,
      participantes: [
        { profileId: propio, nombre: 'Yo', soyYo: true },
        ...(conversacion?.peers ?? []).map((peer) => ({
          profileId: peer.profileId,
          nombre: peer.displayName ?? 'Alguien',
          soyYo: false,
        })),
      ],
    },
    // Del más viejo al más nuevo: se lee como la conversación, no como la
    // devuelve el contrato —que pagina hacia atrás—.
    mensajes: [...mensajes]
      .sort((a, b) => (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0))
      .map((mensaje) => ({
        id: mensaje.id,
        autorProfileId: mensaje.senderProfileId,
        autor:
          mensaje.senderProfileId === propio
            ? 'Yo'
            : (nombrePorPerfil.get(mensaje.senderProfileId) ?? 'Alguien'),
        propio: mensaje.senderProfileId === propio,
        texto: mensaje.bodyText ?? null,
        enviadoEn: mensaje.sentAt?.toISOString() ?? null,
        editado: mensaje.isEdited === true,
        respondeA: mensaje.replyToMessageId ?? null,
        adjunto:
          mensaje.attachmentFileId === undefined
            ? null
            : {
                fileId: mensaje.attachmentFileId,
                sticker: stickerDe(mensaje.attachmentFileId)?.nombre ?? null,
              },
      })),
  };
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
