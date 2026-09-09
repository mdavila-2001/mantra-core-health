import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Subject } from 'rxjs';

import { ChatStore } from './chat.store';
import { ChatSocketService } from './chat-socket.service';

/**
 * Lo que estas pruebas fijan.
 *
 * El store es lo que hace que el chat sea **una sola pantalla**: si dos veces
 * la misma noticia duplica una burbuja, si un envío en vuelo desaparece al
 * llegar el acuse, o si abrir un hilo vuelve a pedir la bandeja, el chat deja
 * de comportarse como un chat aunque las pantallas se vean bien.
 */
describe('ChatStore', () => {
  let store: ChatStore;
  let http: HttpTestingController;

  const perfilPropio = {
    id: 'pp-1',
    tenantId: 't-1',
    targetId: 'hp-1',
    slug: 'juan-paciente',
    displayName: 'Juan Paciente',
    headline: null,
    biography: null,
    acceptsReviews: null,
  };

  const conversacion = (id: string, unreadCount = 0) => ({
    id,
    conversationTypeConceptId: 'c-direct',
    groupId: null,
    lastMessageAt: '2026-09-08T10:00:00.000Z',
    messageCount: 1,
    lastMessage: {
      id: 'm-0',
      senderProfileId: 'pp-2',
      bodyText: 'Hola',
      sentAt: '2026-09-08T10:00:00.000Z',
    },
    unreadCount,
    peers: [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }],
  });

  const mensaje = (id: string, senderProfileId = 'pp-2', bodyText = 'Hola') => ({
    id,
    conversationId: 'c-1',
    senderProfileId,
    replyToMessageId: null,
    contentTypeConceptId: 'c-text',
    bodyText,
    attachmentFileId: null,
    isEdited: null,
    sentAt: '2026-09-08T10:00:00.000Z',
  });

  /** Enciende el store y deja la bandeja resuelta. */
  const encender = (conversaciones: unknown[] = [conversacion('c-1', 2)]): void => {
    store.iniciar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) =>
        pedido.flush({
          items: conversaciones,
          count: conversaciones.length,
          limit: 50,
          nextCursor: null,
        }),
      );
  };

  /** Contesta lo que pide abrir un hilo. */
  const contestarHilo = (items: unknown[], nextCursor: string | null = null): void => {
    http
      .match((r) => r.url === '/community/conversations/c-1/messages')
      .forEach((pedido) =>
        pedido.flush({ items, count: items.length, limit: 30, nextCursor }),
      );
    http
      .match((r) => r.url === '/community/conversations/c-1/read')
      .forEach((pedido) => pedido.flush({ receiptsRecorded: 1, lastReadMessageId: 'm-1' }));
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) =>
        pedido.flush({ items: [conversacion('c-1')], count: 1, limit: 50, nextCursor: null }),
      );
  };

  /** El socket doblado: lo que el servidor empuja se dispara desde acá. */
  const socket = {
    onMessage: new Subject(),
    onMessageUpdated: new Subject(),
    onMessageDeleted: new Subject(),
    onRead: new Subject(),
    onNewConversation: new Subject(),
    onTyping: new Subject(),
    onPresence: new Subject(),
    onPinned: new Subject(),
    joinInbox: () => undefined,
    joinConversation: () => undefined,
    leaveConversation: () => undefined,
    typing: vi.fn(),
  };

  beforeEach(() => {
    socket.typing.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ChatSocketService, useValue: socket },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatStore);
  });

  afterEach(() => {
    store.detener();
    http.match(() => true).forEach((pedido) => pedido.flush(null));
    http.verify();
  });

  it('pide el perfil propio una sola vez, aunque se vuelva a entrar', () => {
    encender();
    // Volver a la pantalla no vuelve a preguntar quién soy.
    store.iniciar();
    http.expectNone('/community/profiles/me');
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) => pedido.flush({ items: [], count: 0, limit: 50, nextCursor: null }));
  });

  it('abrir un hilo apaga su contador sin esperar al servidor', () => {
    encender();
    expect(store.conversaciones()[0].unreadCount).toBe(2);

    store.abrir('c-1');

    // El contador se apaga en el acto: estás leyendo eso ahora mismo, y dejarlo
    // encendido hasta que conteste el acuse deja el globo verde a dos dedos del
    // mensaje que acabás de leer.
    expect(store.conversaciones()[0].unreadCount).toBe(0);
    // Y se recuerda cuántos eran, para el separador del hilo.
    expect(store.noLeidosAlAbrir()).toBe(2);

    contestarHilo([mensaje('m-1')]);
  });

  it('el mismo mensaje por dos caminos no se pinta dos veces', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([mensaje('m-1')]);

    expect(store.enOrden().length).toBe(1);

    // El sondeo trae lo mismo que ya empujó el socket: es el caso normal, no
    // una rareza, y sin la comprobación de id la burbuja se duplica cada 30 s.
    store['absorber']([
      {
        id: 'm-1',
        conversationId: 'c-1',
        senderProfileId: 'pp-2',
        contentTypeConceptId: 'c-text',
        bodyText: 'Hola',
        sentAt: new Date('2026-09-08T10:00:00.000Z'),
      },
    ]);

    expect(store.enOrden().length).toBe(1);
  });

  it('el envío se pinta antes del acuse y se reemplaza al llegar', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([]);

    store.enviar('Ya salgo');

    expect(store.enOrden().length).toBe(1);
    expect(store.enOrden()[0].estado).toBe('enviando');

    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/messages'))
      .flush({ id: 'm-9', conversationId: 'c-1', sentAt: '2026-09-08T11:00:00.000Z' });

    // Una sola burbuja, ya confirmada: la pendiente se reemplaza, no se suma.
    expect(store.enOrden().length).toBe(1);
    expect(store.enOrden()[0].estado).toBe('enviado');
    expect(store.enOrden()[0].id).toBe('m-9');

    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) =>
        pedido.flush({ items: [conversacion('c-1')], count: 1, limit: 50, nextCursor: null }),
      );
  });

  it('un envío que falla queda a la vista, con qué reintentar', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([]);

    store.enviar('Se va a caer');
    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/messages'))
      .error(new ProgressEvent('error'));

    // No se borra: tirar el texto de alguien porque falló la red es perder el
    // mensaje sin avisar.
    expect(store.enOrden().length).toBe(1);
    expect(store.enOrden()[0].estado).toBe('fallado');

    const pendiente = store.enOrden()[0].pendiente!;
    store.reintentar(pendiente);
    expect(store.enOrden()[0].estado).toBe('enviando');

    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/messages'))
      .flush({ id: 'm-9', conversationId: 'c-1', sentAt: '2026-09-08T11:00:00.000Z' });

    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) =>
        pedido.flush({ items: [conversacion('c-1')], count: 1, limit: 50, nextCursor: null }),
      );
  });

  it('cambiar de hilo no arrastra los mensajes del anterior', () => {
    encender([conversacion('c-1'), conversacion('c-2')]);
    store.abrir('c-1');
    contestarHilo([mensaje('m-1', 'pp-2', 'Del primero')]);
    expect(store.enOrden().length).toBe(1);

    store.abrir('c-2');

    // Vaciar es obligatorio: sin esto se ven por un instante los mensajes del
    // chat que se acaba de dejar, con el nombre del nuevo en la cabecera.
    expect(store.enOrden().length).toBe(0);

    http
      .match((r) => r.url === '/community/conversations/c-2/messages')
      .forEach((pedido) => pedido.flush({ items: [], count: 0, limit: 30, nextCursor: null }));
    http
      .match((r) => r.url === '/community/conversations/c-2/read')
      .forEach((pedido) => pedido.flush({ receiptsRecorded: 0, lastReadMessageId: null }));
  });

  it('el borrador es de cada conversación', () => {
    encender([conversacion('c-1'), conversacion('c-2')]);
    store.abrir('c-1');
    contestarHilo([]);

    store.guardarBorrador('media frase');
    expect(store.borrador()).toBe('media frase');

    store.abrir('c-2');
    // Otro chat, otro borrador: el de al lado no se contagia.
    expect(store.borrador()).toBe('');

    http
      .match((r) => r.url === '/community/conversations/c-2/messages')
      .forEach((pedido) => pedido.flush({ items: [], count: 0, limit: 30, nextCursor: null }));
    http
      .match((r) => r.url === '/community/conversations/c-2/read')
      .forEach((pedido) => pedido.flush({ receiptsRecorded: 0, lastReadMessageId: null }));

    store.abrir('c-1');
    expect(store.borrador()).toBe('media frase');
    contestarHilo([]);
  });

  it('un tic fallido no vacía la bandeja que estabas mirando', () => {
    encender();
    expect(store.conversaciones().length).toBe(1);

    store.recargarBandeja();
    http
      .expectOne((r) => r.url === '/community/conversations')
      .error(new ProgressEvent('error'));

    expect(store.conversaciones().length).toBe(1);
    expect(store.error()).toBe('No pudimos cargar tus conversaciones.');
  });

  /* --- F4 · lo que llega por el socket ------------------------------------ */

  it('«escribiendo» se aplica al hilo y caduca solo', () => {
    vi.useFakeTimers();
    try {
      encender();
      store.abrir('c-1');
      contestarHilo([mensaje('m-1')]);

      socket.onTyping.next({ conversationId: 'c-1', profileId: 'pp-2', typing: true });
      expect(store.escribiendoEnActiva()).toEqual(['pp-2']);

      // Sin otro aviso, a los seis segundos se apaga: nadie escribe para siempre.
      vi.advanceTimersByTime(6_100);
      expect(store.escribiendoEnActiva()).toEqual([]);

      // Y un mensaje de quien escribía lo apaga en el acto.
      socket.onTyping.next({ conversationId: 'c-1', profileId: 'pp-2', typing: true });
      socket.onMessage.next({ ...mensaje('m-2'), sentAt: new Date('2026-09-08T10:01:00Z') });
      expect(store.escribiendoEnActiva()).toEqual([]);
      http.match(() => true).forEach((p) => p.flush(null));
    } finally {
      vi.useRealTimers();
    }
  });

  it('avisar que escribo manda «typing» una vez cada tres segundos, y «dejé» al vaciar', () => {
    vi.useFakeTimers();
    try {
      encender();
      store.abrir('c-1');
      contestarHilo([mensaje('m-1')]);

      store.avisarEscribiendo(true);
      store.avisarEscribiendo(true);
      store.avisarEscribiendo(true);
      expect(socket.typing).toHaveBeenCalledTimes(1);
      expect(socket.typing).toHaveBeenLastCalledWith('c-1', 'pp-1', true);

      vi.advanceTimersByTime(3_100);
      store.avisarEscribiendo(true);
      expect(socket.typing).toHaveBeenCalledTimes(2);

      store.avisarEscribiendo(false);
      expect(socket.typing).toHaveBeenLastCalledWith('c-1', 'pp-1', false);
      http.match(() => true).forEach((p) => p.flush(null));
    } finally {
      vi.useRealTimers();
    }
  });

  it('un mensaje eliminado por el otro lado pierde el cuerpo en el hilo y en la fila', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([mensaje('m-1')]);
    // La fila cuya vista previa es justamente el mensaje que se va a eliminar.
    store.conversaciones.update((lista) =>
      lista.map((c) => ({
        ...c,
        lastMessage: { id: 'm-1', senderProfileId: 'pp-2', bodyText: 'Hola' },
      })),
    );

    socket.onMessageDeleted.next({ conversationId: 'c-1', messageId: 'm-1', deletedAt: new Date() });

    const enHilo = store.enOrden().find((m) => m.id === 'm-1');
    expect(enHilo?.deletedAt).toBeInstanceOf(Date);
    expect(enHilo?.bodyText).toBeUndefined();
    expect(store.conversaciones()[0].lastMessage?.deletedAt).toBeInstanceOf(Date);
  });

  it('el fijado que llega por el socket se busca en el hilo; si no está, se pide', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([mensaje('m-1')]);

    socket.onPinned.next({ conversationId: 'c-1', pinnedMessageId: 'm-1' });
    expect(store.fijado()?.id).toBe('m-1');

    socket.onPinned.next({ conversationId: 'c-1', pinnedMessageId: 'm-viejo' });
    http
      .expectOne((r) => r.url === '/community/conversations/c-1/messages' && r.params.get('limit') === '1')
      .flush({ items: [], count: 0, limit: 1, nextCursor: null, pinnedMessage: mensaje('m-viejo', 'pp-2', 'De antes') });
    expect(store.fijado()?.bodyText).toBe('De antes');

    socket.onPinned.next({ conversationId: 'c-1', pinnedMessageId: null });
    expect(store.fijado()).toBeNull();
  });
});

