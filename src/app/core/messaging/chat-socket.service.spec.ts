import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { ChatSocketService, FABRICA_DE_SOCKET, type SocketDeChat } from './chat-socket.service';

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
  let servicio: ChatSocketService;

  beforeEach(() => {
    creados = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: { accessToken: signal('tok') } },
        {
          provide: FABRICA_DE_SOCKET,
          useValue: () => {
            const socket = new SocketFalso();
            creados.push(socket);
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
});
