import { inject, Injectable, InjectionToken, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, type Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { API_BASE_URL } from '../data-access/api';
import { SessionStore } from '../auth/session.store';
import type { DirectMessage } from '../data-access/community/community.types';

/** Empujado al enviar un mensaje (`conversation:message`). */
export type ChatMessageEvent = DirectMessage;

/**
 * El mensaje **como viaja por el cable**: las fechas son texto ISO.
 *
 * Es la distinción que faltaba. `DirectMessage.sentAt` es un `Date` porque
 * `CommunityClient` lo convierte al mapear la respuesta HTTP; el socket
 * entregaba el JSON crudo con un `as ChatMessageEvent` y nadie convertía nada,
 * así que la fecha llegaba como `string` con tipo de `Date`.
 *
 * No era teoría: `Thread.leido()` hace `mensaje.sentAt.getTime()`, y cada
 * mensaje que entraba en vivo tiraba `sentAt.getTime is not a function` en cada
 * ciclo de detección de cambios — el hilo quedaba inutilizable hasta recargar.
 */
interface MensajeDelCable extends Omit<DirectMessage, 'sentAt'> {
  readonly sentAt?: string | Date | null;
}

/** Una fecha del cable, o `undefined`. Tolera que ya venga convertida. */
function aFecha(valor: string | Date | null | undefined): Date | undefined {
  if (valor === null || valor === undefined) {
    return undefined;
  }
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

/** El mensaje del cable, con sus fechas ya convertidas. */
function aMensaje(payload: MensajeDelCable): ChatMessageEvent {
  return { ...payload, sentAt: aFecha(payload.sentAt) };
}

/** Empujado al marcar leído (`conversation:read`). */
export interface ChatReadEvent {
  readonly conversationId: string;
  readonly profileId: string;
  readonly lastReadMessageId: string;
}

/** Empujado cuando nace una conversación nueva (`conversation:new`). */
export interface ChatNewConversationEvent {
  readonly conversationId: string;
  readonly peerProfileId: string;
}

/**
 * El gateway rechazó lo que se le pidió (`error`).
 *
 * `NOT_OWN_PROFILE` dice que la sesión no puede actuar con ese perfil: no es
 * el propio ni la vitrina de una organización donde tenga membresía activa.
 * Con `event: 'membership:recheck'` significa que **lo podía y dejó de
 * poder** —le quitaron la membresía con el socket abierto— y trae el perfil.
 */
export interface ChatSocketError {
  readonly code: string;
  readonly event?: string;
  readonly profileId?: string;
}

/**
 * Lo mínimo del socket que usa el servicio. Existe para que las pruebas puedan
 * darle uno falso sin levantar un gateway.
 */
export type SocketDeChat = Pick<Socket, 'on' | 'emit' | 'disconnect' | 'connected' | 'active'>;

/**
 * Lo que socket.io pide antes de **cada** handshake —el primero y cada
 * reconexión— para autenticarse.
 *
 * Una función y no un `{ token }` fijo: el socket que se conserva `active`
 * reconecta solo, y con un objeto estático reintentaba para siempre con el
 * token del momento en que se abrió, que después de rotar ya no sirve. Así
 * cada intento lee el token vigente de la sesión.
 */
export type AuthDeSocket = (cb: (datos: { token: string | null }) => void) => void;

/** Abre un socket que se autentica con `auth`, o `null` si no hay a quién llamar. */
export type FabricaDeSocket = (auth: AuthDeSocket) => SocketDeChat | null;

/**
 * Cómo se abre el socket. Dos situaciones en las que **no** se abre, por el
 * mismo motivo: no hay a quién llamar.
 *
 * - **Bajo SSR**, porque un socket abierto en el servidor no tiene a quién
 *   avisarle nada.
 * - **Sobre la maqueta** (`mockBackend`), porque ahí no hay ninguna API: un
 *   interceptor contesta las peticiones HTTP dentro de Angular, y no hay
 *   pasarela de tiempo real que pueda contestar un handshake. Intentarlo
 *   dejaba un `WebSocket connection … failed` en la consola de toda pantalla
 *   que abre el chat o el centro de avisos.
 */
export const FABRICA_DE_SOCKET = new InjectionToken<FabricaDeSocket>('FABRICA_DE_SOCKET', {
  providedIn: 'root',
  factory: () => {
    const baseUrl = inject(API_BASE_URL);
    const enNavegador = isPlatformBrowser(inject(PLATFORM_ID));
    return (auth) => {
      if (!enNavegador || environment.mockBackend) {
        return null;
      }
      return baseUrl === ''
        ? io({ auth, transports: ['websocket'] })
        : io(baseUrl, { auth, transports: ['websocket'] });
    };
  },
});

/**
 * Cliente del gateway WS de mensajería (`CommunityMessagingGateway`, backend).
 *
 * Un solo socket compartido entre la bandeja (`Messaging`) y el hilo
 * (`Thread`): las dos pantallas se suscriben a los mismos streams y deciden
 * cada una qué le importa. El socket es **aditivo** al sondeo — no lo
 * reemplaza, es la red de seguridad si el socket se cae.
 *
 * Sólo empuja: no manda `message:send` ni `read` por acá. Enviar y marcar
 * leído siguen siendo el `POST` de siempre (`CommunityClient`).
 *
 * ## Las salas se recuerdan, no se mandan a ciegas
 *
 * El servicio guarda **a qué bandeja y a qué hilo** tiene que estar unido, y
 * manda los `join:*` en cada `connect` —el primero y cada reconexión—. Antes
 * los mandaba en el momento, y dos cosas se perdían: un socket que todavía
 * estaba en el handshake se tiraba y se abría otro (y con él el `join:inbox`
 * que había quedado en el búfer, justo después de `actuarComo`), y una
 * reconexión del transporte volvía sin salas: el servidor no las recuerda.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly session = inject(SessionStore);
  private readonly fabrica = inject(FABRICA_DE_SOCKET);

  private socket: SocketDeChat | null = null;

  /** La bandeja a la que hay que estar unido, si alguna. */
  private bandeja: string | null = null;
  /** El hilo abierto al que hay que estar unido, si alguno. */
  private hilo: { readonly conversationId: string; readonly profileId: string } | null = null;

  readonly connected = signal(false);

  private readonly messages$ = new Subject<ChatMessageEvent>();
  private readonly reads$ = new Subject<ChatReadEvent>();
  private readonly newConversations$ = new Subject<ChatNewConversationEvent>();
  private readonly updated$ = new Subject<ChatMessageEvent>();
  private readonly errors$ = new Subject<ChatSocketError>();

  /** `conversation:message`, sin filtrar — cada pantalla filtra lo suyo. */
  readonly onMessage = this.messages$.asObservable();
  /**
   * `conversation:message:updated` — alguien editó un mensaje suyo (F4.5).
   *
   * Trae el mensaje entero, con el mismo cuerpo que `conversation:message`, así
   * que se convierte con la misma función: sin eso la fecha llegaría como texto
   * con tipo de `Date`, que es el defecto que ya costó una vez el hilo entero.
   */
  readonly onMessageUpdated = this.updated$.asObservable();
  /** `conversation:read`. */
  readonly onRead = this.reads$.asObservable();
  /** `conversation:new`. */
  readonly onNewConversation = this.newConversations$.asObservable();
  /** `error` del gateway — hoy, sobre todo, `NOT_OWN_PROFILE`. */
  readonly onError = this.errors$.asObservable();

  /**
   * Devuelve el socket, abriéndolo si hace falta.
   *
   * Uno que todavía está conectándose (`active` sin `connected`) **sirve**: se
   * conserva. Tirarlo para abrir otro era perder el handshake en curso y lo
   * que se había pedido en él.
   */
  private ensureConnected(): SocketDeChat | null {
    if (this.socket !== null && (this.socket.connected || this.socket.active)) {
      return this.socket;
    }
    if (this.session.accessToken() === null) {
      return null;
    }
    this.socket?.disconnect();
    this.socket = null;

    // El token se lee en cada handshake, no al abrir: ver `AuthDeSocket`.
    const fijo = this.session.accessToken();
    const socket = this.fabrica((cb) => cb({ token: fijo }));
    if (socket === null) {
      return null;
    }

    socket.on('connect', () => {
      this.connected.set(true);
      this.unirseALasSalas(socket);
    });
    socket.on('disconnect', () => this.connected.set(false));
    socket.on('conversation:message', (payload: MensajeDelCable) =>
      this.messages$.next(aMensaje(payload)),
    );
    socket.on('conversation:message:updated', (payload: MensajeDelCable) =>
      this.updated$.next(aMensaje(payload)),
    );
    socket.on('conversation:read', (payload: ChatReadEvent) =>
      this.reads$.next(payload),
    );
    socket.on('conversation:new', (payload: ChatNewConversationEvent) =>
      this.newConversations$.next(payload),
    );
    socket.on('error', (payload: ChatSocketError | null | undefined) => {
      if (payload !== null && typeof payload === 'object' && typeof payload.code === 'string') {
        this.errors$.next(payload);
      }
    });

    this.socket = socket;
    return socket;
  }

  /** Manda los `join:*` de lo que hoy corresponde. En cada `connect`. */
  private unirseALasSalas(socket: SocketDeChat): void {
    if (this.bandeja !== null) {
      socket.emit('join:inbox', { profileId: this.bandeja });
    }
    if (this.hilo !== null) {
      socket.emit('join:conversation', { ...this.hilo });
    }
  }

  /** Se une a la bandeja de un perfil: recibe `conversation:*` de todas sus conversaciones. */
  joinInbox(profileId: string): void {
    this.bandeja = profileId;
    const socket = this.ensureConnected();
    // Desconectado, el `connect` lo manda: emitirlo también acá lo duplicaría
    // al vaciarse el búfer.
    if (socket?.connected) {
      socket.emit('join:inbox', { profileId });
    }
  }

  /** Se une al hilo abierto de una conversación. */
  joinConversation(conversationId: string, profileId: string): void {
    this.hilo = { conversationId, profileId };
    const socket = this.ensureConnected();
    if (socket?.connected) {
      socket.emit('join:conversation', { conversationId, profileId });
    }
  }

  /**
   * Corta la conexión para que el próximo `join:*` abra una nueva, y olvida
   * las salas.
   *
   * Es lo que se hace al cambiar el perfil con el que se actúa: el gateway no
   * tiene `leave:inbox`, y seguir en la sala del perfil anterior sería recibir
   * los mensajes de una bandeja que ya no se está mirando.
   */
  reiniciar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.bandeja = null;
    this.hilo = null;
    this.connected.set(false);
  }

  /** Deja el hilo. No hace falta al salir de la bandeja: `join:inbox` no expira. */
  leaveConversation(conversationId: string): void {
    if (this.hilo?.conversationId === conversationId) {
      this.hilo = null;
    }
    if (this.socket?.connected) {
      this.socket.emit('leave:conversation', { conversationId });
    }
  }
}
