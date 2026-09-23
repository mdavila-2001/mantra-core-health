import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Thread, trocear } from './thread';
import { ChatStore } from '../../../core/messaging/chat.store';
import { ChatPreferencias } from '../../../core/messaging/chat-preferencias';
import { PACK_DE_STICKERS } from '../../../core/messaging/sticker-pack.generated';

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

    // Se deja el navegador como estaba: las preferencias viven en localStorage.
    preferencias.alternarArchivado('c-1');
  });

  it('buscar en la conversación deja sólo las coincidencias, resaltadas', () => {
    abrir([
      mensaje('m-3', 'pp-2', 'Te mando el Holter mañana'),
      mensaje('m-2', 'pp-1', 'Perfecto, gracias'),
      mensaje('m-1', 'pp-2', 'Hola, ¿pudiste ver el hólter?'),
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
    const trozos = trocear('Mirá https://alovida.bo/mi-historia y avisame', 'historia');
    expect(trozos).toEqual([
      { tipo: 'texto', valor: 'Mirá ' },
      { tipo: 'enlace', valor: 'https://alovida.bo/mi-historia' },
      { tipo: 'texto', valor: ' y avisame' },
    ]);

    abrir([mensaje('m-1', 'pp-2', 'Entrá a https://alovida.bo/turnos')]);
    const enlace = fixture.nativeElement.querySelector('a.hilo__enlace') as HTMLAnchorElement | null;
    expect(enlace?.getAttribute('href')).toBe('https://alovida.bo/turnos');
    expect(enlace?.getAttribute('rel')).toContain('noopener');
  });

  it('reenviar manda el mismo texto a la conversación elegida', () => {
    abrir([mensaje('m-1', 'pp-2', 'Te dejo la orden en la historia clínica')]);
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
      bodyText: 'Te dejo la orden en la historia clínica',
    });
    enviado.flush({ id: 'm-9', conversationId: 'c-2', sentAt: '2026-08-18T12:00:00.000Z' });
    fixture.detectChanges();

    expect(consultar('hilo-aviso')?.textContent).toContain('Reenviado a Dr. Ortega');
    // El hilo abierto no cambió: el mensaje fue a otra conversación.
    expect(burbujas().length).toBe(1);
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

    it('no lo ofrece pasados los cinco minutos', () => {
      abrir([propioReciente('m-1', 6 * 60_000, 'Viejo')]);
      abrirMenu();

      expect(consultar('hilo-editar')).toBeNull();
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
      abrir([conAdjunto('m-2', 'f-roto'), mensaje('m-1', 'pp-1', 'Te lo mando')]);
      await servir('f-roto', null, true);

      expect(fixture.nativeElement.textContent).toContain('Archivo no disponible');
      expect(fixture.nativeElement.textContent).toContain('Te lo mando');
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
});
