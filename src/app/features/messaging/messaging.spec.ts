import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
      bodyText: 'Hola, ¿cómo sigue?',
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
    http
      .expectOne((r) => r.url === '/community/conversations')
      .flush({
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
    expect(texto()).toContain('Le falta su perfil público');
    expect(consultar('mensajeria-crear-perfil')).not.toBeNull();
    // Y no pide la bandeja: no hay a nombre de quién pedirla.
    http.expectNone((r) => r.url === '/community/conversations');
  });

  it('pinta con quién es cada conversación y sus no leídos', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Marisol Quispe' }], 2),
    ]);

    expect(texto()).toContain('Dra. Marisol Quispe');
    expect(texto()).toContain('Hola, ¿cómo sigue?');
    expect(consultar('conversacion-sin-leer')?.textContent?.trim()).toBe('2');
  });

  it('sin nombre resuelto dice «Conversación» y nunca un uuid', () => {
    conBandeja([conversacion('c-1', [{ profileId: 'pp-9', displayName: null }])]);

    expect(texto()).toContain('Conversación');
    expect(texto()).not.toContain('pp-9');
  });

  it('el buscador filtra los chats que ya tiene, sin pedirle nada al servidor', () => {
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
    http.expectNone((r) => r.url === '/community/conversations/contacts/search');

    vi.advanceTimersByTime(300);
    const buscar = http.expectOne('/community/conversations/contacts/search');
    expect(buscar.request.method).toBe('POST');
    expect(buscar.request.body).toEqual({ profileId: 'pp-1', q: 'rojas', limit: 10 });
    buscar.flush({ items: [] });
  });

  it('encuentra una paciente por nombre y abre el hilo con su perfil', () => {
    conBandeja([]);

    escribir('maría');
    vi.advanceTimersByTime(300);
    http.expectOne('/community/conversations/contacts/search').flush({
      items: [
        {
          profileId: 'pp-8',
          displayName: 'María Pérez',
          headline: 'Paciente',
          avatarUrl: null,
        },
      ],
    });
    fixture.detectChanges();

    consultar('mensajeria-resultado')?.click();

    const abierta = http.expectOne('/community/conversations');
    expect(abierta.request.method).toBe('POST');
    expect(abierta.request.body).toEqual({ participantProfileIds: ['pp-1', 'pp-8'] });
    abierta.flush({ id: 'c-9' });
    http.expectNone((r) => r.url.startsWith('/community/profiles/by-slug/'));
  });

  it('una respuesta vieja no reemplaza los resultados de la búsqueda actual', () => {
    conBandeja([]);

    escribir('maría');
    vi.advanceTimersByTime(300);
    const vieja = http.expectOne('/community/conversations/contacts/search');

    escribir('juan');
    vieja.flush({
      items: [
        { profileId: 'pp-8', displayName: 'María Pérez', headline: null, avatarUrl: null },
      ],
    });
    fixture.detectChanges();

    // La tecla nueva invalida en el acto la solicitud anterior; no espera los
    // 300 ms del debounce para saber que «maría» ya no es la búsqueda vigente.
    expect(texto()).not.toContain('María Pérez');

    vi.advanceTimersByTime(300);
    const actual = http.expectOne('/community/conversations/contacts/search');
    actual.flush({
      items: [
        { profileId: 'pp-9', displayName: 'Juan Pérez', headline: null, avatarUrl: null },
      ],
    });
    fixture.detectChanges();

    expect(texto()).toContain('Juan Pérez');
    expect(texto()).not.toContain('María Pérez');
  });

  it('?escribirA= que llega antes que el perfil propio espera y abre el hilo igual', async () => {
    // «Hablar con el broker» y «Enviar mensaje» llegan con la URL ya puesta:
    // la ruta se lee antes de saber quién es la sesión, y antes se descartaba
    // en silencio —quedaba la bandeja abierta sin hilo—.
    await TestBed.inject(Router).navigateByUrl('/messaging?escribirA=broker-oriente');
    montar();

    // Sin perfil propio todavía no se pregunta por el slug.
    http.expectNone('/community/profiles/by-slug/broker-oriente');

    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();

    http
      .expectOne('/community/profiles/by-slug/broker-oriente')
      .flush(ficha('pp-7', 'broker-oriente'));
    const abierta = http.expectOne(
      (r) => r.url === '/community/conversations' && r.method === 'POST',
    );
    expect(abierta.request.body).toEqual({ participantProfileIds: ['pp-1', 'pp-7'] });
    abierta.flush({ id: 'c-7' });
  });

  it('?escribirA= abre el hilo reemplazando la entrada, para que «Volver» salga del chat', async () => {
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate');
    await router.navigateByUrl('/messaging?escribirA=broker-oriente');
    montar();

    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http
      .expectOne('/community/profiles/by-slug/broker-oriente')
      .flush(ficha('pp-7', 'broker-oriente'));
    http
      .expectOne((r) => r.url === '/community/conversations' && r.method === 'POST')
      .flush({ id: 'c-7' });

    expect(navegar).toHaveBeenCalledWith(['/messaging', 'c-7'], { replaceUrl: true });
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
    conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])]);

    TestBed.inject(ChatStore).recargarBandeja();
    http.expectOne((r) => r.url === '/community/conversations').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto()).toContain('Dra. Quispe');
    expect(texto()).toContain('No pudimos cargar sus conversaciones.');
  });

  function escribir(valor: string): void {
    const campo = consultar('mensajeria-consulta') as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
