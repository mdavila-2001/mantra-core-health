import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import {
  ChatSocketService,
  FABRICA_DE_SOCKET,
  type AuthDeSocket,
  type SocketDeChat,
} from './chat-socket.service';

/** Un socket de mentira: guarda lo emitido y deja disparar sus eventos. */
class SocketFalso {
  connected = false;
  active = true;
  readonly emitidos: [string, unknown][] = [];
  private readonly oyentes = new Map<string, ((payload?: unknown) => void)[]>();
  desconectado = false;

  on(evento: string, oyente: (payload?: unknown) => void): this {
    this.oyentes.set(evento, [...(this.oyentes.get(evento) ?? []), oyente]);
    return this;
  }

  emit(evento: string, payload: unknown): this {
    this.emitidos.push([evento, payload]);
    return this;
  }

  disconnect(): this {
    this.desconectado = true;
    this.connected = false;
    this.active = false;
    return this;
  }

  /** El handshake (o una reconexión) terminó. */
  conectar(): void {
    this.connected = true;
    this.active = true;
    this.oyentes.get('connect')?.forEach((o) => o());
  }

  /** Se cayó el transporte; socket.io reintenta solo (`active` sigue). */
  caer(): void {
    this.connected = false;
    this.oyentes.get('disconnect')?.forEach((o) => o('transport close'));
  }
}

/**
 * M9. Lo que fijan: que un socket que todavía está en el handshake **no** se
 * tira (se perdía el `join:inbox` en búfer justo después de `actuarComo`), y
 * que cada `connect` —el primero y cada reconexión— vuelve a unir la bandeja y
 * el hilo abierto de la identidad vigente.
 */
describe('ChatSocketService', () => {
  let creados: SocketFalso[];
  let auths: AuthDeSocket[];
  let servicio: ChatSocketService;
  const token = signal<string | null>('tok');

  beforeEach(() => {
    creados = [];
    auths = [];
    token.set('tok');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionStore,
          useValue: { accessToken: token, isAuthenticated: computed(() => token() !== null) },
        },
        {
          provide: FABRICA_DE_SOCKET,
          useValue: (auth: AuthDeSocket) => {
            const socket = new SocketFalso();
            creados.push(socket);
            auths.push(auth);
            return socket as unknown as SocketDeChat;
          },
        },
      ],
    });
    servicio = TestBed.inject(ChatSocketService);
  });

  it('un socket que se está conectando sirve: no se tira ni se abre otro', () => {
    servicio.joinInbox('pp-1');
    servicio.joinConversation('c-1', 'pp-1');
    expect(creados).toHaveLength(1);
    expect(creados[0]!.desconectado).toBe(false);
  });

  it('tras reiniciar (actuarComo), el join de la identidad nueva sale al conectar, una sola vez', () => {
    servicio.joinInbox('pp-1');
    servicio.reiniciar();
    servicio.joinInbox('pp-farmacia');
    servicio.joinInbox('pp-farmacia');
    expect(creados).toHaveLength(2);
    expect(creados[0]!.desconectado).toBe(true);

    const nuevo = creados[1]!;
    expect(nuevo.emitidos).toEqual([]);
    nuevo.conectar();
    expect(nuevo.emitidos).toEqual([['join:inbox', { profileId: 'pp-farmacia' }]]);
  });

  it('una reconexión vuelve a unir la bandeja y el hilo abierto', () => {
    servicio.joinInbox('pp-1');
    const socket = creados[0]!;
    socket.conectar();
    servicio.joinConversation('c-1', 'pp-1');
    expect(socket.emitidos).toEqual([
      ['join:inbox', { profileId: 'pp-1' }],
      ['join:conversation', { conversationId: 'c-1', profileId: 'pp-1' }],
    ]);

    socket.caer();
    expect(servicio.connected()).toBe(false);
    socket.emitidos.length = 0;
    socket.conectar();
    expect(socket.emitidos).toEqual([
      ['join:inbox', { profileId: 'pp-1' }],
      ['join:conversation', { conversationId: 'c-1', profileId: 'pp-1' }],
    ]);
    expect(creados).toHaveLength(1);
  });

  it('dejar el hilo hace que la reconexión ya no lo una', () => {
    servicio.joinInbox('pp-1');
    const socket = creados[0]!;
    socket.conectar();
    servicio.joinConversation('c-1', 'pp-1');
    servicio.leaveConversation('c-1');
    socket.caer();
    socket.emitidos.length = 0;
    socket.conectar();
    expect(socket.emitidos).toEqual([['join:inbox', { profileId: 'pp-1' }]]);
  });

  it('L-3 · cada handshake se autentica con el token vigente: rotarlo no deja al socket reintentando con el viejo', () => {
    servicio.joinInbox('pp-1');
    const socket = creados[0]!;
    socket.conectar();
    const leido = (): string | null => {
      let visto: string | null = 'sin-llamar';
      auths[0]!((datos) => {
        visto = datos.token;
      });
      return visto;
    };
    expect(leido()).toBe('tok');

    // El refresco rota el token con el socket vivo; socket.io reconecta solo
    // y vuelve a pedir `auth` antes del handshake.
    token.set('tok-rotado');
    socket.caer();
    expect(leido()).toBe('tok-rotado');
    expect(creados).toHaveLength(1);
  });

  it('TX-17 · al cerrar sesión se cierra el socket y se olvidan las salas', () => {
    servicio.joinInbox('pp-1');
    const socket = creados[0]!;
    socket.conectar();

    token.set(null);
    TestBed.tick();
    expect(socket.desconectado).toBe(true);
    expect(servicio.connected()).toBe(false);

    // Otra sesión en la misma pestaña no hereda la bandeja anterior.
    token.set('tok-2');
    servicio.joinConversation('c-9', 'pp-2');
    creados[1]!.conectar();
    expect(creados[1]!.emitidos).toEqual([
      ['join:conversation', { conversationId: 'c-9', profileId: 'pp-2' }],
    ]);
  });
});
