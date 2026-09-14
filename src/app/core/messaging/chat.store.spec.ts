import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ChatStore } from './chat.store';
import { ChatAutoReply } from './chat-auto-reply';
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatStore);
  });

  afterEach(() => {
    store.detener();
    http.match(() => true).forEach((pedido) => pedido.flush(null));
    http.verify();
  });

  it('resuelve adjuntos del hilo sólo por la ruta contextual', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([
      {
        ...mensaje('m-file'),
        bodyText: null,
        attachmentFileId: 'file-1',
      },
    ]);
    TestBed.tick();

    const req = http.expectOne(
      (request) =>
        request.url ===
        '/community/conversations/c-1/attachments/file-1/content',
    );
    expect(req.request.params.get('profileId')).toBe('pp-1');
    http.expectNone((request) => request.url === '/common/files/file-1/content');
    req.flush(new Blob(['contenido'], { type: 'text/plain' }));
  });

  it('un 404 contextual no expone URL ni blob al hilo', () => {
    encender();
    store.abrir('c-1');
    contestarHilo([
      {
        ...mensaje('m-file'),
        bodyText: null,
        attachmentFileId: 'file-ajeno',
      },
    ]);
    TestBed.tick();

    http
      .expectOne(
        '/community/conversations/c-1/attachments/file-ajeno/content?profileId=pp-1',
      )
      .flush(
        new Blob(['Archivo adjunto no encontrado'], {
          type: 'application/json',
        }),
        { status: 404, statusText: 'Not Found' },
      );

    expect(store.urlDe('file-ajeno')).toBeNull();
    expect(store.adjuntoNoDisponible('file-ajeno')).toBe(true);
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

  /* --- Editar un mensaje propio (F4.5) ----------------------------------- */

  describe('editar', () => {
    /** Un mensaje propio mandado hace `haceMs`. */
    const propio = (id: string, haceMs: number, bodyText = 'Hola') => ({
      ...mensaje(id, 'pp-1', bodyText),
      sentAt: new Date(Date.now() - haceMs).toISOString(),
    });

    /** Abre el hilo con esos mensajes. */
    const conHilo = (items: unknown[]): void => {
      encender();
      store.abrir('c-1');
      contestarHilo(items);
    };

    it('deja editar un mensaje propio reciente', () => {
      conHilo([propio('m-1', 60_000)]);

      store.editar(store.enOrden()[0]);
      expect(store.editando()?.id).toBe('m-1');
    });

    it('no deja editar uno propio de hace más de cinco minutos', () => {
      conHilo([propio('m-1', 6 * 60_000)]);

      store.editar(store.enOrden()[0]);
      expect(store.editando()).toBeNull();
    });

    it('no deja editar el mensaje de otro, por reciente que sea', () => {
      conHilo([{ ...mensaje('m-1', 'pp-2'), sentAt: new Date().toISOString() }]);

      store.editar(store.enOrden()[0]);
      expect(store.editando()).toBeNull();
    });

    it('cambia el texto antes de que el servidor conteste, y lo marca editado', () => {
      conHilo([propio('m-1', 60_000, 'Nos vemos a als 5')]);
      store.editar(store.enOrden()[0]);

      store.confirmarEdicion('Nos vemos a las 5');

      // La burbuja ya cambió: no se espera al PATCH.
      expect(store.enOrden()[0].bodyText).toBe('Nos vemos a las 5');
      expect(store.enOrden()[0].isEdited).toBe(true);
      expect(store.editando()).toBeNull();

      const pedido = http.expectOne(
        (r) => r.url === '/community/conversations/c-1/messages/m-1',
      );
      expect(pedido.request.method).toBe('PATCH');
      expect(pedido.request.body).toEqual({
        senderProfileId: 'pp-1',
        bodyText: 'Nos vemos a las 5',
      });
      pedido.flush({ ...mensaje('m-1', 'pp-1', 'Nos vemos a las 5'), isEdited: true });
    });

    it('vuelve al texto anterior si el servidor lo rechaza', () => {
      conHilo([propio('m-1', 60_000, 'Original')]);
      store.editar(store.enOrden()[0]);
      store.confirmarEdicion('Cambiado');

      http
        .expectOne((r) => r.url === '/community/conversations/c-1/messages/m-1')
        .flush(
          { statusCode: 422, message: 'Fuera de ventana' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );

      expect(store.enOrden()[0].bodyText).toBe('Original');
      expect(store.enOrden()[0].isEdited).toBe(false);
      expect(store.error()).toContain('5 minutos');
    });

    it('sin cambios no manda nada: no marca editado lo que nadie editó', () => {
      conHilo([propio('m-1', 60_000, 'Igual')]);
      store.editar(store.enOrden()[0]);

      store.confirmarEdicion('  Igual  ');

      expect(store.editando()).toBeNull();
      expect(store.enOrden()[0].isEdited).toBeFalsy();
      http.expectNone((r) => r.url === '/community/conversations/c-1/messages/m-1');
    });

    it('responder y editar no conviven: el segundo apaga al primero', () => {
      conHilo([propio('m-1', 60_000), propio('m-2', 60_000)]);

      store.responder(store.enOrden()[0]);
      store.editar(store.enOrden()[1]);
      expect(store.respondiendoA()).toBeNull();

      store.responder(store.enOrden()[0]);
      expect(store.editando()).toBeNull();
    });
  });

  it('cambiar de chat antes de que conteste el servidor no deja el hilo en blanco', () => {
    // El defecto: `cargarHilo()` salía temprano si ya había una carga en vuelo,
    // así que el segundo `abrir()` vaciaba los mensajes y no pedía nada; la
    // respuesta del primero se descartaba por ser de otra conversación, y el
    // hilo quedaba vacío hasta el próximo sondeo. Lo encontró el navegador.
    encender([conversacion('c-1'), conversacion('c-2')]);

    store.abrir('c-1');
    const primera = http.expectOne(
      (r) => r.url === '/community/conversations/c-1/messages',
    );

    // Se cambia de chat **antes** de que la primera conteste.
    store.abrir('c-2');
    primera.flush({ items: [mensaje('m-1')], count: 1, limit: 30, nextCursor: null });

    // La de c-2 se pidió igual: el hilo no se queda vacío.
    const segunda = http.expectOne(
      (r) => r.url === '/community/conversations/c-2/messages',
    );
    segunda.flush({
      items: [mensaje('m-9', 'pp-2', 'De la otra conversación')],
      count: 1,
      limit: 30,
      nextCursor: null,
    });

    expect(store.enOrden().length).toBe(1);
    expect(store.enOrden()[0].bodyText).toBe('De la otra conversación');
    expect(store.hiloCargado()).toBe(true);

    // Abrir es haber leído, y el acuse relee la bandeja: se drenan acá para no
    // dejarle pedidos abiertos al `verify()` común.
    http
      .match((r) => r.url === '/community/conversations/c-2/read')
      .forEach((pedido) => pedido.flush({ receiptsRecorded: 1, lastReadMessageId: 'm-9' }));
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) =>
        pedido.flush({ items: [], count: 0, limit: 50, nextCursor: null }),
      );
  });

  /* --- Respuesta automática por inactividad -------------------------------- */

  describe('respuesta automática', () => {
    let autoReply: ChatAutoReply;

    /** Simula que llegó un mensaje ajeno por el socket. */
    const llega = (senderProfileId: string): void => {
      TestBed.inject(ChatSocketService)['messages$'].next({
        id: 'm-entrante',
        conversationId: 'c-1',
        senderProfileId,
        contentTypeConceptId: 'c-text',
        bodyText: 'Hola, ¿estás?',
        sentAt: new Date(),
      });
    };

    beforeEach(() => {
      localStorage.clear();
      autoReply = TestBed.inject(ChatAutoReply);
    });

    afterEach(() => localStorage.clear());

    it('apagada no contesta nada', () => {
      encender();
      llega('pp-2');

      http.expectNone(
        (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
      );
    });

    it('encendida y ausente, contesta con el texto configurado', () => {
      encender();
      autoReply.guardar({ activa: true, minutosDeInactividad: 1, texto: 'Vuelvo a las 18.' });
      // Hace dos horas que no se aparece por acá.
      localStorage.setItem(
        'alovida.chat-ultima-actividad',
        String(Date.now() - 2 * 3_600_000),
      );

      llega('pp-2');

      const enviado = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
      );
      expect(enviado.request.body).toMatchObject({
        senderProfileId: 'pp-1',
        bodyText: 'Vuelvo a las 18.',
      });
      enviado.flush({ id: 'm-auto', conversationId: 'c-1', sentAt: new Date().toISOString() });
    });

    it('no se contesta a sí misma', () => {
      encender();
      autoReply.guardar({ activa: true, minutosDeInactividad: 1 });
      localStorage.setItem('alovida.chat-ultima-actividad', String(Date.now() - 3_600_000));

      // El mensaje es propio: no hay a quién avisarle nada.
      llega('pp-1');

      http.expectNone(
        (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
      );
    });

    it('dos mensajes seguidos de la misma persona reciben un solo aviso', () => {
      encender();
      autoReply.guardar({ activa: true, minutosDeInactividad: 1, horasEntreAvisos: 4 });
      localStorage.setItem('alovida.chat-ultima-actividad', String(Date.now() - 3_600_000));

      llega('pp-2');
      http
        .expectOne(
          (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
        )
        .flush({ id: 'm-auto', conversationId: 'c-1', sentAt: new Date().toISOString() });

      llega('pp-2');
      http.expectNone(
        (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
      );
    });

    it('entrar a la mensajería cuenta como estar', () => {
      // `encender()` llama a `iniciar()`, que anota actividad: por eso no
      // contesta aunque esté configurada con un minuto.
      encender();
      autoReply.guardar({ activa: true, minutosDeInactividad: 1 });

      llega('pp-2');

      http.expectNone(
        (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
      );
    });
  });

  /* --- Descargar la conversación ------------------------------------------ */

  describe('exportar', () => {
    it('recorre todas las páginas: «la conversación» no son los últimos 30', () => {
      encender();
      store.abrir('c-1');
      contestarHilo([mensaje('m-3', 'pp-2', 'Tercero')], 'cursor-1');

      let json: string | null = null;
      store.exportarConversacion((salida) => (json = salida));

      // Primera página del recorrido.
      http
        .expectOne((r) => r.url === '/community/conversations/c-1/messages')
        .flush({
          items: [mensaje('m-3', 'pp-2', 'Tercero')],
          count: 1,
          limit: 30,
          nextCursor: 'cursor-1',
        });
      // Segunda: el cursor se respeta y recién ahí termina.
      const segunda = http.expectOne(
        (r) => r.url === '/community/conversations/c-1/messages',
      );
      expect(segunda.request.params.get('cursor')).toBe('cursor-1');
      segunda.flush({
        items: [mensaje('m-1', 'pp-1', 'Primero')],
        count: 1,
        limit: 30,
        nextCursor: null,
      });

      expect(json).not.toBeNull();
      const datos = JSON.parse(json!);
      expect(datos.formato).toBe('alovida.conversacion');
      expect(datos.mensajes.length).toBe(2);
      expect(store.exportando()).toBe(false);
    });

    it('sale del más viejo al más nuevo, no como lo pagina el contrato', () => {
      encender();
      store.abrir('c-1');
      contestarHilo([]);

      let json: string | null = null;
      store.exportarConversacion((salida) => (json = salida));
      http
        .expectOne((r) => r.url === '/community/conversations/c-1/messages')
        .flush({
          items: [
            { ...mensaje('m-2', 'pp-1', 'Después'), sentAt: '2026-09-08T11:00:00.000Z' },
            { ...mensaje('m-1', 'pp-2', 'Antes'), sentAt: '2026-09-08T10:00:00.000Z' },
          ],
          count: 2,
          limit: 30,
          nextCursor: null,
        });

      const datos = JSON.parse(json!);
      expect(datos.mensajes.map((m: { texto: string }) => m.texto)).toEqual([
        'Antes',
        'Después',
      ]);
      // Lo propio se marca como propio y con nombre: un uuid no le dice nada a
      // quien abre el archivo.
      expect(datos.mensajes[1]).toMatchObject({ propio: true, autor: 'Yo' });
      expect(datos.mensajes[0]).toMatchObject({ propio: false, autor: 'Dra. Quispe' });
    });

    it('lleva la referencia del adjunto, no sus bytes', () => {
      encender();
      store.abrir('c-1');
      contestarHilo([]);

      let json: string | null = null;
      store.exportarConversacion((salida) => (json = salida));
      http
        .expectOne((r) => r.url === '/community/conversations/c-1/messages')
        .flush({
          items: [
            {
              ...mensaje('m-1', 'pp-2', ''),
              bodyText: null,
              attachmentFileId: 'file-9',
            },
          ],
          count: 1,
          limit: 30,
          nextCursor: null,
        });

      const datos = JSON.parse(json!);
      expect(datos.mensajes[0].adjunto).toEqual({ fileId: 'file-9', sticker: null });
      // No se pidió el contenido de ningún archivo para armar el JSON.
      http.expectNone((r) => r.url.includes('/common/files/'));
    });

    it('si una página falla, avisa y no entrega un archivo a medias', () => {
      encender();
      store.abrir('c-1');
      contestarHilo([]);

      let json: string | null | undefined;
      store.exportarConversacion((salida) => (json = salida));
      http
        .expectOne((r) => r.url === '/community/conversations/c-1/messages')
        .error(new ProgressEvent('error'));

      expect(json).toBeNull();
      expect(store.exportando()).toBe(false);
      expect(store.error()).toContain('descargar la conversación');
    });
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
});
