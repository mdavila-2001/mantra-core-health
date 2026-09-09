import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, type Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '../data-access/api';
import { SessionStore } from '../auth/session.store';
import type {
  DirectMessage,
  ProfilePresence,
} from '../data-access/community/community.types';

/** Empujado al enviar un mensaje (`conversation:message`). */
export type ChatMessageEvent = DirectMessage;

/** Cada cuánto se renueva el «en línea» mientras el socket vive (F4.2). */
const PING_DE_PRESENCIA_MS = 25_000;

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

/** El mensaje del cable, con sus fechas ya convertidas y sin nulos. */
function aMensaje(payload: MensajeDelCable): ChatMessageEvent {
  const { sentAt, deletedAt, ...resto } = payload;
  const limpio = Object.fromEntries(
    Object.entries(resto).filter(([, valor]) => valor !== null),
  ) as Omit<DirectMessage, 'sentAt' | 'deletedAt'>;
  const fechaEnvio = aFecha(sentAt);
  const fechaBaja = aFecha(deletedAt);
  return {
    ...limpio,
    ...(fechaEnvio === undefined ? {} : { sentAt: fechaEnvio }),
    ...(fechaBaja === undefined ? {} : { deletedAt: fechaBaja }),
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

/** Alguien está escribiendo, o dejó de hacerlo (`conversation:typing`, F4.1). */
export interface ChatTypingEvent {
  readonly conversationId: string;
  readonly profileId: string;
  readonly typing: boolean;
}

/** Alguien entró o salió de la mensajería (`profile:presence`, F4.2). */
export type ChatPresenceEvent = ProfilePresence;

/** Un mensaje se eliminó (`conversation:message:deleted`, F4.5). */
export interface ChatMessageDeletedEvent {
  readonly conversationId: string;
  readonly messageId: string;
  readonly deletedAt?: Date;
}

/** Cambió el mensaje fijado (`conversation:pinned`, F4.6). */
export interface ChatPinnedEvent {
  readonly conversationId: string;
  readonly pinnedMessageId: string | null;
}

/**
 * Cliente del gateway WS de mensajería (`CommunityMessagingGateway`, backend).
 *
 * Un solo socket compartido para toda la mensajería: el `ChatStore` se
 * suscribe a los streams y decide qué le importa. El socket es **aditivo** al
 * sondeo — no lo reemplaza, es la red de seguridad si el socket se cae.
 *
 * Lo único que manda hacia el servidor, además de unirse a las salas, son las
 * dos cosas que no se persisten (F4): `typing` y el ping de presencia. Enviar,
 * editar, borrar, fijar y marcar leído siguen siendo REST (`CommunityClient`);
 * el backend emite los eventos después de cada uno.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(SessionStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private socket: Socket | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;

  readonly connected = signal(false);

  private readonly messages$ = new Subject<ChatMessageEvent>();
  private readonly updates$ = new Subject<ChatMessageEvent>();
  private readonly deletions$ = new Subject<ChatMessageDeletedEvent>();
  private readonly reads$ = new Subject<ChatReadEvent>();
  private readonly newConversations$ = new Subject<ChatNewConversationEvent>();
  private readonly typing$ = new Subject<ChatTypingEvent>();
  private readonly presence$ = new Subject<ChatPresenceEvent>();
  private readonly pinned$ = new Subject<ChatPinnedEvent>();

  /** `conversation:message`, sin filtrar — el store filtra lo suyo. */
  readonly onMessage = this.messages$.asObservable();
  /** `conversation:message:updated` (F4.5). */
  readonly onMessageUpdated = this.updates$.asObservable();
  /** `conversation:message:deleted` (F4.5). */
  readonly onMessageDeleted = this.deletions$.asObservable();
  /** `conversation:read`. */
  readonly onRead = this.reads$.asObservable();
  /** `conversation:new`. */
  readonly onNewConversation = this.newConversations$.asObservable();
  /** `conversation:typing` (F4.1). */
  readonly onTyping = this.typing$.asObservable();
  /** `profile:presence` (F4.2). */
  readonly onPresence = this.presence$.asObservable();
  /** `conversation:pinned` (F4.6). */
  readonly onPinned = this.pinned$.asObservable();

  /**
   * Conecta si hace falta y devuelve el socket. Bajo SSR no hace nada — un
   * socket abierto en el servidor no tiene a quién avisarle nada.
   */
  private ensureConnected(): Socket | null {
    if (!this.isBrowser) {
      return null;
    }
    const token = this.session.accessToken();
    if (token === null) {
      return null;
    }
    if (this.socket?.connected) {
      return this.socket;
    }
    if (this.socket) {
      this.socket.disconnect();
    }

    const socket =
      this.baseUrl === ''
        ? io({ auth: { token }, transports: ['websocket'] })
        : io(this.baseUrl, { auth: { token }, transports: ['websocket'] });

    socket.on('connect', () => {
      this.connected.set(true);
      this.arrancarPing();
    });
    socket.on('disconnect', () => {
      this.connected.set(false);
      this.pararPing();
    });
    socket.on('conversation:message', (payload: MensajeDelCable) =>
      this.messages$.next(aMensaje(payload)),
    );
    socket.on('conversation:message:updated', (payload: MensajeDelCable) =>
      this.updates$.next(aMensaje(payload)),
    );
    socket.on(
      'conversation:message:deleted',
      (payload: { conversationId: string; messageId: string; deletedAt?: string | null }) =>
        this.deletions$.next({
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          ...(aFecha(payload.deletedAt) === undefined
            ? {}
            : { deletedAt: aFecha(payload.deletedAt) }),
        }),
    );
    socket.on('conversation:read', (payload: ChatReadEvent) =>
      this.reads$.next(payload),
    );
    socket.on('conversation:new', (payload: ChatNewConversationEvent) =>
      this.newConversations$.next(payload),
    );
    socket.on('conversation:typing', (payload: ChatTypingEvent) =>
      this.typing$.next({ ...payload, typing: payload.typing !== false }),
    );
    socket.on(
      'profile:presence',
      (payload: { profileId: string; online: boolean; lastSeenAt?: string | null }) =>
        this.presence$.next({
          profileId: payload.profileId,
          online: payload.online === true,
          ...(aFecha(payload.lastSeenAt) === undefined
            ? {}
            : { lastSeenAt: aFecha(payload.lastSeenAt) }),
        }),
    );
    socket.on('conversation:pinned', (payload: ChatPinnedEvent) =>
      this.pinned$.next(payload),
    );

    this.socket = socket;
    return socket;
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
  leaveConversation(conversationId: string, profileId?: string): void {
    this.socket?.emit('leave:conversation', {
      conversationId,
      ...(profileId === undefined ? {} : { profileId }),
    });
  }

  /** Avisa que se está escribiendo (o que se dejó) en el hilo abierto (F4.1). */
  typing(conversationId: string, profileId: string, typing: boolean): void {
    this.socket?.emit('typing', { conversationId, profileId, typing });
  }

  /**
   * Renueva el «en línea» cada 25 s mientras el socket vive: el backend lo
   * deja caducar a los 60 s, así una pestaña que murió sin despedirse deja
   * de figurar en línea sola.
   */
  private arrancarPing(): void {
    this.pararPing();
    this.ping = setInterval(() => {
      this.socket?.emit('presence:ping');
    }, PING_DE_PRESENCIA_MS);
  }

  private pararPing(): void {
    if (this.ping !== null) {
      clearInterval(this.ping);
      this.ping = null;
    }
  }
}
