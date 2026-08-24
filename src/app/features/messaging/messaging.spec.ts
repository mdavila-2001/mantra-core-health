import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Messaging } from './messaging';

/**
 * Lo que estas pruebas fijan.
 *
 * Que **el perfil público no es el de la sesión** —hay que preguntárselo al
 * backend, y no tenerlo es un estado legítimo con salida—, que la bandeja dice
 * **con quién** es cada conversación (y que sin nombre no muestra un uuid), y
 * que abrir un hilo con alguien del directorio son **dos llamadas**: el
 * buscador público devuelve `slug`, no `profileId`.
 */
describe('Messaging', () => {
  let fixture: ComponentFixture<Messaging>;
  let http: HttpTestingController;

  // `badges` y `prestige` viajan siempre en la ficha: el cliente los
  // desestructura para normalizarlos, y una ficha sin ellos no es una ficha
  // que el backend pueda devolver.
  const ficha = (id: string, slug: string) => ({
    id,
    slug,
    tenantId: 't-1',
    targetId: 'hp-1',
    displayName: 'Dra. Marisol Quispe',
    headline: null,
    biography: null,
    acceptsReviews: null,
    badges: [],
    prestige: null,
  });

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

  const conversacion = (
    id: string,
    peers: { profileId: string; displayName: string | null }[],
    unreadCount = 0,
  ) => ({
    id,
    conversationTypeConceptId: 'c-direct',
    groupId: null,
    lastMessageAt: '2026-08-18T10:00:00.000Z',
    messageCount: 3,
    lastMessage: {
      id: 'm-1',
      senderProfileId: 'pp-2',
      bodyText: 'Hola, ¿cómo seguís?',
      sentAt: '2026-08-18T10:00:00.000Z',
    },
    unreadCount,
    peers,
  });

  const texto = (): string => fixture.nativeElement.textContent as string;
  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const montar = (): void => {
    fixture = TestBed.createComponent(Messaging);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true).forEach((pedido) => pedido.flush(null));
    http.verify();
  });

  it('sin perfil público ofrece crearlo acá, no una pantalla rota', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null);
    fixture.detectChanges();

    // Antes esto mandaba a «Mi perfil» a buscar un formulario. Ahora la puerta
    // está en la propia pantalla: quien entra a los chats quiere chatear.
    expect(texto()).toContain('Te falta tu perfil público');
    expect(consultar('mensajeria-crear-perfil')).not.toBeNull();
    // Y no pide la bandeja: no hay a nombre de quién pedirla.
    http.expectNone((r) => r.url === '/community/conversations');
  });

  it('pinta con quién es cada conversación y sus no leídos', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();

    const pedido = http.expectOne((r) => r.url === '/community/conversations');
    expect(pedido.request.params.get('profileId')).toBe('pp-1');
    pedido.flush({
      items: [
        conversacion('c-1', [
          { profileId: 'pp-2', displayName: 'Dra. Marisol Quispe' },
        ], 2),
      ],
      count: 1,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Dra. Marisol Quispe');
    expect(texto()).toContain('Hola, ¿cómo seguís?');
    expect(consultar('conversacion-sin-leer')?.textContent?.trim()).toBe('2');
  });

  it('sin nombre resuelto dice «Conversación» y nunca un uuid', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items: [conversacion('c-1', [{ profileId: 'pp-9', displayName: null }])],
      count: 1,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Conversación');
    expect(texto()).not.toContain('pp-9');
  });

  it('escribirle a alguien resuelve el slug y después abre el hilo', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items: [],
      count: 0,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    consultar('mensajeria-nueva')?.click();
    fixture.detectChanges();
    consultar('mensajeria-buscar')?.click();

    http
      .expectOne((r) => r.url === '/community/public/search/practitioners')
      .flush({
        items: [
          {
            kind: 'PRACTITIONER',
            slug: 'marisol-quispe',
            displayName: 'Dra. Marisol Quispe',
            headline: 'Cardióloga',
            city: 'La Paz',
            verified: true,
          },
        ],
      });
    fixture.detectChanges();

    consultar('mensajeria-resultado')?.click();

    // Primero la ficha: el buscador público no publica identificadores
    // internos, así que el `profileId` hay que resolverlo.
    http
      .expectOne('/community/profiles/by-slug/marisol-quispe')
      .flush(ficha('pp-2', 'marisol-quispe'));

    const abierta = http.expectOne('/community/conversations');
    expect(abierta.request.method).toBe('POST');
    expect(abierta.request.body).toEqual({
      participantProfileIds: ['pp-1', 'pp-2'],
    });
    abierta.flush({ id: 'c-9' });
  });

  it('no borra la bandeja cuando un tic falla', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items: [
        conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
      ],
      count: 1,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    fixture.componentInstance['recargar']();
    http
      .expectOne((r) => r.url === '/community/conversations')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto()).toContain('Dra. Quispe');
    expect(texto()).toContain('No pudimos cargar tus conversaciones.');
  });
});
