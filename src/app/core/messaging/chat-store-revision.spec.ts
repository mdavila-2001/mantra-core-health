import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';

import { SessionStore } from '../auth/session.store';
import {
  AVISO_SIN_PERMISO_DE_ORGANIZACION,
  CHAT_YA_ABRIENDO,
  ChatOcupadoError,
  ChatStore,
  ERROR_SIN_PERMISO_EN_LA_CONVERSACION,
} from './chat.store';
import { ChatSocketService } from './chat-socket.service';
import type { ContextoDeChat } from './contexto-de-chat';

/**
 * Lo que fijan estas pruebas: los defectos de la revisión independiente del
 * store (H2, M1–M5, M11 y el estado propio de la bandeja). Cada `describe`
 * nombra el hallazgo que cierra.
 */
describe('ChatStore · revisión', () => {
  const PROPIO = 'pp-propio';
  const FARMACIA = 'pp-farmacia';
  const TENANT = 't-farmacia';
  const VITRINAS = '/community/profiles/organization-showcases/me';

  let store: ChatStore;
  let http: HttpTestingController;
  let socket: ChatSocketService;
  const usuario = signal<string | null>('u-mostrador');

  const bandeja = (items: unknown[] = []) => ({ items, count: items.length, limit: 50, nextCursor: null });
  const pagina = (items: unknown[] = []) => ({ items, count: items.length, limit: 30, nextCursor: null });

  const fila = (id: string) => ({
    id,
    conversationTypeConceptId: 'c-direct',
    groupId: null,
    lastMessageAt: '2026-10-28T10:00:00.000Z',
    messageCount: 1,
    lastMessage: null,
    unreadCount: 0,
    peers: [{ profileId: 'pp-paciente', displayName: 'Ana' }],
  });

  const mensaje = (id: string, senderProfileId: string, bodyText: string) => ({
    id,
    conversationId: 'c-1',
    senderProfileId,
    replyToMessageId: null,
    contentTypeConceptId: 'c-text',
    bodyText,
    attachmentFileId: null,
    isEdited: null,
    sentAt: '2026-10-28T10:00:00.000Z',
  });

  const vitrina = (profileId: string, displayName: string) => ({
    profileId,
    slug: 'farmacia-vida',
    displayName,
    avatarFileId: null,
    targetTypeConceptId: 'c-farmacia',
    kind: 'PHARMACY',
  });

  const ficha = {
    id: 'pp-f',
    slug: 'farmacia-vida',
    tenantId: 't-f',
    targetId: 'ph-1',
    displayName: 'Farmacia Vida',
    headline: null,
    biography: null,
    acceptsReviews: null,
    badges: [],
    prestige: null,
  };

  const lecturasDeBandeja = (): TestRequest[] =>
    http.match((r) => r.url === '/community/conversations' && r.method === 'GET');
  const lecturasDelHilo = (id = 'c-1'): TestRequest[] =>
    http.match((r) => r.url === `/community/conversations/${id}/messages` && r.method === 'GET');
  const envios = (id = 'c-1'): TestRequest[] =>
    http.match((r) => r.url === `/community/conversations/${id}/messages` && r.method === 'POST');
  const subidas = (): TestRequest[] => http.match((r) => r.url === '/common/files/upload');

  /** Enciende Chats con el perfil propio y deja descubierta la vitrina. */
  function encender(filas: unknown[] = [fila('c-propia')]): void {
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
    http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida')] });
    lecturasDeBandeja().forEach((r) => r.flush(bandeja(filas)));
  }

  const foto = (nombre: string): File => new File(['x'], nombre, { type: 'image/jpeg' });

  beforeEach(() => {
    sessionStorage.clear();
    usuario.set('u-mostrador');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SessionStore,
          useValue: {
            userId: usuario,
            roles: () => ['PHARMACY_STAFF'],
            activeTenantId: () => TENANT,
            displayName: () => 'Rodrigo',
            accessToken: () => null,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(ChatSocketService);
    store = TestBed.inject(ChatStore);
  });

  afterEach(() => {
    store.detener();
    http.match(() => true).forEach((r) => {
      if (!r.cancelled) r.flush(null);
    });
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('H2 · carreras al cambiar de identidad', () => {
    it('reintentar despacha con el perfil con que se escribió, no con el de ahora', () => {
      encender();
      store.abrir('c-1');
      lecturasDelHilo().forEach((r) => r.flush(pagina()));
      store.enviar('Hola');
      envios()[0]!.flush(null, { status: 500, statusText: 'Error' });
      const fallado = store.pendientes()[0]!;
      expect(fallado.profileId).toBe(PROPIO);

      store.actuarComo(FARMACIA);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
      // El fallado de «Yo» no se ve en el hilo de la farmacia.
      store.activaId.set('c-1');
      expect(store.enOrden().some((m) => m.clave === fallado.claveTemporal)).toBe(false);

      store.reintentar(fallado);
      const [envio] = envios();
      expect(envio!.request.body.senderProfileId).toBe(PROPIO);
    });

    it('cambiar de identidad corta las subidas en cola y no manda nada con la otra', () => {
      encender();
      store.activaId.set('c-1');
      store.enviarAdjuntos([foto('1.jpg'), foto('2.jpg')], 'Receta');
      const [primera] = subidas();
      expect(primera).toBeDefined();

      store.actuarComo(FARMACIA);
      expect(primera!.cancelled).toBe(true);
      expect(store.pendientes()).toEqual([]);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
      expect(subidas()).toHaveLength(0);
      expect(envios()).toHaveLength(0);
    });

    it('la bandeja pedida como «Yo» que llega después de cambiar a la farmacia se descarta', () => {
      encender();
      store.recargarBandeja();
      const vieja = lecturasDeBandeja();
      expect(vieja).toHaveLength(1);

      store.actuarComo(FARMACIA);
      const nueva = lecturasDeBandeja();
      vieja[0]!.flush(bandeja([fila('c-propia')]));
      expect(store.conversaciones()).toEqual([]);
      expect(store.bandeja().status).toBe('loading');

      nueva.forEach((r) => r.flush(bandeja([fila('c-farmacia')])));
      expect(store.conversaciones().map((c) => c.id)).toEqual(['c-farmacia']);
    });

    it('el hilo pedido con la otra identidad no se vuelca al llegar tarde', () => {
      encender();
      store.abrir('c-1');
      const viejo = lecturasDelHilo();
      store.actuarComo(FARMACIA);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
      viejo.forEach((r) => r.flush(pagina([mensaje('m-1', 'pp-paciente', 'Hola')])));
      expect(store.mensajes()).toEqual([]);
      expect(store.cargandoHilo()).toBe(false);
    });

    it('el perfil propio de la cuenta anterior que llega después de olvidarla no se pone', () => {
      store.iniciar();
      const viejo = http.expectOne('/community/profiles/me');
      http.match(VITRINAS).forEach((r) => r.flush({ items: [] }));

      usuario.set('u-otra');
      TestBed.tick();
      viejo.flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });

      expect(store.perfilPropio()).toBeNull();
      expect(store.perfil()).toBeNull();
      expect(store.perfilResuelto()).toBe(false);
    });

    it('olvidar la identidad libera un «abriendo» en curso', () => {
      encender();
      store.abrirComoOrganizacion(NEVER, 'Farmacia Vida', vi.fn());
      expect(store.abriendo()).toBe(true);
      usuario.set(null);
      TestBed.tick();
      expect(store.abriendo()).toBe(false);
    });
  });

  describe('M1 · un 403 no siempre es perder la farmacia', () => {
    function comoFarmacia(): void {
      encender();
      store.actuarComo(FARMACIA);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja([fila('c-1')])));
    }

    it('si la vitrina sigue en la lista, el 403 es de esa conversación: se dice y no se cambia de identidad', () => {
      comoFarmacia();
      store.abrir('c-1');
      lecturasDelHilo()[0]!.flush(null, { status: 403, statusText: 'Forbidden' });
      http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida')] });

      expect(store.perfil()).toBe(FARMACIA);
      expect(store.actuandoComoOrganizacion()).toBe(true);
      expect(store.avisoDePerfil()).toBe('');
      expect(store.error()).toBe(ERROR_SIN_PERMISO_EN_LA_CONVERSACION);
      expect(store.vitrinasDeOrganizacion().map((v) => v.profileId)).toEqual([FARMACIA]);
    });

    it('si ya no está, se quita y se vuelve a «Yo» con aviso', () => {
      comoFarmacia();
      store.abrir('c-1');
      lecturasDelHilo()[0]!.flush(null, { status: 403, statusText: 'Forbidden' });
      http.expectOne(VITRINAS).flush({ items: [] });

      expect(store.perfil()).toBe(PROPIO);
      expect(store.vitrinasDeOrganizacion()).toEqual([]);
      expect(store.avisoDePerfil()).toBe(AVISO_SIN_PERMISO_DE_ORGANIZACION);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
    });

    it('un envío con 403 deja el mensaje fallado y revalida una sola vez', () => {
      comoFarmacia();
      store.abrir('c-1');
      lecturasDelHilo().forEach((r) => r.flush(pagina()));
      store.enviar('uno');
      store.enviar('dos');
      envios().forEach((r) => r.flush(null, { status: 403, statusText: 'Forbidden' }));
      expect(http.match(VITRINAS)).toHaveLength(1);
      expect(store.pendientes().map((p) => p.estado)).toEqual(['fallado', 'fallado']);
      expect(store.error()).toBe('');
    });

    it('NOT_OWN_PROFILE con membership:recheck es pérdida directa, sin preguntar', () => {
      comoFarmacia();
      (socket as unknown as { errors$: { next(v: unknown): void } }).errors$.next({
        code: 'NOT_OWN_PROFILE',
        event: 'membership:recheck',
        profileId: FARMACIA,
      });
      http.expectNone(VITRINAS);
      expect(store.perfil()).toBe(PROPIO);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
    });

    it('otro NOT_OWN_PROFILE (un join rechazado) se confirma con la API', () => {
      comoFarmacia();
      (socket as unknown as { errors$: { next(v: unknown): void } }).errors$.next({
        code: 'NOT_OWN_PROFILE',
        event: 'join:inbox',
        profileId: FARMACIA,
      });
      http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida')] });
      expect(store.perfil()).toBe(FARMACIA);
    });
  });

  describe('M2 · ocupado', () => {
    it('abrirComoOrganizacion avisa por alFallar si ya se está abriendo otro chat', () => {
      encender();
      store.abrirComoOrganizacion(NEVER, 'Farmacia Vida', vi.fn());
      const alFallar = vi.fn();
      const alAbrir = vi.fn();
      store.abrirComoOrganizacion(
        of({ conversationId: 'c-2', profileId: FARMACIA }),
        'Farmacia Vida',
        alAbrir,
        undefined,
        alFallar,
      );
      expect(alFallar).toHaveBeenCalledOnce();
      const [error] = alFallar.mock.calls[0] as [Error];
      expect(error).toBeInstanceOf(ChatOcupadoError);
      expect(error.message).toBe(CHAT_YA_ABRIENDO);
      expect(alAbrir).not.toHaveBeenCalled();
    });
  });

  describe('M3 · contexto inválido', () => {
    it('no se manda tarjeta, se abre el hilo y se libera «abriendo»', () => {
      encender();
      const alAbrir = vi.fn();
      const invalido = { tipo: 'pedido', titulo: 'X', ruta: 'https://malo.example' } as ContextoDeChat;
      expect(() =>
        store.abrirComoOrganizacion(
          of({ conversationId: 'c-1', profileId: FARMACIA }),
          'Farmacia Vida',
          alAbrir,
          invalido,
        ),
      ).not.toThrow();
      expect(lecturasDelHilo()).toHaveLength(0);
      expect(envios()).toHaveLength(0);
      expect(alAbrir).toHaveBeenCalledWith('c-1');
      expect(store.abriendo()).toBe(false);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
    });
  });

  describe('M4 · sin perfil propio la intención no se pierde', () => {
    it('crearPerfil retoma el chat que se quiso abrir, con su tarjeta', () => {
      store.iniciar();
      http.expectOne('/community/profiles/me').flush(null);
      http.match(VITRINAS).forEach((r) => r.flush({ items: [] }));
      const alAbrir = vi.fn();
      const contexto: ContextoDeChat = {
        tipo: 'farmacia',
        titulo: 'Farmacia Vida',
        ruta: '/pharmacies-directory/farmacia-vida',
      };
      store.escribirA('farmacia-vida', alAbrir, contexto);
      http.expectNone('/community/profiles/by-slug/farmacia-vida');

      store.crearPerfil();
      http
        .expectOne((r) => r.method === 'PUT' && r.url === '/community/profiles/me')
        .flush({ id: PROPIO, tenantId: TENANT, slug: 'rodrigo-x', displayName: 'Rodrigo' });
      expect(store.perfilPropio()).toBe(PROPIO);

      http.expectOne('/community/profiles/by-slug/farmacia-vida').flush(ficha);
      http
        .expectOne((r) => r.method === 'POST' && r.url === '/community/conversations')
        .flush({ id: 'c-1' });
      lecturasDelHilo()[0]!.flush(pagina());
      const [tarjeta] = envios();
      expect(tarjeta!.request.body).toEqual({
        senderProfileId: PROPIO,
        bodyText: 'Farmacia: Farmacia Vida\n/pharmacies-directory/farmacia-vida',
      });
      tarjeta!.flush({ id: 'm-1', conversationId: 'c-1', sentAt: '2026-10-28T10:00:00.000Z' });
      expect(alAbrir).toHaveBeenCalledWith('c-1');
    });
  });

  describe('M5 · misma tarjeta con el título normalizado', () => {
    it('un título con espacios de más o largo no hace repetir la tarjeta', () => {
      encender();
      const largo = `Farmacia   Vida ${'x'.repeat(200)}`;
      const contexto: ContextoDeChat = {
        tipo: 'farmacia',
        titulo: largo,
        ruta: '/pharmacies-directory/farmacia-vida',
      };
      // Lo que quedó en el hilo la primera vez: ya normalizado al escribirse.
      const enElHilo = `Farmacia: ${`Farmacia Vida ${'x'.repeat(200)}`.slice(0, 139)}…\n/pharmacies-directory/farmacia-vida`;
      const alAbrir = vi.fn();
      store.abrirConversacion(of('c-1'), alAbrir, contexto);
      lecturasDelHilo()[0]!.flush(pagina([mensaje('m-1', PROPIO, enElHilo)]));
      expect(envios()).toHaveLength(0);
      expect(alAbrir).toHaveBeenCalledWith('c-1');
    });
  });

  describe('fallos de un mensaje: sólo en el mensaje', () => {
    it('una tarjeta que no se pudo mandar queda como mensaje fallado del hilo, no como error global', () => {
      encender();
      const alAbrir = vi.fn();
      store.abrirConversacion(of('c-1'), alAbrir, {
        tipo: 'farmacia',
        titulo: 'Farmacia Vida',
        ruta: '/pharmacies-directory/farmacia-vida',
      });
      lecturasDelHilo()[0]!.flush(pagina());
      envios()[0]!.flush(null, { status: 500, statusText: 'Error' });
      expect(store.error()).toBe('');
      expect(store.pendientes()).toHaveLength(1);
      expect(store.pendientes()[0]).toMatchObject({ estado: 'fallado', profileId: PROPIO, conversationId: 'c-1' });
      expect(alAbrir).toHaveBeenCalledWith('c-1');
    });

    it('una subida fallida no pone error global', () => {
      encender();
      store.activaId.set('c-1');
      store.enviarAdjunto(foto('receta.jpg'), '');
      subidas()[0]!.flush('boom', { status: 500, statusText: 'Error' });
      expect(store.pendientes()[0]!.estado).toBe('fallado');
      expect(store.error()).toBe('');
    });
  });

  describe('M11 · la miniatura no se relee', () => {
    it('con la vista previa ya leída, el store no vuelve a leer el archivo', () => {
      encender();
      store.activaId.set('c-1');
      const leer = vi.spyOn(FileReader.prototype, 'readAsDataURL');
      store.enviarAdjuntos([{ archivo: foto('1.jpg'), vistaPrevia: 'data:image/jpeg;base64,eA==' }], '');
      expect(leer).not.toHaveBeenCalled();
      expect(store.pendientes()[0]!.adjunto?.vistaPrevia).toBe('data:image/jpeg;base64,eA==');
    });

    it('sin vista previa, la lee como antes', () => {
      encender();
      store.activaId.set('c-1');
      const leer = vi.spyOn(FileReader.prototype, 'readAsDataURL');
      store.enviarAdjuntos([foto('1.jpg')], '');
      expect(leer).toHaveBeenCalledOnce();
    });
  });

  describe('la bandeja tiene su propio ViewState', () => {
    it('S2 antes de leer, S3 con próxima acción si no hay chats, ready con filas', () => {
      store.iniciar();
      expect(store.bandeja().status).toBe('loading');
      http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
      http.match(VITRINAS).forEach((r) => r.flush({ items: [] }));
      lecturasDeBandeja()[0]!.flush(bandeja());
      const vacia = store.bandeja();
      expect(vacia.status).toBe('empty');
      expect(vacia.status === 'empty' && vacia.nextAction.route).toBe('/search/medications');
      store.recargarBandeja();
      lecturasDeBandeja()[0]!.flush(bandeja([fila('c-1')]));
      expect(store.bandeja().status).toBe('ready');
    });

    it('S8 si la petición no llegó', () => {
      encender([]);
      store.recargarBandeja();
      lecturasDeBandeja()[0]!.error(new ProgressEvent('error'));
      expect(store.bandeja().status).toBe('offline');
      expect(store.error()).toBe('');
    });

    it('S8 si el navegador dice que no hay red, aunque la respuesta sea otra', () => {
      encender([]);
      vi.spyOn(Object.getPrototypeOf(navigator) as Navigator, 'onLine', 'get').mockReturnValue(false);
      store.recargarBandeja();
      lecturasDeBandeja()[0]!.flush(null, { status: 502, statusText: 'Bad Gateway' });
      expect(store.bandeja().status).toBe('offline');
    });

    it('S5 con un 403', () => {
      encender([]);
      store.recargarBandeja();
      lecturasDeBandeja()[0]!.flush({ code: 'FORBIDDEN', message: '' }, { status: 403, statusText: 'Forbidden' });
      const estado = store.bandeja();
      expect(estado.status).toBe('forbidden');
      expect(estado.status === 'forbidden' && estado.message).toBeTruthy();
    });

    it('S9 con el id de la petición, del cuerpo o de X-Request-Id', () => {
      encender([]);
      store.recargarBandeja();
      lecturasDeBandeja()[0]!.flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-cuerpo', timestamp: '', path: '' },
        { status: 500, statusText: 'Error' },
      );
      let estado = store.bandeja();
      expect(estado.status === 'error' && estado.requestId).toBe('req-cuerpo');

      store.recargarBandeja();
      lecturasDeBandeja()[0]!.flush('<html>proxy</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: new HttpHeaders({ 'X-Request-Id': 'req-cabecera' }),
      });
      estado = store.bandeja();
      expect(estado.status === 'error' && estado.requestId).toBe('req-cabecera');
    });

    it('S7 si falla con filas: se conservan y se dice de cuándo son', () => {
      encender([fila('c-1')]);
      store.recargarBandeja();
      lecturasDeBandeja()[0]!.flush(null, { status: 500, statusText: 'Error' });
      const estado = store.bandeja();
      expect(estado.status).toBe('stale');
      expect(estado.status === 'stale' && estado.data.map((c) => c.id)).toEqual(['c-1']);
      expect(estado.status === 'stale' && estado.asOf.getTime()).toBeGreaterThan(0);
    });
  });
});
