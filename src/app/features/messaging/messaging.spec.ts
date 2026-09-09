import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Messaging } from './messaging';
import { ChatStore } from '../../core/messaging/chat.store';
import { ChatPreferencias } from '../../core/messaging/chat-preferencias';

/**
 * Lo que estas pruebas fijan.
 *
 * Que **el perfil público no es el de la sesión** —hay que preguntárselo al
 * backend, y no tenerlo es un estado legítimo con salida—, que la bandeja dice
 * **con quién** es cada conversación (y que sin nombre no muestra un uuid), y
 * que el buscador de arriba hace las dos cosas que hace el de WhatsApp: filtra
 * los chats que ya tenés y ofrece gente a la que todavía no le escribiste.
 *
 * Los filtros y el archivado también se fijan acá: son estado de vista que hoy
 * vive en el navegador, y lo único que impide que se rompan al migrarlos a la
 * API el día que el backend tenga las columnas es una prueba que diga qué
 * tienen que hacer.
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
  const todas = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));

  const montar = (): void => {
    fixture = TestBed.createComponent(Messaging);
    fixture.detectChanges();
  };

  /** Monta, resuelve el perfil y deja la bandeja con lo que se le pase. */
  const conBandeja = (items: unknown[]): void => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items,
      count: items.length,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();
  };

  beforeEach(() => {
    // El buscador espera 300 ms antes de preguntarle al directorio, y el store
    // reencola su sondeo con `setTimeout`. Con relojes falsos las dos cosas
    // pasan cuando la prueba lo dice, no cuando quiera la máquina.
    vi.useFakeTimers();

    // Los emojis recientes viven en `localStorage` (y antes de F4.4 también
    // favoritos y archivados): sin limpiarlo, lo que deja una prueba se lo
    // encuentra la siguiente.
    localStorage.removeItem('alovida.chat-preferencias');

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
    TestBed.inject(ChatStore).detener();
    vi.useRealTimers();
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
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Marisol Quispe' }], 2),
    ]);

    expect(texto()).toContain('Dra. Marisol Quispe');
    expect(texto()).toContain('Hola, ¿cómo seguís?');
    expect(consultar('conversacion-sin-leer')?.textContent?.trim()).toBe('2');
  });

  it('sin nombre resuelto dice «Conversación» y nunca un uuid', () => {
    conBandeja([conversacion('c-1', [{ profileId: 'pp-9', displayName: null }])]);

    expect(texto()).toContain('Conversación');
    expect(texto()).not.toContain('pp-9');
  });

  it('el buscador filtra los chats que ya tenés, sin pedirle nada al servidor', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Marisol Quispe' }]),
      conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Lic. Ana Rojas' }]),
    ]);

    escribir('rojas');
    // Filtrar lo propio es local: pedirle al servidor que filtre una lista que
    // ya está en memoria haría parpadear la bandeja en cada tecla.
    expect(todas('conversacion').length).toBe(1);
    expect(texto()).toContain('Lic. Ana Rojas');
    expect(texto()).not.toContain('Marisol');

    // Y al directorio todavía no le preguntó nada: la consulta espera a que
    // la persona deje de escribir.
    http.expectNone((r) => r.url === '/public/search/practitioners');

    vi.advanceTimersByTime(300);
    http.expectOne((r) => r.url === '/public/search/practitioners').flush({ items: [] });
  });

  it('escribirle a alguien nuevo resuelve el slug y después abre el hilo', () => {
    conBandeja([]);

    escribir('marisol');
    vi.advanceTimersByTime(300);
    http
      // Sin el prefijo `/community`: lo sirve `CommunityPublicController`,
      // pero registrado sin prefijo de módulo. Con el prefijo la API responde
      // 404, que es el defecto que arregló este carril.
      .expectOne((r) => r.url === '/public/search/practitioners')
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

  it('el filtro «No leídos» deja sólo las que tienen pendientes', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Con pendientes' }], 3),
      conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Al día' }], 0),
    ]);

    expect(todas('conversacion').length).toBe(2);

    consultar('mensajeria-filtro-no-leidos')?.click();
    fixture.detectChanges();

    expect(todas('conversacion').length).toBe(1);
    expect(texto()).toContain('Con pendientes');
    expect(texto()).not.toContain('Al día');
  });

  it('lo archivado sale de la lista y vive en su propio cajón', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
      conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Lic. Rojas' }]),
    ]);

    TestBed.inject(ChatPreferencias).alternarArchivado('c-1');
    fixture.detectChanges();

    // F4.4: se pinta en el acto y viaja a la API.
    http
      .expectOne(
        (r) => r.method === 'PATCH' && r.url === '/community/conversations/c-1/participant',
      )
      .flush({ conversationId: 'c-1', isFavorite: false, isPinned: false, archivedAt: '2026-09-09T10:00:00.000Z' });
    fixture.detectChanges();

    expect(todas('conversacion').length).toBe(1);
    expect(texto()).not.toContain('Dra. Quispe');
    expect(consultar('mensajeria-archivados')).not.toBeNull();

    consultar('mensajeria-archivados')?.click();
    fixture.detectChanges();

    // En el cajón está la archivada, y sólo ella.
    expect(todas('conversacion').length).toBe(1);
    expect(texto()).toContain('Dra. Quispe');
  });

  /* --- F4.3 / F4.4 -------------------------------------------------------- */

  it('lo que la API dice fijado y favorito se ve así, y lo fijado va primero', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
      { ...conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Lic. Rojas' }]), isPinned: true, isFavorite: true },
    ]);

    const filas = todas('conversacion');
    expect(filas.length).toBe(2);
    expect(todas('conversacion-fijada').length).toBe(1);
    expect(TestBed.inject(ChatPreferencias).esFavorito('c-2')).toBe(true);

    // Al cambiar el orden localmente (favorito de una no fijada) la fijada sigue arriba.
    TestBed.inject(ChatPreferencias).alternarFavorito('c-1');
    fixture.detectChanges();
    http
      .expectOne((r) => r.method === 'PATCH' && r.url === '/community/conversations/c-1/participant')
      .flush({ conversationId: 'c-1', isFavorite: true, isPinned: false, archivedAt: null });
    fixture.detectChanges();
    const nombres = todas('conversacion').map((f) => f.textContent ?? '');
    expect(nombres[0]).toContain('Lic. Rojas');
  });

  it('si la API rechaza el cambio, la fila vuelve a como estaba y se avisa', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
    ]);

    TestBed.inject(ChatPreferencias).alternarFavorito('c-1');
    fixture.detectChanges();
    expect(TestBed.inject(ChatPreferencias).esFavorito('c-1')).toBe(true);

    http
      .expectOne((r) => r.method === 'PATCH' && r.url === '/community/conversations/c-1/participant')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(TestBed.inject(ChatPreferencias).esFavorito('c-1')).toBe(false);
    expect(texto()).toContain('No pudimos guardar el cambio');
  });

  it('el doble tilde de la fila sólo cuando la API dice que el otro leyó', () => {
    const propio = (id: string, leido: boolean | null) => ({
      ...conversacion(id, [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
      lastMessage: { id: 'm-1', senderProfileId: 'pp-1', bodyText: 'Gracias', sentAt: '2026-08-18T10:00:00.000Z' },
      lastMessageReadByPeer: leido,
    });
    conBandeja([propio('c-1', true), propio('c-2', false), propio('c-3', null)]);

    const ticks = todas('conversacion-tick');
    expect(ticks.length).toBe(3);
    expect(ticks[0].classList.contains('is-leido')).toBe(true);
    expect(ticks[1].classList.contains('is-leido')).toBe(false);
    expect(ticks[2].classList.contains('is-leido')).toBe(false);
  });

  it('con más páginas ofrece «cargar más» y las suma sin repetir', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items: [conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])],
      count: 1,
      limit: 50,
      nextCursor: 'cur-1',
    });
    fixture.detectChanges();

    expect(consultar('mensajeria-cargar-mas')).not.toBeNull();
    consultar('mensajeria-cargar-mas')?.click();
    fixture.detectChanges();

    const siguiente = http.expectOne(
      (r) => r.url === '/community/conversations' && r.params.get('cursor') === 'cur-1',
    );
    siguiente.flush({
      items: [
        conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
        conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Lic. Rojas' }]),
      ],
      count: 2,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    expect(todas('conversacion').length).toBe(2);
    expect(consultar('mensajeria-cargar-mas')).toBeNull();
  });

  it('lo marcado en el navegador antes de F4.4 sube a la API una sola vez', () => {
    localStorage.setItem(
      'alovida.chat-preferencias',
      JSON.stringify({ favoritos: ['c-1'], archivados: ['c-2'], emojis: ['😀'] }),
    );
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
      conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Lic. Rojas' }]),
    ]);
    // El efecto de migración corre después de la carga.
    TestBed.inject(ChatPreferencias);
    fixture.detectChanges();

    const pedidos = http.match(
      (r) => r.method === 'PATCH' && r.url.endsWith('/participant'),
    );
    expect(pedidos.map((p) => [p.request.url, p.request.body])).toEqual([
      ['/community/conversations/c-1/participant', { profileId: 'pp-1', isFavorite: true }],
      ['/community/conversations/c-2/participant', { profileId: 'pp-1', archived: true }],
    ]);
    pedidos.forEach((p) => p.flush(null));

    // Y el navegador se olvida de favoritos y archivados; los emojis quedan.
    const guardado = JSON.parse(localStorage.getItem('alovida.chat-preferencias') ?? '{}');
    expect(guardado.favoritos).toBeUndefined();
    expect(guardado.archivados).toBeUndefined();
    expect(guardado.emojis).toEqual(['😀']);
  });

  it('no borra la bandeja cuando un tic falla', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
    ]);

    TestBed.inject(ChatStore).recargarBandeja();
    http
      .expectOne((r) => r.url === '/community/conversations')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto()).toContain('Dra. Quispe');
    expect(texto()).toContain('No pudimos cargar tus conversaciones.');
  });

  function escribir(valor: string): void {
    const campo = consultar('mensajeria-consulta') as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
