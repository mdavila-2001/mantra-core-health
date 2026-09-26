import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
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
interface MensajeDelCable extends Omit<DirectMessage, 'sentAt' | 'deletedAt'> {
  readonly sentAt?: string | Date | null;
  readonly deletedAt?: string | Date | null;
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
  return {
    ...payload,
    sentAt: aFecha(payload.sentAt),
    deletedAt: aFecha(payload.deletedAt),
  };
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

/** F4.1 · alguien está escribiendo (o dejó de hacerlo) en un hilo. */
export interface ChatTypingEvent {
  readonly conversationId: string;
  readonly profileId: string;
  readonly typing: boolean;
}

/** F4.2 · un perfil entró o salió de la mensajería. */
export interface ChatPresenceEvent {
  readonly profileId: string;
  readonly online: boolean;
  readonly lastSeenAt: Date | null;
}

/** F4.5 · un mensaje se eliminó (`conversation:message:deleted`). */
export interface ChatMessageDeletedEvent {
  readonly conversationId: string;
  readonly messageId: string;
  readonly deletedAt: Date;
}

/**
 * Cliente del gateway WS de mensajería (`CommunityMessagingGateway`, backend).
 *
 * Un solo socket compartido entre la bandeja (`Messaging`) y el hilo
 * (`Thread`): las dos pantallas se suscriben a los mismos streams y deciden
 * cada una qué le importa. El socket es **aditivo** al sondeo que ya existía
 * (`SONDEO_MS` en cada pantalla) — no lo reemplaza, es la red de seguridad si
 * el socket se cae.
 *
 * Sólo empuja: no manda `message:send` ni `read` por acá. Enviar y marcar
 * leído siguen siendo el `POST` de siempre (`CommunityClient`); el backend
 * emite estos tres eventos después de cada uno de esos `POST`.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(SessionStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private socket: Socket | null = null;

  readonly connected = signal(false);

  private readonly messages$ = new Subject<ChatMessageEvent>();
  private readonly reads$ = new Subject<ChatReadEvent>();
  private readonly newConversations$ = new Subject<ChatNewConversationEvent>();
  private readonly updated$ = new Subject<ChatMessageEvent>();
  private readonly typing$ = new Subject<ChatTypingEvent>();
  private readonly presence$ = new Subject<ChatPresenceEvent>();
  private readonly deleted$ = new Subject<ChatMessageDeletedEvent>();

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
  /** `conversation:typing` (F4.1, AG-19). */
  readonly onTyping = this.typing$.asObservable();
  /** `profile:presence` (F4.2, AG-19). */
  readonly onPresence = this.presence$.asObservable();
  /** `conversation:message:deleted` (F4.5, AG-19/AG-20). */
  readonly onMessageDeleted = this.deleted$.asObservable();

  constructor() {
    // TX-17 (cierre de sesión): un socket que sigue vivo después de un logout
    // no tiene a quién avisarle nada, y mantenerlo abierto es la misma clase
    // de fuga que un `setInterval` sin `clearInterval`. `ensureConnected()` ya
    // exige `accessToken() !== null` para abrir uno nuevo; esto cierra el que
    // ya estaba abierto en el momento en que la sesión termina.
    effect(() => {
      if (!this.session.isAuthenticated() && this.socket) {
        this.disconnect();
      }
    });
  }

  /**
   * Conecta si hace falta y devuelve el socket.
   *
   * Dos situaciones en las que **no** se marca, por el mismo motivo: no hay a
   * quién llamar.
   *
   * - **Bajo SSR**, porque un socket abierto en el servidor no tiene a quién
   *   avisarle nada.
   * - **Sobre la maqueta** (`mockBackend`), porque ahí no hay ninguna API: un
   *   interceptor contesta las peticiones HTTP dentro de Angular, y no hay
   *   pasarela de tiempo real que pueda contestar un handshake. Intentarlo
   *   dejaba un `WebSocket connection … failed` en la consola de toda pantalla
   *   que abre el chat o el centro de avisos —lo destapó el barrido de rutas,
   *   que trata un error de consola como un defecto de la pantalla, y con
   *   razón: es lo que ve cualquiera que abra las herramientas del navegador.
   */
  private ensureConnected(): Socket | null {
    if (!this.isBrowser || environment.mockBackend) {
      return null;
    }
    if (this.session.accessToken() === null) {
      return null;
    }
    if (this.socket?.connected) {
      return this.socket;
    }
    if (this.socket) {
      this.socket.disconnect();
    }

    // TX-17: `auth` como FUNCIÓN, no como objeto congelado en el momento de
    // conectar. Socket.io la vuelve a invocar en cada intento de reconexión
    // (`socket.io-client` llama `auth(cb)` antes de cada handshake), así que
    // un chat abierto más de 15 minutos reconecta con el access token
    // **vigente** y no con el que había cuando se abrió la pestaña — que para
    // entonces ya venció. Con `{ auth: { token } }` (objeto) el valor queda
    // fijo para siempre: exactamente el bug que reportaba TX-17.
    const opciones = {
      auth: (cb: (data: { token: string | null }) => void) =>
        cb({ token: this.session.accessToken() }),
      transports: ['websocket'] as 'websocket'[],
    };
    const socket =
      this.baseUrl === '' ? io(opciones) : io(this.baseUrl, opciones);

    socket.on('connect', () => this.connected.set(true));
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
    // F4.1/F4.2/F4.5 (AG-19, AG-20): el gateway ya los emite
    // (`community-messaging.gateway.ts`); hasta acá nadie los escuchaba.
    socket.on('conversation:typing', (payload: ChatTypingEvent) =>
      this.typing$.next(payload),
    );
    socket.on(
      'profile:presence',
      (payload: Omit<ChatPresenceEvent, 'lastSeenAt'> & { lastSeenAt: string | null }) =>
        this.presence$.next({
          ...payload,
          lastSeenAt: aFecha(payload.lastSeenAt) ?? null,
        }),
    );
    socket.on(
      'conversation:message:deleted',
      (payload: Omit<ChatMessageDeletedEvent, 'deletedAt'> & { deletedAt: string }) => {
        const deletedAt = aFecha(payload.deletedAt);
        if (deletedAt) this.deleted$.next({ ...payload, deletedAt });
      },
    );

    this.socket = socket;
    return socket;
  }

  /** F4.1 · avisa que este perfil está (o dejó de estar) escribiendo en el hilo. */
  typing(conversationId: string, profileId: string, typing: boolean): void {
    this.ensureConnected()?.emit('typing', { conversationId, profileId, typing });
  }

  /** F4.2 · renueva el «en línea» de este perfil ante el servidor. */
  presencePing(profileId: string): void {
    this.ensureConnected()?.emit('presence:ping', { profileId });
  }

  /** Cierra el socket, si había uno. Se llama sola al cerrar sesión. */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  /** Se une a la bandeja de un perfil: recibe `conversation:*` de todas sus conversaciones. */
  joinInbox(profileId: string): void {
    this.ensureConnected()?.emit('join:inbox', { profileId });
  }

  /** Se une al hilo abierto de una conversación. */
  joinConversation(conversationId: string, profileId: string): void {
    this.ensureConnected()?.emit('join:conversation', {
      conversationId,
      profileId,
    });
  }

  /** Deja el hilo. No hace falta al salir de la bandeja: `join:inbox` no expira. */
  leaveConversation(conversationId: string): void {
    this.socket?.emit('leave:conversation', { conversationId });
  }
}
