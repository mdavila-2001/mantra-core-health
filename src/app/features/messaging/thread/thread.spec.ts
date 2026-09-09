import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Thread } from './thread';
import { ChatStore } from '../../../core/messaging/chat.store';
import { ChatPreferencias } from '../../../core/messaging/chat-preferencias';

/**
 * Lo que estas pruebas fijan.
 *
 * Que el hilo **se lee al revés de como viaja** —el contrato devuelve del más
 * reciente al más antiguo para poder paginar hacia atrás—, que **abrir es
 * haber leído** (se marca una vez, no una por tic), que **Enter envía**
 * mientras `Shift+Enter` hace salto de línea, y que el mensaje propio
 * **aparece antes de que el servidor conteste**: es lo que hace que enviar se
 * sienta instantáneo en vez de parpadear.
 */
describe('Thread', () => {
  let fixture: ComponentFixture<Thread>;
  let http: HttpTestingController;
  let store: ChatStore;

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

  const mensaje = (
    id: string,
    senderProfileId: string,
    bodyText: string,
    replyToMessageId: string | null = null,
  ) => ({
    id,
    conversationId: 'c-1',
    senderProfileId,
    replyToMessageId,
    contentTypeConceptId: 'c-text',
    bodyText,
    attachmentFileId: null,
    isEdited: null,
    sentAt: `2026-08-18T1${id.slice(-1)}:00:00.000Z`,
  });

  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const burbujas = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="mensaje"]'));

  /**
   * Contesta lo que la pantalla pide al abrirse.
   *
   * La bandeja la pide el **store**, no el hilo: desde que el chat es una sola
   * pantalla, el panel derecho no vuelve a pedir la lista para averiguar con
   * quién está hablando.
   */
  const abrir = (items: unknown[], nextCursor: string | null = null): void => {
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((pedido) =>
        pedido.flush({
          items: [
            {
              id: 'c-1',
              conversationTypeConceptId: 'c-direct',
              groupId: null,
              lastMessageAt: null,
              messageCount: 2,
              lastMessage: null,
              unreadCount: 0,
              peers: [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }],
            },
          ],
          count: 1,
          limit: 50,
          nextCursor: null,
        }),
      );
    http
      .match((r) => r.url === '/community/conversations/c-1/messages')
      .forEach((pedido) =>
        pedido.flush({ items, count: items.length, limit: 30, nextCursor }),
      );
    // El acuse de lectura.
    http
      .match((r) => r.url === '/community/conversations/c-1/read')
      .forEach((pedido) =>
        pedido.flush({ receiptsRecorded: 1, lastReadMessageId: 'm-2' }),
      );
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (clave: string) =>
                clave === 'conversationId' ? 'c-1' : null,
            }),
            // Carril P9: el composer mira `?responder` para decidir si se lleva
            // el foco. Sin este doble, la suscripción explota.
            queryParamMap: of({ get: () => null }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatStore);
    // El marco es quien enciende la mensajería; el hilo se pinta dentro de él.
    store.iniciar();
    fixture = TestBed.createComponent(Thread);
    fixture.detectChanges();
  });

  afterEach(() => {
    store.detener();
    http.match(() => true).forEach((pedido) => pedido.flush(null));
    http.verify();
  });

  it('invierte el orden: el hilo se lee del más viejo al más nuevo', () => {
    abrir([
      mensaje('m-2', 'pp-2', 'El segundo'),
      mensaje('m-1', 'pp-1', 'El primero'),
    ]);

    const textos = burbujas().map((b) => b.textContent ?? '');
    expect(textos[0]).toContain('El primero');
    expect(textos[1]).toContain('El segundo');
  });

  it('distingue el mensaje propio del ajeno', () => {
    abrir([mensaje('m-1', 'pp-1', 'Mío'), mensaje('m-2', 'pp-2', 'Suyo')]);

    const propios = burbujas().map((b) => b.getAttribute('data-propio'));
    // El primero en pantalla es el más viejo: `m-2`, que es del otro.
    expect(propios).toEqual(['false', 'true']);
  });

  it('marca leído una sola vez al abrir, no en cada carga', () => {
    abrir([mensaje('m-1', 'pp-2', 'Hola')], 'cursor-1');

    // Segunda página: no vuelve a marcar. El recibo es una fila, no un
    // contador, y marcar en cada tic escribiría uno por minuto por hilo.
    store.cargarAnteriores();
    http
      .expectOne((r) => r.url === '/community/conversations/c-1/messages')
      .flush({ items: [], count: 0, limit: 30, nextCursor: null });
    fixture.detectChanges();

    http.expectNone((r) => r.url === '/community/conversations/c-1/read');
  });

  it('Enter envía y Shift+Enter no', () => {
    abrir([]);

    escribir('Hola doctora');

    const area = consultar('hilo-texto') as HTMLTextAreaElement;
    area.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
    );
    http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/messages'));

    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const enviado = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
    );
    expect(enviado.request.body).toEqual({
      senderProfileId: 'pp-1',
      bodyText: 'Hola doctora',
    });
    enviado.flush({
      id: 'm-9',
      conversationId: 'c-1',
      sentAt: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();
  });

  it('el mensaje propio aparece antes de que el servidor conteste', () => {
    abrir([]);

    escribir('Ya salgo para allá');
    (consultar('hilo-enviar') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Sin flush: el POST sigue en vuelo y la burbuja ya está, con el reloj.
    expect(burbujas().length).toBe(1);
    expect(burbujas()[0].textContent).toContain('Ya salgo para allá');
    expect(consultar('hilo-reloj')).not.toBeNull();

    http
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/messages'))
      .flush({ id: 'm-9', conversationId: 'c-1', sentAt: '2026-08-18T12:00:00.000Z' });
    fixture.detectChanges();

    // Y al llegar el acuse sigue habiendo una sola: la pendiente se reemplaza
    // por la del servidor, no se suma.
    expect(burbujas().length).toBe(1);
    expect(consultar('hilo-reloj')).toBeNull();
    expect(consultar('hilo-ticks')).not.toBeNull();
  });

  it('sin nada escrito no hay botón de enviar', () => {
    abrir([]);

    // El lugar del botón lo ocupa el micrófono, como en cualquier chat. Acá no
    // se puede afirmar que esté: `MediaRecorder` no existe en el entorno de
    // pruebas y el grabador se esconde solo cuando el navegador no puede
    // grabar, que es justamente lo que se quiere que haga.
    expect(consultar('hilo-enviar')).toBeNull();
    expect(consultar('hilo-texto')).not.toBeNull();
  });

  it('responder manda la cita, y la burbuja la muestra', () => {
    abrir([mensaje('m-1', 'pp-2', 'Traé los estudios')]);

    consultar('hilo-menu-mensaje')?.click();
    fixture.detectChanges();
    consultar('hilo-responder')?.click();
    fixture.detectChanges();

    expect(consultar('composer-respuesta')?.textContent).toContain('Traé los estudios');

    escribir('Los llevo');
    (consultar('hilo-enviar') as HTMLButtonElement).click();

    const enviado = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
    );
    expect(enviado.request.body).toEqual({
      senderProfileId: 'pp-1',
      bodyText: 'Los llevo',
      replyToMessageId: 'm-1',
    });
    enviado.flush({ id: 'm-2', conversationId: 'c-1', sentAt: '2026-08-18T12:00:00.000Z' });
    fixture.detectChanges();
  });

  it('el separador de no leídos dice dónde retomar', () => {
    // Se abre con dos sin leer: el separador va delante del anteúltimo.
    store.conversaciones.set([
      {
        id: 'c-1',
        conversationTypeConceptId: 'c-direct',
        unreadCount: 2,
        peers: [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }],
        isFavorite: false,
        isPinned: false,
      },
    ]);
    store.noLeidosAlAbrir.set(2);
    abrir([
      mensaje('m-3', 'pp-2', 'Y esto tampoco'),
      mensaje('m-2', 'pp-2', 'Esto no lo viste'),
      mensaje('m-1', 'pp-1', 'Lo último que leíste'),
    ]);

    expect(consultar('hilo-no-leidos')?.textContent).toContain('2 mensajes no leídos');
  });

  it('el menú de la cabecera marca favorito y archiva la conversación abierta', () => {
    abrir([mensaje('m-1', 'pp-2', 'Hola')]);
    const preferencias = TestBed.inject(ChatPreferencias);

    consultar('hilo-menu')?.click();
    fixture.detectChanges();
    expect(consultar('hilo-ver-perfil')).not.toBeNull();

    consultar('hilo-favorito')?.click();
    fixture.detectChanges();
    expect(preferencias.esFavorito('c-1')).toBe(true);
    // Al elegir, el menú se cierra: es un menú, no un panel.
    expect(consultar('hilo-favorito')).toBeNull();

    consultar('hilo-menu')?.click();
    fixture.detectChanges();
    expect(consultar('hilo-favorito')?.textContent).toContain('Quitar de favoritos');

    consultar('hilo-archivar')?.click();
    fixture.detectChanges();
    expect(preferencias.estaArchivado('c-1')).toBe(true);
    // Archivar quita el favorito: la misma regla que en la bandeja.
    expect(preferencias.esFavorito('c-1')).toBe(false);

    // F4.4: lo marcado viaja a la API, no al navegador.
    const pedidos = http.match(
      (r) => r.method === 'PATCH' && r.url === '/community/conversations/c-1/participant',
    );
    expect(pedidos.map((p) => p.request.body)).toEqual([
      { profileId: 'pp-1', isFavorite: true },
      { profileId: 'pp-1', archived: true },
    ]);
    pedidos.forEach((p) => p.flush(null));
  });

  /* --- F4.1 / F4.2 · escribiendo y presencia ------------------------------ */

  it('«escribiendo…» y «en línea» se leen bajo el nombre', () => {
    abrir([mensaje('m-1', 'pp-2', 'Hola')]);
    http
      .match((r) => r.url === '/community/conversations/c-1/presence')
      .forEach((p) =>
        p.flush({
          conversationId: 'c-1',
          peers: [{ profileId: 'pp-2', online: true, lastSeenAt: null }],
        }),
      );
    fixture.detectChanges();
    expect(consultar('hilo-estado')?.textContent?.trim()).toBe('en línea');

    // Llega «escribiendo» por el socket: gana sobre la presencia.
    store.escribiendo.set(new Map([['c-1', new Set(['pp-2'])]]));
    fixture.detectChanges();
    expect(consultar('hilo-estado')?.textContent?.trim()).toBe('escribiendo…');

    store.escribiendo.set(new Map());
    store.presencia.set(
      new Map([
        [
          'pp-2',
          { profileId: 'pp-2', online: false, lastSeenAt: new Date('2026-08-18T09:05:00') },
        ],
      ]),
    );
    fixture.detectChanges();
    expect(consultar('hilo-estado')?.textContent).toContain('últ. vez');
  });

  /* --- F4.5 · editar y eliminar ------------------------------------------- */

  it('editar un mensaje propio manda el PATCH y deja la marca «editado»', async () => {
    abrir([mensaje('m-1', 'pp-1', 'Traé los estudos')]);

    consultar('hilo-menu-mensaje')?.click();
    fixture.detectChanges();
    consultar('hilo-editar')?.click();
    fixture.detectChanges();

    // El campo toma el texto y avisa que se está corrigiendo. `ngModel`
    // escribe el valor en el DOM en una microtarea: hay que esperarla.
    expect(consultar('composer-edicion')).not.toBeNull();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('Traé los estudos');

    escribir('Traé los estudios');
    (consultar('hilo-enviar') as HTMLButtonElement).click();
    fixture.detectChanges();

    const pedido = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === '/community/conversations/c-1/messages/m-1',
    );
    expect(pedido.request.body).toEqual({ senderProfileId: 'pp-1', bodyText: 'Traé los estudios' });
    // Ya se ve corregido antes de que conteste el servidor.
    expect(burbujas()[0].textContent).toContain('Traé los estudios');
    expect(consultar('hilo-editado')).not.toBeNull();
    pedido.flush({ ...mensaje('m-1', 'pp-1', 'Traé los estudios'), isEdited: true });
    fixture.detectChanges();
    expect(consultar('composer-edicion')).toBeNull();
  });

  it('eliminar deja «Se eliminó este mensaje» en su lugar, sin hueco', () => {
    abrir([mensaje('m-2', 'pp-2', 'Ok'), mensaje('m-1', 'pp-1', 'Esto no')]);

    // El menú del propio (m-1, el primero en orden de lectura).
    const menus = fixture.nativeElement.querySelectorAll('[data-testid="hilo-menu-mensaje"]');
    (menus[0] as HTMLElement).click();
    fixture.detectChanges();
    consultar('hilo-eliminar')?.click();
    fixture.detectChanges();

    const pedido = http.expectOne(
      (r) => r.method === 'DELETE' && r.url === '/community/conversations/c-1/messages/m-1',
    );
    expect(pedido.request.params.get('profileId')).toBe('pp-1');
    expect(burbujas().length).toBe(2);
    expect(consultar('hilo-eliminado')?.textContent).toContain('Se eliminó este mensaje');
    expect(burbujas()[0].textContent).not.toContain('Esto no');
    pedido.flush({ conversationId: 'c-1', messageId: 'm-1', deletedAt: '2026-08-18T12:00:00.000Z' });
  });

  it('un mensaje ajeno no ofrece editar ni eliminar', () => {
    abrir([mensaje('m-1', 'pp-2', 'Hola')]);
    consultar('hilo-menu-mensaje')?.click();
    fixture.detectChanges();
    expect(consultar('hilo-editar')).toBeNull();
    expect(consultar('hilo-eliminar')).toBeNull();
    expect(consultar('hilo-fijar')).not.toBeNull();
  });

  /* --- F4.6 · fijar ---------------------------------------------------------- */

  it('fijar pone la barra arriba y soltar la saca', () => {
    abrir([mensaje('m-1', 'pp-2', 'Turno: martes 10:00')]);
    expect(consultar('hilo-fijado')).toBeNull();

    consultar('hilo-menu-mensaje')?.click();
    fixture.detectChanges();
    consultar('hilo-fijar')?.click();
    fixture.detectChanges();

    const fijar = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/pin',
    );
    expect(fijar.request.body).toEqual({ profileId: 'pp-1', messageId: 'm-1' });
    expect(consultar('hilo-fijado')?.textContent).toContain('Turno: martes 10:00');
    fijar.flush({ conversationId: 'c-1', pinnedMessageId: 'm-1' });

    consultar('hilo-soltar-fijado')?.click();
    fixture.detectChanges();
    http
      .expectOne((r) => r.method === 'DELETE' && r.url === '/community/conversations/c-1/pin')
      .flush({ conversationId: 'c-1', pinnedMessageId: null });
    expect(consultar('hilo-fijado')).toBeNull();
  });

  it('la primera página trae el fijado aunque no esté en lo cargado', () => {
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((p) => p.flush({ items: [], count: 0, limit: 50, nextCursor: null }));
    http
      .match((r) => r.url === '/community/conversations/c-1/messages')
      .forEach((p) =>
        p.flush({
          items: [mensaje('m-9', 'pp-2', 'Lo último')],
          count: 1,
          limit: 30,
          nextCursor: null,
          pinnedMessage: mensaje('m-1', 'pp-2', 'De hace meses'),
        }),
      );
    // El acuse de lectura, y la relectura de la bandeja que dispara.
    http
      .match((r) => r.url === '/community/conversations/c-1/read')
      .forEach((p) => p.flush({ receiptsRecorded: 1, lastReadMessageId: 'm-9' }));
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((p) => p.flush({ items: [], count: 0, limit: 50, nextCursor: null }));
    fixture.detectChanges();

    expect(consultar('hilo-fijado')?.textContent).toContain('De hace meses');
  });

  function escribir(valor: string): void {
    const area = consultar('hilo-texto') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
