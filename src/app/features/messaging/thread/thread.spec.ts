import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Thread } from './thread';

/**
 * Lo que estas pruebas fijan.
 *
 * Que el hilo **se lee al revés de como viaja** —el contrato devuelve del más
 * reciente al más antiguo para poder paginar hacia atrás—, que **abrir es
 * haber leído** (se marca una vez, no una por tic), y que **Enter envía**
 * mientras `Shift+Enter` hace salto de línea.
 */
describe('Thread', () => {
  let fixture: ComponentFixture<Thread>;
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

  const mensaje = (id: string, senderProfileId: string, bodyText: string) => ({
    id,
    conversationId: 'c-1',
    senderProfileId,
    replyToMessageId: null,
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

  /** Contesta lo que la pantalla pide al abrirse. */
  const abrir = (items: unknown[], nextCursor: string | null = null): void => {
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http
      .match((r) => r.url === '/community/conversations/c-1/messages')
      .forEach((pedido) =>
        pedido.flush({ items, count: items.length, limit: 30, nextCursor }),
      );
    // La bandeja, que es de donde sale el nombre del otro lado.
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
            paramMap: of({ get: (clave: string) => (clave === 'conversationId' ? 'c-1' : null) }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Thread);
    fixture.detectChanges();
  });

  afterEach(() => {
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
    (fixture.componentInstance as unknown as { verMas(): void }).verMas();
    http
      .expectOne((r) => r.url === '/community/conversations/c-1/messages')
      .flush({ items: [], count: 0, limit: 30, nextCursor: null });
    fixture.detectChanges();

    http.expectNone((r) => r.url === '/community/conversations/c-1/read');
  });

  it('Enter envía y Shift+Enter no', () => {
    abrir([]);

    // El borrador se fija por la señal y no tecleando el textarea: lo que esta
    // prueba afirma es **qué hace Enter**, no que `ngModel` propague, que es
    // de Angular y ya está probado allá.
    (
      fixture.componentInstance as unknown as {
        borrador: { set(valor: string): void };
      }
    ).borrador.set('Hola doctora');
    fixture.detectChanges();

    const area = consultar('hilo-texto') as HTMLTextAreaElement;
    area.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
    );
    http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/messages'));

    area.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
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

  it('no envía un mensaje vacío', () => {
    abrir([]);

    (consultar('hilo-enviar') as HTMLButtonElement).click();
    http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/messages'));
  });
});
