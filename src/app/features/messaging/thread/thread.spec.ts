import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { indiceDelPrimerNoLeido, Thread, trocear } from './thread';
import { ChatStore } from '../../../core/messaging/chat.store';
import { ChatSocketService } from '../../../core/messaging/chat-socket.service';
import { ChatPreferences } from '../../../core/messaging/chat-preferences';
import { PACK_DE_STICKERS } from '../../../core/messaging/sticker-pack.generated';
import { Composer } from './composer/composer';
import { rutaParaQuienMira, subtituloDeContexto } from './hilo-contexto';
import { environment } from '../../../../environments/environment';

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

  it('Pulse: el historial no anima; sólo la burbuja ajena que llega después entra con pulse-arrive', () => {
    abrir([mensaje('m-2', 'pp-2', 'El segundo'), mensaje('m-1', 'pp-1', 'El primero')]);

    // Lo que se carga al abrir aparece quieto.
    expect(burbujas().filter((b) => b.classList.contains('pulse-arrive'))).toHaveLength(0);

    // Llega en vivo, por el socket, un mensaje del otro lado.
    const cable = TestBed.inject(ChatSocketService) as unknown as {
      messages$: { next: (m: unknown) => void };
    };
    cable.messages$.next({ ...mensaje('m-3', 'pp-2', 'Recién llegado'), sentAt: '2026-08-18T13:00:00.000Z' });
    fixture.detectChanges();

    const llegadas = burbujas().filter((b) => b.classList.contains('pulse-arrive'));
    expect(llegadas).toHaveLength(1);
    expect(llegadas[0].textContent).toContain('Recién llegado');

    // Y un mensaje propio, aunque sea nuevo, no se marca como llegada.
    cable.messages$.next({ ...mensaje('m-4', 'pp-1', 'Mío nuevo'), sentAt: '2026-08-18T14:00:00.000Z' });
    fixture.detectChanges();
    expect(burbujas().filter((b) => b.classList.contains('pulse-arrive'))).toHaveLength(1);

    // Un mensaje en vivo con el hilo abierto lo marca leído y refresca la
    // bandeja: se contestan los dos pedidos como lo haría el servidor.
    http
      .match((r) => r.url === '/community/conversations/c-1/read')
      .forEach((pedido) =>
        pedido.flush({ receiptsRecorded: 1, lastReadMessageId: 'm-4' }),
      );
    const bandeja = {
      items: [
        {
          id: 'c-1',
          conversationTypeConceptId: 'c-direct',
          groupId: null,
          lastMessageAt: null,
          messageCount: 4,
          lastMessage: null,
          unreadCount: 0,
          peers: [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }],
        },
      ],
      count: 1,
      limit: 50,
      nextCursor: null,
    };
    for (let ronda = 0; ronda < 3; ronda++) {
      http
        .match((r) => r.url === '/community/conversations')
        .forEach((pedido) => pedido.flush(bandeja));
      fixture.detectChanges();
    }
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
    abrir([mensaje('m-1', 'pp-2', 'Traiga los estudios')]);

    consultar('hilo-menu-mensaje')?.click();
    fixture.detectChanges();
    consultar('hilo-responder')?.click();
    fixture.detectChanges();

    expect(consultar('composer-respuesta')?.textContent).toContain('Traiga los estudios');

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
      },
    ]);
    store.noLeidosAlAbrir.set(2);
    abrir([
      mensaje('m-3', 'pp-2', 'Y esto tampoco'),
      mensaje('m-2', 'pp-2', 'Esto no lo vio'),
      mensaje('m-1', 'pp-1', 'Lo último que leíste'),
    ]);

    expect(consultar('hilo-no-leidos')?.textContent).toContain('2 mensajes no leídos');
  });

  it('el menú de la cabecera marca favorito y archiva la conversación abierta', () => {
    abrir([mensaje('m-1', 'pp-2', 'Hola')]);
    const preferencias = TestBed.inject(ChatPreferences);

    consultar('hilo-menu')?.click();
    fixture.detectChanges();
    expect(consultar('hilo-ver-perfil')).not.toBeNull();

    consultar('hilo-favorito')?.click();
    fixture.detectChanges();
    expect(preferencias.isFavorite('c-1')).toBe(true);
    // Al elegir, el menú se cierra: es un menú, no un panel.
    expect(consultar('hilo-favorito')).toBeNull();

    consultar('hilo-menu')?.click();
    fixture.detectChanges();
    expect(consultar('hilo-favorito')?.textContent).toContain('Quitar de favoritos');

    consultar('hilo-archivar')?.click();
    fixture.detectChanges();
    expect(preferencias.isArchived('c-1')).toBe(true);
    // Archivar quita el favorito: la misma regla que en la bandeja.
    expect(preferencias.isFavorite('c-1')).toBe(false);

    // Se deja el navegador como estaba: las preferencias viven en localStorage.
    preferencias.toggleArchived('c-1');
  });

  it('buscar en la conversación deja sólo las coincidencias, resaltadas', () => {
    abrir([
      mensaje('m-3', 'pp-2', 'Le mando el Holter mañana'),
      mensaje('m-2', 'pp-1', 'Perfecto, gracias'),
      mensaje('m-1', 'pp-2', 'Hola, ¿pudo ver el hólter?'),
    ]);

    consultar('hilo-buscar-abrir')?.click();
    fixture.detectChanges();
    const caja = consultar('hilo-buscar-texto') as HTMLInputElement;
    caja.value = 'holter';
    caja.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // Dos de tres, sin distinguir tildes ni mayúsculas.
    expect(burbujas().length).toBe(2);
    expect(consultar('hilo-buscar-cuenta')?.textContent).toContain('2 coincidencias');
    const marcas = fixture.nativeElement.querySelectorAll('mark.hilo__marca');
    expect(marcas.length).toBe(2);

    // Cerrar devuelve el hilo entero.
    caja.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(consultar('hilo-buscar-texto')).toBeNull();
    expect(burbujas().length).toBe(3);
  });

  it('una URL en el texto se vuelve enlace, y no se resalta por dentro', () => {
    const trozos = trocear('Mire https://alovida.bo/mi-historia y avíseme', 'historia');
    expect(trozos).toEqual([
      { tipo: 'texto', valor: 'Mire ' },
      { tipo: 'enlace', valor: 'https://alovida.bo/mi-historia' },
      { tipo: 'texto', valor: ' y avíseme' },
    ]);

    abrir([mensaje('m-1', 'pp-2', 'Entre a https://alovida.bo/turnos')]);
    const enlace = fixture.nativeElement.querySelector('a.hilo__enlace') as HTMLAnchorElement | null;
    expect(enlace?.getAttribute('href')).toBe('https://alovida.bo/turnos');
    expect(enlace?.getAttribute('rel')).toContain('noopener');
  });

  it('reenviar manda el mismo texto a la conversación elegida', () => {
    abrir([mensaje('m-1', 'pp-2', 'Le dejo la orden en la historia clínica')]);
    // Otra conversación en la bandeja, para tener a quién reenviar.
    store.conversaciones.update((lista) => [
      ...lista,
      {
        id: 'c-2',
        conversationTypeConceptId: 'c-direct',
        unreadCount: 0,
        peers: [{ profileId: 'pp-3', displayName: 'Dr. Ortega' }],
      },
    ]);
    fixture.detectChanges();

    consultar('hilo-menu-mensaje')?.click();
    fixture.detectChanges();
    consultar('hilo-reenviar')?.click();
    fixture.detectChanges();

    // Un `<dialog>` nativo (`app-content-dialog`) y no un `div` con
    // `aria-modal`: la trampa de foco y el fondo inerte los da `showModal()`.
    const modal = consultar('thread-forward-dialog');
    expect(modal?.querySelector('dialog')).not.toBeNull();

    const destinos = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="hilo-reenviar-destino"]'),
    ) as HTMLElement[];
    // Sólo la otra: reenviarse a la misma conversación no es reenviar.
    expect(destinos.map((d) => d.querySelector(':scope > span')?.textContent?.trim())).toEqual(['Dr. Ortega']);
    destinos[0]!.click();
    fixture.detectChanges();

    const enviado = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/community/conversations/c-2/messages',
    );
    expect(enviado.request.body).toEqual({
      senderProfileId: 'pp-1',
      bodyText: 'Le dejo la orden en la historia clínica',
    });
    enviado.flush({ id: 'm-9', conversationId: 'c-2', sentAt: '2026-08-18T12:00:00.000Z' });
    fixture.detectChanges();

    expect(consultar('hilo-aviso')?.textContent).toContain('Reenviado a Dr. Ortega');
    // El hilo abierto no cambió: el mensaje fue a otra conversación.
    expect(burbujas().length).toBe(1);
    expect(consultar('thread-forward-dialog')).toBeNull();
  });

  it('el foco vuelve a «Opciones del mensaje» al cancelar el reenvío', async () => {
    abrir([mensaje('m-1', 'pp-2', 'Le dejo la orden en la historia clínica')]);
    store.conversaciones.update((lista) => [
      ...lista,
      {
        id: 'c-2',
        conversationTypeConceptId: 'c-direct',
        unreadCount: 0,
        peers: [{ profileId: 'pp-3', displayName: 'Dr. Ortega' }],
      },
    ]);
    fixture.detectChanges();

    const opciones = consultar('hilo-menu-mensaje') as HTMLElement;
    opciones.click();
    fixture.detectChanges();
    consultar('hilo-reenviar')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // El ítem «Reenviar» ya no existe: sin el paso previo, el foco caería en
    // `<body>` y el teclado arrancaría desde el principio de la página.
    (consultar('content-dialog-close') as HTMLElement).click();
    fixture.detectChanges();

    expect(consultar('thread-forward-dialog')).toBeNull();
    expect(document.activeElement).toBe(opciones);
  });

  /* --- Stickers ----------------------------------------------------------- */

  describe('stickers', () => {
    it('se manda al tocarlo y se dibuja sin burbuja', () => {
      abrir([]);

      (consultar('composer-emojis') as HTMLElement).click();
      fixture.detectChanges();
      (consultar('composer-solapa-stickers') as HTMLElement).click();
      fixture.detectChanges();

      const primero = fixture.nativeElement.querySelector(
        '[data-testid="composer-sticker"]',
      ) as HTMLElement;
      primero.click();
      fixture.detectChanges();

      const enviado = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/community/conversations/c-1/messages',
      );
      // Viaja como cualquier adjunto: no hace falta un tipo de mensaje nuevo.
      expect(enviado.request.body).toMatchObject({
        senderProfileId: 'pp-1',
        contentType: 'MEDIA',
        attachmentFileId: PACK_DE_STICKERS[0].id,
      });
      enviado.flush({
        id: 'm-9',
        conversationId: 'c-1',
        sentAt: new Date().toISOString(),
      });
      fixture.detectChanges();

      expect(consultar('hilo-sticker')).not.toBeNull();
      // Sin burbuja: la clase lo dice y el CSS la vacía.
      expect(burbujas()[0]?.classList.contains('is-sticker')).toBe(true);
    });

    it('no le pide los bytes al servidor: el pack viene con la aplicación', () => {
      abrir([
        {
          ...mensaje('m-1', 'pp-2', ''),
          bodyText: null,
          attachmentFileId: PACK_DE_STICKERS[1].id,
        },
      ]);

      expect(consultar('hilo-sticker')?.getAttribute('src')).toBe(
        PACK_DE_STICKERS[1].url,
      );
      http.expectNone((r) => r.url.includes('/common/files/'));
    });
  });

  /* --- Editar un mensaje propio (F4.5) ----------------------------------- */

  describe('editar', () => {
    /** Un mensaje propio mandado hace `haceMs`, para pisar la ventana. */
    const propioReciente = (id: string, haceMs: number, texto: string) => ({
      ...mensaje(id, 'pp-1', texto),
      sentAt: new Date(Date.now() - haceMs).toISOString(),
    });

    /** Abre el menú de la única burbuja en pantalla. */
    const abrirMenu = (): void => {
      (consultar('hilo-menu-mensaje') as HTMLElement).click();
      fixture.detectChanges();
    };

    /**
     * Elige «Editar» y espera a que el campo tenga el texto.
     *
     * El `await` no es ceremonia: `[ngModel]` escribe el `<textarea>` en una
     * microtarea, así que leer el DOM en el mismo tic devuelve el valor viejo.
     */
    const elegirEditar = async (): Promise<void> => {
      (consultar('hilo-editar') as HTMLElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('ofrece «Editar» en un mensaje propio de hace un minuto', () => {
      abrir([propioReciente('m-1', 60_000, 'Nos vemos a als 5')]);
      abrirMenu();

      expect(consultar('hilo-editar')).not.toBeNull();
    });

    it('pasados los cinco minutos queda visible pero apagado, con su motivo', () => {
      abrir([propioReciente('m-1', 6 * 60_000, 'Viejo')]);
      abrirMenu();

      // Esconderlo hacía creer que la función no existía: se ve, y dice por qué
      // no se puede usar.
      const editar = consultar('hilo-editar') as HTMLButtonElement;
      expect(editar).not.toBeNull();
      expect(editar.disabled).toBe(true);
      expect(editar.textContent).toContain('Pasaron más de 5 min');
    });

    it('no lo ofrece en el mensaje de otro', () => {
      abrir([{ ...mensaje('m-1', 'pp-2', 'Suyo'), sentAt: new Date().toISOString() }]);
      abrirMenu();

      expect(consultar('hilo-editar')).toBeNull();
    });

    it('el composer entra en modo edición con el texto cargado', async () => {
      abrir([propioReciente('m-1', 60_000, 'Nos vemos a als 5')]);
      abrirMenu();
      await elegirEditar();

      expect(consultar('composer-editando')).not.toBeNull();
      expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe(
        'Nos vemos a als 5',
      );
      // Guardar, no enviar: son dos gestos distintos y el botón lo dice.
      expect(consultar('composer-editar-guardar')).not.toBeNull();
      expect(consultar('hilo-enviar')).toBeNull();
      // Y no se adjunta mientras se edita.
      expect(consultar('composer-adjuntar')).toBeNull();
    });

    it('guardar manda el PATCH y sale del modo edición', async () => {
      abrir([propioReciente('m-1', 60_000, 'Nos vemos a als 5')]);
      abrirMenu();
      await elegirEditar();

      escribir('Nos vemos a las 5');
      (consultar('composer-editar-guardar') as HTMLElement).click();
      fixture.detectChanges();

      const pedido = http.expectOne(
        (r) => r.url === '/community/conversations/c-1/messages/m-1',
      );
      expect(pedido.request.method).toBe('PATCH');
      pedido.flush({
        ...mensaje('m-1', 'pp-1', 'Nos vemos a las 5'),
        isEdited: true,
      });
      fixture.detectChanges();

      expect(consultar('composer-editando')).toBeNull();
      expect(burbujas()[0]?.textContent).toContain('Nos vemos a las 5');
      expect(consultar('hilo-editado')).not.toBeNull();
    });

    it('cancelar devuelve lo que se estaba escribiendo antes', async () => {
      abrir([propioReciente('m-1', 60_000, 'Original')]);
      escribir('media frase');
      abrirMenu();
      await elegirEditar();
      expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('Original');

      (consultar('composer-editar-cancelar') as HTMLElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(consultar('composer-editando')).toBeNull();
      expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('media frase');
      // Cancelar no toca el mensaje.
      http.expectNone((r) => r.url === '/community/conversations/c-1/messages/m-1');
    });

    it('dice «editado» en un mensaje que ya venía editado del servidor', () => {
      abrir([{ ...mensaje('m-1', 'pp-2', 'Corregido'), isEdited: true }]);

      expect(consultar('hilo-editado')).not.toBeNull();
    });
  });

  function escribir(valor: string): void {
    const area = consultar('hilo-texto') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  /* --- 5.2 · metadata y vista previa de adjuntos -------------------------- */

  /**
   * Lo que fija este bloque: 5.1 ya pinta los adjuntos del hilo por la ruta
   * contextual (imagen con `<img>`, documento como descarga). 5.2 **no rehace
   * eso**: suma el tipo y el tamaño reales —leídos del contenido que ya bajó,
   * sin petición nueva— y la vista previa del PDF dentro de la burbuja. Cada
   * caso sirve el contenido por la ruta contextual y comprueba que no se toca
   * `/common/files` ni la URL firmada.
   */
  describe('adjuntos (5.2)', () => {
    const conAdjunto = (id: string, fileId: string) => ({
      ...mensaje(id, 'pp-2', ''),
      bodyText: null,
      contentTypeConceptId: 'c-media',
      attachmentFileId: fileId,
    });

    /** Contesta el contenido por la ruta contextual y espera a que el store lo tenga. */
    const servir = async (fileId: string, cuerpo: Blob | null, falla = false): Promise<void> => {
      fixture.detectChanges();
      const pedido = http.expectOne((r) => r.url.includes(`/attachments/${fileId}/content`));
      expect(pedido.request.url).toContain('/community/conversations/c-1/attachments/');
      expect(pedido.request.url).not.toContain('/common/files');
      expect(pedido.request.url).not.toContain('download-url');
      if (falla) {
        pedido.flush(null, { status: 404, statusText: 'Not Found' });
      } else {
        pedido.flush(cuerpo);
      }
      // `blobToDataUrl` usa FileReader, que no es una tarea de la zona.
      for (let i = 0; i < 100 && store.urlDe(fileId) === ''; i += 1) {
        await new Promise((listo) => setTimeout(listo, 5));
      }
      fixture.detectChanges();
    };

    const bytes = (tipo: string, cantidad: number): Blob =>
      new Blob([new Uint8Array(cantidad).fill(37)], { type: tipo });

    it('una imagen se sigue pintando como imagen, sin detalle ni vista previa nueva', async () => {
      abrir([conAdjunto('m-1', 'f-img')]);
      await servir('f-img', bytes('image/png', 16));

      expect(consultar('hilo-imagen')).not.toBeNull();
      expect(consultar('hilo-documento')).toBeNull();
      expect(consultar('hilo-documento-ver')).toBeNull();
    });

    it('la imagen a tamaño completo se abre en un modal nativo y devuelve el foco', async () => {
      abrir([conAdjunto('m-1', 'f-img')]);
      await servir('f-img', bytes('image/png', 16));

      const miniatura = consultar('hilo-imagen') as HTMLButtonElement;
      miniatura.focus();
      miniatura.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // El visor de fotos es un `<dialog>` modal (trampa de foco, fondo inerte).
      const visor = consultar('hilo-visor');
      expect(visor?.tagName).toBe('DIALOG');
      expect(consultar('hilo-visor-foto')?.getAttribute('src')).toMatch(/^data:image\/png/);

      (consultar('hilo-visor-cerrar') as HTMLElement).click();
      fixture.detectChanges();

      expect(consultar('hilo-visor')).toBeNull();
      expect(document.activeElement).toBe(miniatura);
    });

    it('un PDF muestra su tipo y su tamaño reales y conserva la descarga', async () => {
      abrir([conAdjunto('m-1', 'f-pdf')]);
      await servir('f-pdf', bytes('application/pdf', 8));

      const enlace = consultar('hilo-documento') as HTMLAnchorElement;
      expect(enlace).not.toBeNull();
      expect(enlace.getAttribute('href')).toMatch(/^data:application\/pdf;base64,/);
      expect(enlace.getAttribute('download')).toBe('adjunto.pdf');
      expect(consultar('hilo-documento-detalle')?.textContent?.trim()).toBe('PDF · 8 bytes');
    });

    it('la vista previa del PDF se abre dentro del hilo y no quita la descarga', async () => {
      abrir([conAdjunto('m-1', 'f-pdf')]);
      await servir('f-pdf', bytes('application/pdf', 8));

      const ver = consultar('hilo-documento-ver') as HTMLButtonElement;
      expect(ver.getAttribute('aria-expanded')).toBe('false');
      expect(consultar('hilo-documento-preview')).toBeNull();

      ver.click();
      fixture.detectChanges();
      expect(consultar('hilo-documento-preview')).not.toBeNull();
      expect(consultar('hilo-documento-ver')?.getAttribute('aria-expanded')).toBe('true');
      expect(consultar('hilo-documento')).not.toBeNull();

      (consultar('hilo-documento-ver') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(consultar('hilo-documento-preview')).toBeNull();
    });

    it('un tipo sin vista previa sigue descargable, con metadata y sin fingir preview', async () => {
      abrir([conAdjunto('m-1', 'f-docx')]);
      await servir(
        'f-docx',
        bytes('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 2048),
      );

      expect(consultar('hilo-documento')).not.toBeNull();
      expect(consultar('hilo-documento-detalle')?.textContent?.trim()).toBe('Documento Word · 2 KB');
      expect(consultar('hilo-documento-ver')).toBeNull();
    });

    it('un contenido sin tipo declarado no rompe el hilo ni ofrece vista previa', async () => {
      abrir([conAdjunto('m-1', 'f-sin-tipo')]);
      await servir('f-sin-tipo', new Blob([new Uint8Array(4)]));

      expect(consultar('hilo-documento')).not.toBeNull();
      expect(consultar('hilo-documento-ver')).toBeNull();
    });

    it('un adjunto que falla lo avisa y el resto de la conversación sigue', async () => {
      abrir([conAdjunto('m-2', 'f-roto'), mensaje('m-1', 'pp-1', 'Se lo mando')]);
      await servir('f-roto', null, true);

      expect(fixture.nativeElement.textContent).toContain('Archivo no disponible');
      expect(fixture.nativeElement.textContent).toContain('Se lo mando');
      expect(consultar('hilo-documento-ver')).toBeNull();
    });

    it('ningún interno de storage aparece en la vista, ni se pide la URL firmada', async () => {
      abrir([conAdjunto('m-1', 'f-pdf')]);
      await servir('f-pdf', bytes('application/pdf', 8));
      (consultar('hilo-documento-ver') as HTMLButtonElement).click();
      fixture.detectChanges();

      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      for (const interno of ['s3://', 'file://', 'storageUri', 'objectKey', 'bucket', 'contentHash']) {
        expect(html).not.toContain(interno);
      }
      expect(http.match((r) => r.url.includes('download-url') || r.url.includes('/common/files'))).toHaveLength(0);
    });
  });

  /* --- Tarjeta de contexto (marketplace) ---------------------------------- */

  describe('tarjeta de contexto', () => {
    const TARJETA =
      'Pedido: Farmacia Chávez · Sucursal Miraflores\n2 productos · Bs 69,00\n/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6';

    const sugerenciasDelComposer = (): readonly string[] =>
      (fixture.debugElement.query(By.directive(Composer)).componentInstance as Composer).sugerencias();

    it('pinta el texto con forma de tarjeta como tarjeta, con su enlace interno', () => {
      abrir([mensaje('m-1', 'pp-1', TARJETA)]);

      const tarjeta = consultar('hilo-contexto');
      expect(tarjeta).not.toBeNull();
      expect(tarjeta?.getAttribute('data-tipo')).toBe('pedido');
      expect(tarjeta?.textContent).toContain('Farmacia Chávez · Sucursal Miraflores');
      expect(tarjeta?.textContent).toContain('2 productos · Bs 69,00');
      const ver = consultar('hilo-contexto-ver') as HTMLAnchorElement;
      expect(ver.textContent?.trim()).toBe('Ver pedido');
      expect(ver.getAttribute('href')).toBe('/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6');
      // La ruta cruda no se lee como texto en la burbuja.
      expect(burbujas()[0]?.querySelector('.hilo__texto')).toBeNull();
    });

    it('la fija arriba del hilo como «Consulta sobre», con la última si hay dos', () => {
      abrir([
        mensaje('m-2', 'pp-1', 'Producto: Paracetamol 500 mg\n/pharmacies-directory/farmacia-vida'),
        mensaje('m-1', 'pp-1', TARJETA),
      ]);

      const fijado = consultar('hilo-contexto-fijado');
      expect(fijado?.getAttribute('data-tipo')).toBe('producto');
      expect(fijado?.textContent).toContain('Consulta sobre: Producto');
      expect(fijado?.textContent).toContain('Paracetamol 500 mg');
      expect(consultar('hilo-contexto-fijado-ver')?.getAttribute('href')).toBe('/pharmacies-directory/farmacia-vida');
    });

    it('un texto parecido con ruta externa queda como texto, sin tarjeta ni fijado', () => {
      abrir([mensaje('m-1', 'pp-2', 'Pedido: algo\n//sitio-malo.example/robar')]);

      expect(consultar('hilo-contexto')).toBeNull();
      expect(consultar('hilo-contexto-fijado')).toBeNull();
      expect(burbujas()[0]?.textContent).toContain('//sitio-malo.example/robar');
    });

    it('con sólo la tarjeta, sugiere preguntas acordes al tipo', () => {
      abrir([mensaje('m-1', 'pp-1', TARJETA)]);

      expect(sugerenciasDelComposer()[0]).toBe('¿Cuándo llega mi pedido?');
    });

    it('cada tipo trae su pregunta', () => {
      abrir([mensaje('m-1', 'pp-1', 'Servicio: Toma de presión\n/clinics-directory/clinica-sur')]);
      expect(sugerenciasDelComposer()).toContain('¿Qué días atienden?');
    });

    it('en cuanto alguien escribió algo propio, deja de sugerir', () => {
      abrir([mensaje('m-2', 'pp-2', 'Hola, ¿en qué te ayudo?'), mensaje('m-1', 'pp-1', TARJETA)]);

      expect(sugerenciasDelComposer()).toEqual([]);
    });

    it('el fijado dice quién envió la tarjeta: vos u otra persona', () => {
      abrir([mensaje('m-1', 'pp-1', TARJETA)]);
      expect(consultar('hilo-contexto-fijado-autor')?.textContent).toContain('Enviada por vos');
    });

    it('una tarjeta ajena en el fijado lleva el nombre de quien la mandó', () => {
      abrir([mensaje('m-1', 'pp-2', TARJETA)]);
      expect(consultar('hilo-contexto-fijado-autor')?.textContent).toContain('Enviada por Dra. Quispe');
    });

    it('con una tarjeta, la cabecera dice de qué se habla sin repetir la farmacia del nombre', () => {
      abrir([mensaje('m-1', 'pp-1', TARJETA)]);
      const estado = fixture.nativeElement.querySelector('.hilo__estado') as HTMLElement;
      // Tarjeta de antes del número corto: sólo «Pedido».
      expect(estado.textContent?.trim()).toBe('Pedido');
      expect(estado.textContent).not.toContain('Farmacia Chávez');
    });

    it('con el número corto en la tarjeta, la cabecera dice qué pedido es', () => {
      abrir([
        mensaje(
          'm-1',
          'pp-1',
          'Pedido: #E5F6 · Farmacia Chávez · Sucursal Miraflores\n2 productos · Bs 69,00\n/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
        ),
      ]);
      const estado = fixture.nativeElement.querySelector('.hilo__estado') as HTMLElement;
      expect(estado.textContent?.trim()).toBe('Pedido · #E5F6');
    });

    it('sin tarjeta ni dato de presencia, la cabecera no inventa un subtítulo', () => {
      abrir([mensaje('m-1', 'pp-2', 'Hola')]);
      expect(fixture.nativeElement.querySelector('.hilo__estado')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Conversación directa');
    });

    it('como la farmacia, sobre el composer dice en nombre de quién se responde', () => {
      abrir([mensaje('m-1', 'pp-2', 'Hola')]);
      expect(consultar('hilo-respondiendo-como')).toBeNull();

      store.vitrinasDeOrganizacion.set([{ profileId: 'pp-1', nombre: 'Farmacia Vida' }]);
      fixture.detectChanges();
      expect(consultar('hilo-respondiendo-como')?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
        'Respondiendo como Farmacia Vida',
      );
    });

    it('la barra fijada se recoge mientras la tarjeta original está a la vista', async () => {
      let avisar: ((entradas: readonly Partial<IntersectionObserverEntry>[]) => void) | null = null;
      const observadas: Element[] = [];
      class ObservadorFalso {
        constructor(alCambiar: (entradas: IntersectionObserverEntry[]) => void) {
          avisar = (entradas) => alCambiar(entradas as IntersectionObserverEntry[]);
        }
        observe(nodo: Element): void {
          observadas.push(nodo);
        }
        unobserve(): void {
          // Las pruebas sólo miran qué se observa.
        }
        disconnect(): void {
          // Ídem.
        }
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      }
      vi.stubGlobal('IntersectionObserver', ObservadorFalso);
      try {
        fixture.destroy();
        fixture = TestBed.createComponent(Thread);
        fixture.detectChanges();
        abrir([mensaje('m-1', 'pp-1', TARJETA)]);
        await fixture.whenStable();
        fixture.detectChanges();

        const tarjeta = consultar('hilo-contexto')?.closest('[data-clave]') ?? null;
        expect(tarjeta).not.toBeNull();
        expect(observadas).toContain(tarjeta);
        const fijado = (): HTMLElement | null => consultar('hilo-contexto-fijado');
        expect(fijado()?.classList.contains('is-recogido')).toBe(false);

        avisar!([{ target: tarjeta!, isIntersecting: true, intersectionRatio: 1 }]);
        fixture.detectChanges();
        expect(fijado()?.classList.contains('is-recogido')).toBe(true);
        // Sigue siendo el mismo nodo, con lo que dice: sólo se recoge.
        expect(fijado()?.textContent).toContain('Consulta sobre: Pedido');

        avisar!([{ target: tarjeta!, isIntersecting: false, intersectionRatio: 0 }]);
        fixture.detectChanges();
        expect(fijado()?.classList.contains('is-recogido')).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('quien atiende como la farmacia abre el pedido en su bandeja, no en «mis pedidos»', () => {
      abrir([mensaje('m-1', 'pp-2', TARJETA)]);
      store.vitrinasDeOrganizacion.set([{ profileId: 'pp-1', nombre: 'Farmacia Chávez' }]);
      fixture.detectChanges();

      expect(consultar('hilo-contexto-ver')?.getAttribute('href')).toBe('/administration/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6');
      expect(consultar('hilo-contexto-fijado-ver')?.getAttribute('href')).toBe(
        '/administration/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
      );
    });
  });

  /* --- Fotos: grilla, esqueleto y visor ----------------------------------- */

  describe('fotos', () => {
    const foto = (n: number, autor = 'pp-2') => ({
      ...mensaje(`m-${n}`, autor, ''),
      bodyText: null,
      contentTypeConceptId: 'c-media',
      attachmentFileId: `f-${n}`,
      sentAt: `2026-08-18T10:0${n}:00.000Z`,
    });

    const png = (): Blob => new Blob([new Uint8Array(16).fill(7)], { type: 'image/png' });

    /** Sirve todos los adjuntos pedidos y espera a que el store los tenga. */
    const servirTodos = async (ids: readonly string[]): Promise<void> => {
      fixture.detectChanges();
      for (const id of ids) {
        http.expectOne((r) => r.url.includes(`/attachments/${id}/content`)).flush(png());
      }
      for (let i = 0; i < 100 && ids.some((id) => !store.urlDe(id)); i += 1) {
        await new Promise((listo) => setTimeout(listo, 5));
      }
      fixture.detectChanges();
    };

    it('mientras el adjunto baja hay esqueleto, no «Subiendo»', () => {
      abrir([foto(1)]);
      fixture.detectChanges();

      expect(consultar('hilo-adjunto-cargando')).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Subiendo el archivo');
      http.match((r) => r.url.includes('/attachments/')).forEach((p) => p.flush(png()));
    });

    it('cinco fotos seguidas del mismo autor van en una grilla 2×2 con «+1»', async () => {
      abrir([foto(5), foto(4), foto(3), foto(2), foto(1)]);
      await servirTodos(['f-1', 'f-2', 'f-3', 'f-4', 'f-5']);

      const galerias = fixture.nativeElement.querySelectorAll('[data-testid="hilo-galeria"]');
      expect(galerias).toHaveLength(1);
      expect(galerias[0].querySelectorAll('[data-testid="hilo-imagen"]')).toHaveLength(4);
      expect(consultar('hilo-galeria-mas')?.textContent?.trim()).toBe('+1');
      // Ninguna quedó suelta como burbuja aparte.
      expect(burbujas()).toHaveLength(0);
    });

    it('una foto sola, o con otra persona en el medio, no se agrupa', async () => {
      abrir([foto(3), foto(2, 'pp-1'), foto(1)]);
      await servirTodos(['f-1', 'f-2', 'f-3']);

      expect(consultar('hilo-galeria')).toBeNull();
      expect(burbujas().every((b) => b.classList.contains('is-solo-imagen'))).toBe(true);
    });

    it('tocar una foto de la grilla abre el visor en ella y ← → recorren todas', async () => {
      abrir([foto(5), foto(4), foto(3), foto(2), foto(1)]);
      await servirTodos(['f-1', 'f-2', 'f-3', 'f-4', 'f-5']);

      const celdas = fixture.nativeElement.querySelectorAll('[data-testid="hilo-imagen"]');
      (celdas[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(consultar('hilo-visor-posicion')?.textContent?.trim()).toBe('2 de 5');
      consultar('hilo-visor')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();
      expect(consultar('hilo-visor-posicion')?.textContent?.trim()).toBe('5 de 5');

      (consultar('hilo-visor-cerrar') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(consultar('hilo-visor')).toBeNull();
    });

    it('el visor sigue en la misma foto cuando llega una página anterior', async () => {
      abrir([foto(3), foto(2)], 'cursor-1');
      await servirTodos(['f-2', 'f-3']);

      // Se abre la segunda de dos: f-3, la del mensaje m-3.
      const imagenes = fixture.nativeElement.querySelectorAll('[data-testid="hilo-imagen"]');
      (imagenes[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(consultar('hilo-visor-posicion')?.textContent?.trim()).toBe('2 de 2');

      // Llega la historia con una foto más vieja: se corre el índice, no la foto.
      store.cargarAnteriores();
      http
        .expectOne((r) => r.url === '/community/conversations/c-1/messages')
        .flush({ items: [foto(1)], count: 1, limit: 30, nextCursor: null });
      await servirTodos(['f-1']);

      expect(consultar('hilo-visor-posicion')?.textContent?.trim()).toBe('3 de 3');
      (consultar('hilo-visor-responder') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(store.respondiendoA()?.id).toBe('m-3');
    });

    it('una foto propia en el visor dice «Vos», en voseo como el resto de la app', async () => {
      abrir([foto(1, 'pp-1')]);
      await servirTodos(['f-1']);

      (consultar('hilo-imagen') as HTMLButtonElement).click();
      fixture.detectChanges();
      const pie = fixture.nativeElement.querySelector('.visor__autor') as HTMLElement | null;
      expect(pie?.textContent?.trim()).toMatch(/^Vos · /u);
      expect(fixture.nativeElement.textContent).not.toContain('Tú');
    });

    it('responder desde el visor deja la cita de esa foto en el composer', async () => {
      abrir([foto(2), foto(1)]);
      await servirTodos(['f-1', 'f-2']);

      (fixture.nativeElement.querySelector('[data-testid="hilo-imagen"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      (consultar('hilo-visor-responder') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(consultar('hilo-visor')).toBeNull();
      expect(store.respondiendoA()?.id).toBe('m-1');
    });
  });

  /* --- Reacciones, recibos, info del mensaje y bloqueo ------------------- */

  describe('reacciones, recibos y bloqueo', () => {
    const originalMockBackend = environment.mockBackend;
    beforeEach(() => {
      Object.assign(environment, { mockBackend: true });
    });
    afterEach(() => {
      Object.assign(environment, { mockBackend: originalMockBackend });
    });

    const propio = (id: string, extra: Record<string, unknown> = {}) => ({
      ...mensaje(id, 'pp-1', 'Hola doctora'),
      sentAt: new Date(Date.now() - 3_600_000).toISOString(),
      ...extra,
    });

    const abrirMenu = (): void => {
      (consultar('hilo-menu-mensaje') as HTMLElement).click();
      fixture.detectChanges();
    };

    it('la barra del menú ofrece las seis reacciones rápidas y «+»', () => {
      abrir([propio('m-1')]);
      abrirMenu();

      const rapidas = fixture.nativeElement.querySelectorAll('[data-testid="hilo-reaccion-rapida"]');
      expect(rapidas.length).toBe(6);
      expect(consultar('hilo-reaccion-mas')).not.toBeNull();
    });

    it('reaccionar pinta la reacción antes de que conteste el servidor y manda el emoji', () => {
      abrir([propio('m-1')]);
      abrirMenu();

      (fixture.nativeElement.querySelector('[data-testid="hilo-reaccion-rapida"]') as HTMLElement).click();
      fixture.detectChanges();

      // Optimista: la burbuja ya la lleva.
      expect(consultar('hilo-reaccion')?.textContent).toContain('👍');
      const pedido = http.expectOne(
        (r) => r.method === 'PUT' && r.url === '/community/conversations/c-1/messages/m-1/reaction',
      );
      expect(pedido.request.body).toEqual({ profileId: 'pp-1', emoji: '👍' });
      pedido.flush({
        ...propio('m-1'),
        reactions: [{ emoji: '👍', profileIds: ['pp-1'] }],
      });
    });

    it('si el servidor rechaza la reacción, se revierte', () => {
      abrir([propio('m-1')]);
      abrirMenu();
      (fixture.nativeElement.querySelector('[data-testid="hilo-reaccion-rapida"]') as HTMLElement).click();
      fixture.detectChanges();

      http
        .expectOne((r) => r.method === 'PUT')
        .flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(consultar('hilo-reaccion')).toBeNull();
    });

    it('tocar la reacción propia en la burbuja la quita (emoji null)', () => {
      abrir([
        propio('m-1', { reactions: [{ emoji: '❤️', profileIds: ['pp-1', 'pp-2'] }] }),
      ]);
      expect(consultar('hilo-reaccion')?.textContent).toContain('2');

      (consultar('hilo-reaccion') as HTMLElement).click();
      fixture.detectChanges();

      const pedido = http.expectOne((r) => r.method === 'PUT');
      expect(pedido.request.body).toEqual({ profileId: 'pp-1', emoji: null });
      pedido.flush({ ...propio('m-1'), reactions: [{ emoji: '❤️', profileIds: ['pp-2'] }] });
    });

    it('sin recibos un mensaje propio sólo puede estar enviado: no se inventa «entregado»', () => {
      abrir([propio('m-1')]);

      expect(consultar('hilo-ticks')?.getAttribute('data-estado')).toBe('enviado');
    });

    it('con recibos de entrega pasa a «entregado»; con lectura, a «leído»', () => {
      abrir([
        propio('m-1', {
          receipts: [{ profileId: 'pp-2', deliveredAt: '2026-08-18T10:00:01.000Z', readAt: null }],
        }),
        propio('m-2', {
          receipts: [
            {
              profileId: 'pp-2',
              deliveredAt: '2026-08-18T10:00:01.000Z',
              readAt: '2026-08-18T10:02:00.000Z',
            },
          ],
        }),
      ]);

      const estados = Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="hilo-ticks"]'),
      ).map((n) => (n as HTMLElement).getAttribute('data-estado'));
      // El contrato entrega del más reciente al más antiguo y el hilo se lee al
      // revés: m-2 (leído) queda arriba de m-1 (entregado).
      expect(estados).toEqual(['leido', 'entregado']);
    });

    it('«Info. del mensaje» muestra cuándo se envió, se entregó y se leyó', () => {
      abrir([
        propio('m-1', {
          receipts: [
            {
              profileId: 'pp-2',
              deliveredAt: '2026-08-18T10:00:01.000Z',
              readAt: '2026-08-18T10:02:00.000Z',
            },
          ],
        }),
      ]);
      abrirMenu();

      (consultar('hilo-info') as HTMLElement).click();
      fixture.detectChanges();

      expect(consultar('info-enviado')?.textContent?.trim()).not.toBe('');
      expect(consultar('info-entregado')?.textContent?.trim()).not.toBe('—');
      expect(consultar('info-leido')?.textContent?.trim()).not.toBe('—');
    });

    it('«Info. del mensaje» no se ofrece en el mensaje de otro', () => {
      abrir([{ ...mensaje('m-1', 'pp-2', 'Suyo'), sentAt: new Date().toISOString() }]);
      abrirMenu();

      expect(consultar('hilo-info')).toBeNull();
    });

    it('un sticker propio marcado como STICKER se dibuja sin burbuja', () => {
      abrir([
        {
          ...propio('m-1', { bodyText: '', attachmentFileId: 'f-9', contentType: 'STICKER' }),
        },
      ]);

      expect(burbujas()[0].classList.contains('is-sticker')).toBe(true);
    });

    it('con la persona bloqueada el campo de escribir se cambia por el aviso y no se puede enviar', () => {
      abrir([propio('m-1')]);
      store.bloqueados.set([{ profileId: 'pp-2', displayName: 'Dra. Quispe', desde: new Date() }]);
      fixture.detectChanges();

      expect(consultar('hilo-bloqueado')).not.toBeNull();
      expect(consultar('hilo-texto')).toBeNull();

      store.enviar('hola');
      http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/messages'));
    });

    it('bloquear pide confirmación y manda POST /community/blocks', () => {
      abrir([propio('m-1')]);
      (consultar('hilo-menu') as HTMLElement).click();
      fixture.detectChanges();
      (consultar('hilo-bloquear') as HTMLElement).click();
      fixture.detectChanges();

      expect(document.querySelector('[data-testid="thread-block-dialog"]')).not.toBeNull();
      (document.querySelector('[data-testid="hilo-bloquear-confirmar"]') as HTMLElement).click();
      fixture.detectChanges();

      const pedido = http.expectOne((r) => r.method === 'POST' && r.url === '/community/blocks');
      expect(pedido.request.body).toEqual({ blockerProfileId: 'pp-1', blockedProfileId: 'pp-2' });
      pedido.flush({ id: 'b-1' });
      expect(store.estaBloqueado('pp-2')).toBe(true);
    });
  });
});

describe('Thread · pulsación larga y vacío', () => {
  let fixture: ComponentFixture<Thread>;
  let http: HttpTestingController;
  let store: ChatStore;

  /** Un evento de puntero táctil, armado sobre `MouseEvent` por si el entorno no trae `PointerEvent`. */
  const dedo = (tipo: string, x = 10, y = 10): Event => {
    const evento = new MouseEvent(tipo, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(evento, 'pointerType', { value: 'touch' });
    return evento;
  };

  const abrirCon = (items: unknown[]): void => {
    http.expectOne('/community/profiles/me').flush({
      id: 'pp-1', tenantId: 't-1', targetId: 'hp-1', slug: 'yo', displayName: 'Yo',
      headline: null, biography: null, acceptsReviews: null,
    });
    fixture.detectChanges();
    http.match((r) => r.url === '/community/conversations').forEach((p) =>
      p.flush({
        items: [{ id: 'c-1', conversationTypeConceptId: 'c-direct', groupId: null, lastMessageAt: null,
          messageCount: items.length, lastMessage: null, unreadCount: 0,
          peers: [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }] }],
        count: 1, limit: 50, nextCursor: null,
      }),
    );
    http.match((r) => r.url === '/community/conversations/c-1/messages').forEach((p) =>
      p.flush({ items, count: items.length, limit: 30, nextCursor: null }),
    );
    http.match((r) => r.url === '/community/conversations/c-1/read').forEach((p) =>
      p.flush({ receiptsRecorded: 1, lastReadMessageId: null }),
    );
    fixture.detectChanges();
  };

  const texto = {
    id: 'm-1', conversationId: 'c-1', senderProfileId: 'pp-2', replyToMessageId: null,
    contentTypeConceptId: 'c-text', bodyText: 'Hola', attachmentFileId: null, isEdited: null,
    sentAt: '2026-08-18T10:00:00.000Z',
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
            paramMap: of({ get: (clave: string) => (clave === 'conversationId' ? 'c-1' : null) }),
            queryParamMap: of({ get: () => null }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatStore);
    store.iniciar();
    fixture = TestBed.createComponent(Thread);
    fixture.detectChanges();
  });

  afterEach(() => {
    store.detener();
    http.match(() => true).forEach((pedido) => pedido.flush(null));
  });

  const burbuja = (): HTMLElement =>
    fixture.nativeElement.querySelector('[data-testid="mensaje"]') as HTMLElement;
  const menu = (): HTMLElement | null => burbuja().querySelector('[role="menu"]');

  it('mantener el dedo medio segundo abre el menú del mensaje', async () => {
    abrirCon([texto]);
    burbuja().dispatchEvent(dedo('pointerdown'));
    await new Promise((listo) => setTimeout(listo, 560));
    fixture.detectChanges();
    expect(menu()).not.toBeNull();
  });

  it('si el dedo se mueve —se está desplazando—, no abre nada', async () => {
    abrirCon([texto]);
    burbuja().dispatchEvent(dedo('pointerdown'));
    burbuja().dispatchEvent(dedo('pointermove', 10, 40));
    await new Promise((listo) => setTimeout(listo, 560));
    fixture.detectChanges();
    expect(menu()).toBeNull();
  });

  it('soltar antes de tiempo es un toque, no una pulsación larga', async () => {
    abrirCon([texto]);
    burbuja().dispatchEvent(dedo('pointerdown'));
    burbuja().dispatchEvent(dedo('pointerup'));
    await new Promise((listo) => setTimeout(listo, 560));
    fixture.detectChanges();
    expect(menu()).toBeNull();
  });

  it('el hilo vacío lo dice en castellano correcto', () => {
    abrirCon([]);
    expect(fixture.nativeElement.textContent).toContain('Todavía no se escribió nada');
  });
});

describe('rutaParaQuienMira y subtituloDeContexto', () => {
  const pedido = { tipo: 'pedido', titulo: 'Farmacia Vida', ruta: '/my-account/pharmacy-orders/o-1' } as const;

  it('el paciente va a su pedido y la farmacia a su bandeja', () => {
    expect(rutaParaQuienMira(pedido, false)).toBe('/my-account/pharmacy-orders/o-1');
    expect(rutaParaQuienMira(pedido, true)).toBe('/administration/pharmacy-orders/o-1');
  });

  it('las fichas públicas valen igual para los dos lados', () => {
    const producto = { tipo: 'producto', titulo: 'Paracetamol', ruta: '/pharmacies-directory/vida' } as const;
    expect(rutaParaQuienMira(producto, true)).toBe('/pharmacies-directory/vida');
  });

  it('sin ruta equivalente no se ofrece enlace', () => {
    expect(rutaParaQuienMira({ ...pedido, ruta: '/my-account/pharmacy-orders/o-1/receipt' }, true)).toBeNull();
  });

  it('el subtítulo dice de qué se habla', () => {
    expect(subtituloDeContexto(pedido)).toBe('Pedido');
    expect(subtituloDeContexto({ ...pedido, titulo: '#22BE · Farmacia Vida · Sucursal Central' })).toBe('Pedido · #22BE');
    expect(subtituloDeContexto({ tipo: 'producto', titulo: 'Paracetamol', ruta: '/x' })).toBe('Consulta por Paracetamol');
    // La farmacia ya es el nombre de la cabecera: no se repite.
    expect(subtituloDeContexto({ tipo: 'farmacia', titulo: 'Farmacia Vida', ruta: '/x' })).toBe('Consulta a la farmacia');
  });
});

describe('indiceDelPrimerNoLeido', () => {
  const de = (...autores: string[]) => autores.map((senderProfileId) => ({ senderProfileId }));

  it('cuenta los últimos ajenos desde el final', () => {
    expect(indiceDelPrimerNoLeido(de('yo', 'ella', 'ella'), 'yo', 2)).toBe(1);
  });

  it('lo que uno manda con el hilo abierto no corre el separador', () => {
    // Un ajeno sin leer y, después, una respuesta propia: el separador va
    // delante del ajeno, no delante de la respuesta.
    expect(indiceDelPrimerNoLeido(de('ella', 'yo', 'ella', 'yo'), 'yo', 1)).toBe(2);
  });

  it('sin no leídos, o con más de los que hay, no hay separador', () => {
    expect(indiceDelPrimerNoLeido(de('ella'), 'yo', 0)).toBe(-1);
    expect(indiceDelPrimerNoLeido(de('ella', 'yo'), 'yo', 2)).toBe(-1);
  });
});

