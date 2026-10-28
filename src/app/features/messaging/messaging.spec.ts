import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

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

    // El favorito y el archivado viven en `localStorage`: sin limpiarlo, lo que
    // marca una prueba se lo encuentra la siguiente.
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

    expect(todas('conversacion').length).toBe(1);
    expect(texto()).not.toContain('Dra. Quispe');
    expect(consultar('mensajeria-archivados')).not.toBeNull();

    consultar('mensajeria-archivados')?.click();
    fixture.detectChanges();

    // En el cajón está la archivada, y sólo ella.
    expect(todas('conversacion').length).toBe(1);
    expect(texto()).toContain('Dra. Quispe');
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

  it('si la primera lectura falla, ofrece reintentar y no dice «no tenés chats»', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    // Antes de la respuesta: esqueletos (S2), no un vacío.
    expect(consultar('bandeja-cargando')).not.toBeNull();

    http
      .expectOne((r) => r.url === '/community/conversations')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(consultar('bandeja-error')).not.toBeNull();
    expect(consultar('bandeja-vacia')).toBeNull();

    consultar('bandeja-reintentar')?.click();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items: [],
      count: 0,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    // Leída de verdad y sin nada: ahora sí, el vacío con su próxima acción.
    expect(consultar('bandeja-error')).toBeNull();
    expect(consultar('bandeja-vacia')).not.toBeNull();
  });

  function escribir(valor: string): void {
    const campo = consultar('mensajeria-consulta') as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});

/**
 * El `?escribirA=` con contexto con el que llegan los botones del marketplace.
 *
 * Fija que la bandeja le pasa al store **el contexto ya validado** y que, al
 * abrir, navega al hilo reemplazando la dirección y sin arrastrar los
 * parámetros: es lo que impide que un refresco vuelva a mandar la tarjeta.
 */
describe('Messaging — llegar con contexto', () => {
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

  const montarEn = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    const store = TestBed.inject(ChatStore);
    const escribirA = vi
      .spyOn(store, 'escribirA')
      .mockImplementation((_slug, alAbrir) => alAbrir('c-9'));
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Messaging);
    fixture.detectChanges();
    return { escribirA, navegar };
  };

  afterEach(() => {
    TestBed.inject(ChatStore).detener();
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((pedido) => pedido.flush(null));
  });

  it('pasa el contexto validado y abre el hilo sin los parámetros', async () => {
    const { escribirA, navegar } = await montarEn(
      '/messaging?escribirA=farmacia-vida&sobre=pedido' +
        '&titulo=Farmacia%20Vida%20%C2%B7%20Central&detalle=2%20productos' +
        '&ruta=%2Fmy-account%2Fpharmacy-orders%2Fo-1',
    );

    expect(escribirA).toHaveBeenCalledTimes(1);
    expect(escribirA.mock.calls[0]?.[0]).toBe('farmacia-vida');
    expect(escribirA.mock.calls[0]?.[2]).toEqual({
      tipo: 'pedido',
      titulo: 'Farmacia Vida · Central',
      detalle: '2 productos',
      ruta: '/my-account/pharmacy-orders/o-1',
    });
    expect(navegar).toHaveBeenCalledWith(['/messaging', 'c-9'], { replaceUrl: true });
  });

  it('?pedido=<id> le pide el hilo a la API del pedido, no a la bandeja', async () => {
    const { escribirA, navegar } = await montarEn(
      '/messaging?pedido=o-1&sobre=pedido&titulo=Farmacia%20Vida&ruta=%2Fmy-account%2Fpharmacy-orders%2Fo-1',
    );
    const store = TestBed.inject(ChatStore);
    expect(escribirA).not.toHaveBeenCalled();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/pharmacy/orders/o-1/conversation')
      .flush({ conversationId: 'c-7', pharmacyProfileId: 'pp-f' });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/community/conversations/c-7/messages')
      .flush({ items: [], count: 0, limit: 30, nextCursor: null });
    const envio = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/community/conversations/c-7/messages',
    );
    expect(envio.request.body.bodyText).toBe('Pedido: Farmacia Vida\n/my-account/pharmacy-orders/o-1');
    envio.flush({ id: 'm-1', conversationId: 'c-7', sentAt: '2026-09-08T10:00:00.000Z' });
    expect(navegar).toHaveBeenCalledWith(['/messaging', 'c-7'], { replaceUrl: true });
    expect(store.error()).toBe('');
  });

  it('un contexto que apunta afuera se descarta: abre el hilo sin tarjeta', async () => {
    const { escribirA } = await montarEn(
      '/messaging?escribirA=farmacia-vida&sobre=producto&titulo=X&ruta=https%3A%2F%2Fotro.example',
    );

    expect(escribirA).toHaveBeenCalledTimes(1);
    expect(escribirA.mock.calls[0]?.[2]).toBeUndefined();
  });
});
