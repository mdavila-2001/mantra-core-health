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

  function escribir(valor: string): void {
    const area = consultar('hilo-texto') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
