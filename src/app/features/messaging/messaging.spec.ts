import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Messaging } from './messaging';
import { ChatStore } from '../../core/messaging/chat.store';
import { ChatPreferences } from '../../core/messaging/chat-preferences';
import type { ContextoDeChat } from '../../core/messaging/contexto-de-chat';
import { guardarContexto, tomarContexto } from '../../core/messaging/enlace-de-chat';

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

    TestBed.inject(ChatPreferences).toggleArchived('c-1');
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

  it('Archivados y Bloqueados son chips del mismo carril que los filtros, con sus flechas', () => {
    conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])]);

    const carril = fixture.nativeElement.querySelector('.mensajeria__chips') as HTMLElement;
    expect(carril.contains(consultar('mensajeria-filtro-todos'))).toBe(true);
    expect(carril.contains(consultar('mensajeria-archivados'))).toBe(true);
    expect(carril.contains(consultar('mensajeria-bloqueados'))).toBe(true);
    expect(consultar('mensajeria-filtros-anterior')).not.toBeNull();
    expect(consultar('mensajeria-filtros-siguiente')).not.toBeNull();

    // Es un chip que se prende y se apaga: el mismo clic vuelve a los chats.
    const archivados = consultar('mensajeria-archivados');
    expect(archivados?.getAttribute('aria-pressed')).toBe('false');
    archivados?.click();
    fixture.detectChanges();
    expect(archivados?.getAttribute('aria-pressed')).toBe('true');
    expect(consultar('mensajeria-filtro-todos')?.getAttribute('aria-pressed')).toBe('false');
    archivados?.click();
    fixture.detectChanges();
    expect(archivados?.getAttribute('aria-pressed')).toBe('false');
    expect(consultar('mensajeria-filtro-todos')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('no borra la bandeja cuando un tic falla', () => {
    conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])]);

    TestBed.inject(ChatStore).recargarBandeja();
    http.expectOne((r) => r.url === '/community/conversations').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto()).toContain('Dra. Quispe');
    // S7: las filas se quedan y se dice que pueden estar atrasadas. Nada de
    // aviso global encima de la pantalla.
    expect(texto()).toContain('pueden estar atrasados');
    expect(fixture.nativeElement.querySelector('.mensajeria__alerta')).toBeNull();
    // El motivo (acá, sin conexión) va junto a la bandeja, no encima.
    expect(consultar('bandeja-motivo-atrasada')?.textContent).toContain('No hay conexión con el servidor');
  });

  it('si la primera lectura falla, ofrece reintentar y no dice «no tiene chats»', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    // Antes de la respuesta: esqueletos (S2), no un vacío.
    expect(consultar('bandeja-cargando')).not.toBeNull();

    http
      .expectOne((r) => r.url === '/community/conversations')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    // La petición no llegó: S8 «Sin conexión», no un S9 ni un vacío.
    expect(consultar('bandeja-sin-conexion')).not.toBeNull();
    expect(consultar('bandeja-vacia')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mensajeria__alerta')).toBeNull();

    consultar('bandeja-reintentar')?.click();
    http.expectOne((r) => r.url === '/community/conversations').flush({
      items: [],
      count: 0,
      limit: 50,
      nextCursor: null,
    });
    fixture.detectChanges();

    // Leída de verdad y sin nada: ahora sí, el vacío con su próxima acción.
    expect(consultar('bandeja-sin-conexion')).toBeNull();
    expect(consultar('bandeja-vacia')).not.toBeNull();
  });

  it('un error inesperado muestra el código de la petición, una sola vez el motivo', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/community/conversations')
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-77', timestamp: '', path: '' },
        { status: 500, statusText: 'Error' },
      );
    fixture.detectChanges();
    expect(consultar('bandeja-error')).not.toBeNull();
    expect(consultar('bandeja-request-id')?.textContent).toBe('req-77');
    expect(texto().split('No pudimos leer su bandeja').length - 1).toBe(1);
  });

  it('la píldora y el chip «No leídos» cuentan lo mismo: chats', () => {
    conBandeja([
      conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Ana' }], 3),
      conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Beto' }], 1),
      conversacion('c-3', [{ profileId: 'pp-4', displayName: 'Ceci' }], 0),
    ]);
    expect(consultar('mensajeria-sin-leer')?.textContent?.trim()).toBe('2 chats sin leer');
    expect(consultar('mensajeria-filtro-no-leidos')?.querySelector('.mensajeria__chip-cuenta')?.textContent?.trim()).toBe('2');
  });

  function escribir(valor: string): void {
    const campo = consultar('mensajeria-consulta') as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  describe('L-6 · estados de la bandeja', () => {
    it('si un filtro vacía la lista en S7, el aviso de antigüedad sigue a la vista', () => {
      conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }], 0)]);
      TestBed.inject(ChatStore).recargarBandeja();
      http
        .expectOne((r) => r.url === '/community/conversations')
        .flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).toContain('pueden estar atrasados');

      consultar('mensajeria-filtro-no-leidos')?.click();
      fixture.detectChanges();

      expect(todas('conversacion').length).toBe(0);
      expect(texto()).toContain('Ningún chat en «No leídos»');
      expect(texto()).toContain('pueden estar atrasados');
    });

    it('con todo archivado no dice «Todavía no tiene chats»: dice cuántos hay archivados y deja verlos', () => {
      conBandeja([
        conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }]),
        conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Lic. Rojas' }]),
      ]);
      const preferencias = TestBed.inject(ChatPreferences);
      preferencias.toggleArchived('c-1');
      preferencias.toggleArchived('c-2');
      fixture.detectChanges();

      expect(consultar('bandeja-vacia')).toBeNull();
      expect(texto()).not.toContain('Todavía no tiene chats');
      expect(consultar('mensajeria-todo-archivado')?.textContent).toContain('Tiene 2 chats archivados.');

      consultar('mensajeria-ver-archivados')?.click();
      fixture.detectChanges();
      expect(todas('conversacion').length).toBe(2);
    });

    it('un 403 con filas ya cargadas es S5: no se siguen mostrando las filas', () => {
      conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])]);
      TestBed.inject(ChatStore).recargarBandeja();
      http
        .expectOne((r) => r.url === '/community/conversations')
        .flush({ code: 'FORBIDDEN', message: '' }, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();

      expect(todas('conversacion').length).toBe(0);
      expect(texto()).not.toContain('Dra. Quispe');
      expect(texto()).not.toContain('pueden estar atrasados');
      expect(consultar('bandeja-sin-permiso')).not.toBeNull();
    });
  });

  describe('«Escribiendo como»', () => {
    it('no aparece para quien no tiene una farmacia con la que escribir', () => {
      conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])]);
      expect(consultar('mensajeria-escribiendo-como')).toBeNull();
    });

    it('con la vitrina de la farmacia ofrece «Yo / Farmacia» y elegir la farmacia cambia de perfil', () => {
      conBandeja([conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }])]);
      const store = TestBed.inject(ChatStore);
      store.vitrinasDeOrganizacion.set([{ profileId: 'pp-farmacia', nombre: 'Farmacia Vida' }]);
      fixture.detectChanges();

      const selector = consultar('mensajeria-escribiendo-como');
      expect(selector?.textContent).toContain('Yo');
      expect(selector?.textContent).toContain('Farmacia Vida');

      const actuar = vi.spyOn(store, 'actuarComo');
      const opciones = Array.from(selector!.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
      opciones.find((b) => b.textContent?.includes('Farmacia Vida'))!.click();
      expect(actuar).toHaveBeenCalledWith('pp-farmacia');
    });

    it('quien atiende dos vitrinas las ve a las dos en el selector', () => {
      conBandeja([]);
      const store = TestBed.inject(ChatStore);
      store.vitrinasDeOrganizacion.set([
        { profileId: 'pp-farmacia', nombre: 'Farmacia Vida' },
        { profileId: 'pp-farmacia-2', nombre: 'Farmacia Norte' },
      ]);
      fixture.detectChanges();

      const opciones = Array.from(
        consultar('mensajeria-escribiendo-como')!.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
      );
      expect(opciones.map((b) => b.textContent?.trim())).toEqual(['Yo', 'Farmacia Vida', 'Farmacia Norte']);

      const actuar = vi.spyOn(store, 'actuarComo');
      opciones[2]!.click();
      expect(actuar).toHaveBeenCalledWith('pp-farmacia-2');
    });

    it('como la farmacia, el buscador sólo filtra sus chats: no busca contactos ni ofrece iniciar uno', () => {
      conBandeja([]);
      const store = TestBed.inject(ChatStore);
      store.vitrinasDeOrganizacion.set([{ profileId: 'pp-farmacia', nombre: 'Farmacia Vida' }]);
      store.actuarComo('pp-farmacia');
      http.expectOne((r) => r.url === '/community/conversations').flush({
        items: [
          conversacion('c-1', [{ profileId: 'pp-2', displayName: 'Ana Rojas' }]),
          conversacion('c-2', [{ profileId: 'pp-3', displayName: 'Marta Quispe' }]),
        ],
        count: 2,
        limit: 50,
        nextCursor: null,
      });
      fixture.detectChanges();

      const campo = consultar('mensajeria-consulta') as HTMLInputElement;
      expect(campo.placeholder).toBe('Buscar en los chats de Farmacia Vida');

      escribir('rojas');
      expect(todas('conversacion').length).toBe(1);
      expect(texto()).toContain('Ana Rojas');

      // Ni al directorio: la API no deja buscar contactos como la vitrina.
      vi.advanceTimersByTime(300);
      http.expectNone((r) => r.url === '/public/search/practitioners');
      expect(consultar('mensajeria-resultado')).toBeNull();

      escribir('nadie');
      vi.advanceTimersByTime(300);
      http.expectNone((r) => r.url === '/public/search/practitioners');
      const sinNada = consultar('mensajeria-sin-coincidencias')?.textContent ?? '';
      expect(sinNada).toContain('Ningún chat de Farmacia Vida coincide');
      expect(sinNada).toContain('sólo se responde');
      expect(sinNada).not.toContain('contacto');
    });

    it('el aviso de que se perdió el permiso se ve en la bandeja', () => {
      conBandeja([]);
      TestBed.inject(ChatStore).avisoDePerfil.set('Ya no puede escribir como la farmacia: volvió a su perfil.');
      fixture.detectChanges();
      expect(consultar('mensajeria-aviso-perfil')?.textContent).toContain('volvió a su perfil');
    });
  });

});

/**
 * El `?escribirA=` con el que llegan los botones del marketplace (H1).
 *
 * El contexto ya no viaja en la URL: sólo el nonce (`ctx=`) de lo que el botón
 * dejó en `sessionStorage`. Fija que la bandeja manda tarjeta **sólo** con un
 * nonce que exista en la pestaña, que lo consume, y que un enlace de afuera
 * (con un nonce inventado, o con los parámetros viejos `sobre`/`titulo`) abre
 * el hilo sin tarjeta.
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

  const pedido: ContextoDeChat = {
    tipo: 'pedido',
    titulo: 'Farmacia Vida · Central',
    detalle: '2 productos',
    ruta: '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
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

  const VIDA = { escribirA: 'farmacia-vida' } as const;

  beforeEach(() => sessionStorage.clear());

  afterEach(() => {
    TestBed.inject(ChatStore).detener();
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((pedido) => pedido.flush(null));
    sessionStorage.clear();
  });

  it('con el nonce que dejó el botón pasa el contexto, lo consume y abre el hilo sin los parámetros', async () => {
    const nonce = guardarContexto(VIDA, pedido, sessionStorage)!;
    const { escribirA, navegar } = await montarEn(`/messaging?escribirA=farmacia-vida&ctx=${nonce}`);

    expect(escribirA).toHaveBeenCalledTimes(1);
    expect(escribirA.mock.calls[0]?.[0]).toBe('farmacia-vida');
    expect(escribirA.mock.calls[0]?.[2]).toEqual(pedido);
    expect(navegar).toHaveBeenCalledWith(['/messaging', 'c-9'], { replaceUrl: true });
    // De un solo uso: ya no está.
    expect(tomarContexto(nonce, VIDA, sessionStorage)).toBeNull();
  });

  it('?pedido=<id> le pide el hilo a la API del pedido, y la tarjeta va una vez', async () => {
    const nonce = guardarContexto({ pedido: 'o-1' }, { tipo: 'pedido', titulo: 'Farmacia Vida', ruta: '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6' }, sessionStorage)!;
    const { escribirA, navegar } = await montarEn(`/messaging?pedido=o-1&ctx=${nonce}`);
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
    expect(envio.request.body.bodyText).toBe('Pedido: Farmacia Vida\n/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6');
    envio.flush({ id: 'm-1', conversationId: 'c-7', sentAt: '2026-09-08T10:00:00.000Z' });
    expect(navegar).toHaveBeenCalledWith(['/messaging', 'c-7'], { replaceUrl: true });
    expect(store.error()).toBe('');
  });

  it('un enlace externo con un nonce inventado abre el hilo sin tarjeta', async () => {
    guardarContexto(VIDA, pedido, sessionStorage);
    const { escribirA, navegar } = await montarEn('/messaging?escribirA=farmacia-vida&ctx=falso');
    expect(escribirA).toHaveBeenCalledTimes(1);
    expect(escribirA.mock.calls[0]?.[2]).toBeUndefined();
    expect(navegar).toHaveBeenCalledWith(['/messaging', 'c-9'], { replaceUrl: true });
  });

  it('los parámetros viejos (sobre/titulo/ruta) ya no hacen tarjeta', async () => {
    const { escribirA } = await montarEn(
      '/messaging?escribirA=farmacia-vida&sobre=producto&titulo=Hola&ruta=%2Fpharmacies-directory%2Fotra',
    );
    expect(escribirA).toHaveBeenCalledTimes(1);
    expect(escribirA.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('L-1 · el nonce que el botón dejó para otra farmacia no da tarjeta aunque se cambie la URL', async () => {
    const nonce = guardarContexto({ escribirA: 'farmacia-vida' }, pedido, sessionStorage)!;
    const { escribirA } = await montarEn(`/messaging?escribirA=otra-farmacia&ctx=${nonce}`);
    expect(escribirA).toHaveBeenCalledTimes(1);
    expect(escribirA.mock.calls[0]?.[0]).toBe('otra-farmacia');
    expect(escribirA.mock.calls[0]?.[2]).toBeUndefined();
  });

  it('L-4 · si la pantalla se cerró mientras se abría el chat, no navega al hilo', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    const store = TestBed.inject(ChatStore);
    let alAbrir: ((conversationId: string) => void) | undefined;
    vi.spyOn(store, 'escribirA').mockImplementation((_slug, callback) => {
      alAbrir = callback;
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/messaging?escribirA=farmacia-vida');
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Messaging);
    fixture.detectChanges();
    expect(alAbrir).toBeDefined();

    // La persona se fue a otra pantalla; la apertura termina después.
    fixture.destroy();
    alAbrir!('c-9');

    expect(navegar).not.toHaveBeenCalled();
  });
});
