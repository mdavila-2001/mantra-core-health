import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, type Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '../data-access/api';
import { SessionStore } from '../auth/session.store';
import type { DirectMessage } from '../data-access/community/community.types';

/** Empujado al enviar un mensaje (`conversation:message`). */
export type ChatMessageEvent = DirectMessage;

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

  /** `conversation:message`, sin filtrar — cada pantalla filtra lo suyo. */
  readonly onMessage = this.messages$.asObservable();
  /** `conversation:read`. */
  readonly onRead = this.reads$.asObservable();
  /** `conversation:new`. */
  readonly onNewConversation = this.newConversations$.asObservable();

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

    socket.on('connect', () => this.connected.set(true));
    socket.on('disconnect', () => this.connected.set(false));
    socket.on('conversation:message', (payload: ChatMessageEvent) =>
      this.messages$.next(payload),
    );
    socket.on('conversation:read', (payload: ChatReadEvent) =>
      this.reads$.next(payload),
    );
    socket.on('conversation:new', (payload: ChatNewConversationEvent) =>
      this.newConversations$.next(payload),
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
  leaveConversation(conversationId: string): void {
    this.socket?.emit('leave:conversation', { conversationId });
  }
}
