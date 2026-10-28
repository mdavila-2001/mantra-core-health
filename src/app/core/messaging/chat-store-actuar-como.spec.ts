import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import {
  AVISO_CHAT_NUEVO_CON_PERFIL_PROPIO,
  AVISO_SIN_PERMISO_DE_ORGANIZACION,
  ChatStore,
  ERROR_CHAT_NUEVO_COMO_ORGANIZACION,
} from './chat.store';
import { ChatSocketService } from './chat-socket.service';

/**
 * Escribir como la farmacia.
 *
 * Lo que fijan: que cambiar de perfil es **otra bandeja** (se relee y el
 * socket se vuelve a unir con ese `profileId`), que un 403 —de la REST o del
 * socket— devuelve al perfil propio con aviso, y que la elección se recuerda
 * en la pestaña sólo para la misma cuenta.
 *
 * Las vitrinas las da `GET /community/profiles/organization-showcases/me`, no
 * un slug adivinado: las farmacias sembradas usan `farmacia-*` y una vitrina
 * privada no se encuentra por slug.
 */
describe('ChatStore · con qué perfil se escribe', () => {
  const PROPIO = 'pp-propio';
  const FARMACIA = 'pp-farmacia';
  const TENANT = 't-farmacia';
  const CLAVE = 'alovida.chat.actuar-como';

  let store: ChatStore;
  let http: HttpTestingController;
  let socket: ChatSocketService;
  const usuario = signal<string | null>('u-mostrador');

  const bandeja = (items: unknown[] = []) => ({ items, count: items.length, limit: 50, nextCursor: null });

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

  const lecturasDeBandeja = (): TestRequest[] =>
    http.match((r) => r.url === '/community/conversations' && r.method === 'GET');

  const VITRINAS = '/community/profiles/organization-showcases/me';

  const vitrina = (profileId: string, displayName: string, slug = 'farmacia-vida') => ({
    profileId,
    slug,
    displayName,
    avatarFileId: null,
    targetTypeConceptId: 'c-farmacia',
    kind: 'PHARMACY',
  });

  /** Enciende Chats con el perfil propio y deja descubierta la vitrina. */
  function encender(): void {
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
    http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida')] });
    lecturasDeBandeja().forEach((r) => r.flush(bandeja([fila('c-propia')])));
  }

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
    http.match(() => true).forEach((r) => r.flush(null));
    http.verify();
    sessionStorage.clear();
  });

  it('ofrece la vitrina de la farmacia sólo como puerta: sigue escribiendo como uno mismo', () => {
    encender();
    expect(store.vitrinaDeOrganizacion()).toEqual({ profileId: FARMACIA, nombre: 'Farmacia Vida' });
    expect(store.perfil()).toBe(PROPIO);
    expect(store.actuandoComoOrganizacion()).toBe(false);
  });

  it('cambiar a la farmacia relee la bandeja con su profileId y vuelve a unirse al socket con él', () => {
    encender();
    const reiniciar = vi.spyOn(socket, 'reiniciar');
    const unirse = vi.spyOn(socket, 'joinInbox');

    store.actuarComo(FARMACIA);

    expect(store.perfil()).toBe(FARMACIA);
    expect(store.actuandoComoOrganizacion()).toBe(true);
    // Lo de la otra identidad no se queda en pantalla mientras llega lo nuevo.
    expect(store.conversaciones()).toEqual([]);
    expect(store.bandejaCargada()).toBe(false);
    expect(reiniciar).toHaveBeenCalled();
    expect(unirse).toHaveBeenCalledWith(FARMACIA);

    const lecturas = lecturasDeBandeja();
    expect(lecturas.length).toBe(1);
    expect(lecturas[0]!.request.params.get('profileId')).toBe(FARMACIA);
    lecturas[0]!.flush(bandeja([fila('c-farmacia')]));
    expect(store.conversaciones().map((c) => c.id)).toEqual(['c-farmacia']);

    // Y la elección queda en la pestaña, atada a esta cuenta.
    expect(JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null')).toEqual({
      userId: 'u-mostrador',
      profileId: FARMACIA,
      nombre: 'Farmacia Vida',
    });
  });

  it('volver a «Yo» relee con el perfil propio y olvida la elección', () => {
    encender();
    store.actuarComo(FARMACIA);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));

    store.actuarComo(null);
    expect(store.perfil()).toBe(PROPIO);
    const lecturas = lecturasDeBandeja();
    expect(lecturas[0]!.request.params.get('profileId')).toBe(PROPIO);
    lecturas.forEach((r) => r.flush(bandeja()));
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('un 403 de la API escribiendo como la farmacia obliga a volver al perfil propio, y lo avisa', () => {
    encender();
    store.actuarComo(FARMACIA);
    lecturasDeBandeja()[0]!.flush(
      { code: 'FORBIDDEN', reason: 'NOT_OWN_PROFILE' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(store.perfil()).toBe(PROPIO);
    expect(store.actuandoComoOrganizacion()).toBe(false);
    // Ya no se ofrece una puerta que la API acaba de cerrar.
    expect(store.vitrinaDeOrganizacion()).toBeNull();
    expect(store.avisoDePerfil()).toBe(AVISO_SIN_PERMISO_DE_ORGANIZACION);
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
    // No es un error de la bandeja: es otra bandeja, que se relee.
    expect(store.error()).toBe('');
    const lecturas = lecturasDeBandeja();
    expect(lecturas[0]!.request.params.get('profileId')).toBe(PROPIO);
    lecturas.forEach((r) => r.flush(bandeja()));
  });

  it('un 403 escribiendo con el perfil propio no es «perder la farmacia»: queda como error', () => {
    encender();
    store.recargarBandeja();
    lecturasDeBandeja()[0]!.flush(null, { status: 403, statusText: 'Forbidden' });
    expect(store.perfil()).toBe(PROPIO);
    expect(store.avisoDePerfil()).toBe('');
    expect(store.error()).toBe('No pudimos cargar tus conversaciones.');
  });

  it('el socket que responde NOT_OWN_PROFILE (membership:recheck) también devuelve al perfil propio', () => {
    encender();
    store.actuarComo(FARMACIA);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));

    (socket as unknown as { errors$: { next(v: unknown): void } }).errors$.next({
      code: 'NOT_OWN_PROFILE',
      event: 'membership:recheck',
      profileId: FARMACIA,
    });

    expect(store.perfil()).toBe(PROPIO);
    expect(store.avisoDePerfil()).toBe(AVISO_SIN_PERMISO_DE_ORGANIZACION);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
  });

  it('un NOT_OWN_PROFILE de otro perfil no toca la identidad actual', () => {
    encender();
    store.actuarComo(FARMACIA);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
    (socket as unknown as { errors$: { next(v: unknown): void } }).errors$.next({
      code: 'NOT_OWN_PROFILE',
      event: 'membership:recheck',
      profileId: 'otra-vitrina',
    });
    expect(store.perfil()).toBe(FARMACIA);
  });

  it('al recargar la pestaña se sigue escribiendo como la farmacia', () => {
    sessionStorage.setItem(
      CLAVE,
      JSON.stringify({ userId: 'u-mostrador', profileId: FARMACIA, nombre: 'Farmacia Vida' }),
    );
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
    http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida')] });
    expect(store.perfil()).toBe(FARMACIA);
    expect(store.perfilPropio()).toBe(PROPIO);
    const lecturas = lecturasDeBandeja();
    expect(lecturas[0]!.request.params.get('profileId')).toBe(FARMACIA);
    lecturas.forEach((r) => r.flush(bandeja()));
  });

  it('la elección guardada por otra cuenta no se hereda', () => {
    sessionStorage.setItem(
      CLAVE,
      JSON.stringify({ userId: 'u-otra', profileId: FARMACIA, nombre: 'Farmacia Vida' }),
    );
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
    http.expectOne(VITRINAS).flush({ items: [] });
    expect(store.perfil()).toBe(PROPIO);
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
  });

  it('cerrar sesión y entrar con otra cuenta en la misma pestaña olvida la identidad anterior', () => {
    encender();
    store.actuarComo(FARMACIA);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja([fila('c-farmacia')])));

    usuario.set(null);
    TestBed.tick();

    expect(store.perfil()).toBeNull();
    expect(store.perfilResuelto()).toBe(false);
    expect(store.vitrinaDeOrganizacion()).toBeNull();
    expect(store.conversaciones()).toEqual([]);
  });

  it('a quien no es personal de farmacia no se le busca ninguna vitrina', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SessionStore,
          useValue: {
            userId: () => 'u-paciente',
            roles: () => ['PATIENT'],
            activeTenantId: () => 't-plataforma',
            displayName: () => 'Ana',
            accessToken: () => null,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatStore);
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: 't', slug: 'yo', displayName: 'Yo' });
    http.expectNone(VITRINAS);
    http.expectNone((r) => r.url.startsWith('/community/profiles/by-slug/'));
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
    expect(store.vitrinaDeOrganizacion()).toBeNull();
  });

  it('no adivina slugs: la vitrina sale del endpoint aunque su slug sea `farmacia-*`', () => {
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
    http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida', 'farmacia-vida-centro')] });
    http.expectNone((r) => r.url.startsWith('/community/profiles/by-slug/'));
    expect(store.vitrinasDeOrganizacion()).toEqual([{ profileId: FARMACIA, nombre: 'Farmacia Vida' }]);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
  });

  it('quien atiende dos vitrinas puede escribir con cualquiera de las dos', () => {
    const NORTE = 'pp-farmacia-norte';
    store.iniciar();
    http.expectOne('/community/profiles/me').flush({ id: PROPIO, tenantId: TENANT, slug: 'yo', displayName: 'Yo' });
    http.expectOne(VITRINAS).flush({
      items: [vitrina(FARMACIA, 'Farmacia Vida'), vitrina(NORTE, 'Farmacia Norte', 'farmacia-norte')],
    });
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));

    expect(store.vitrinasDeOrganizacion().map((v) => v.nombre)).toEqual(['Farmacia Vida', 'Farmacia Norte']);

    store.actuarComo(NORTE);
    expect(store.perfil()).toBe(NORTE);
    expect(store.vitrinaDeOrganizacion()).toEqual({ profileId: NORTE, nombre: 'Farmacia Norte' });
    const lecturas = lecturasDeBandeja();
    expect(lecturas.length).toBe(1);
    expect(lecturas[0]!.request.params.get('profileId')).toBe(NORTE);

    // Perder el permiso de una no cierra la puerta de la otra.
    lecturas[0]!.flush(
      { code: 'FORBIDDEN', reason: 'NOT_OWN_PROFILE' },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(store.perfil()).toBe(PROPIO);
    expect(store.vitrinasDeOrganizacion()).toEqual([{ profileId: FARMACIA, nombre: 'Farmacia Vida' }]);
    lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
  });

  describe('como la vitrina sólo se responde', () => {
    it('no busca contactos: la API los niega (403) a la vitrina', () => {
      encender();
      store.actuarComo(FARMACIA);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));

      store.buscarGente('ana');
      http.expectNone((r) => r.url === '/public/search/practitioners');
      expect(store.resultados()).toEqual([]);
      expect(store.buscandoAhora()).toBe(false);
    });

    it('cambiar a la vitrina descarta los contactos que se habían buscado', () => {
      encender();
      store.resultados.set([{ kind: 'PRACTITIONER', slug: 'x', displayName: 'X' } as never]);
      store.actuarComo(FARMACIA);
      expect(store.resultados()).toEqual([]);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
    });

    it('escribirA vuelve antes al perfil propio, lo avisa, y abre el chat con él', () => {
      encender();
      store.actuarComo(FARMACIA);
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));

      const abierto = vi.fn();
      store.escribirA('dra-quispe', abierto);

      expect(store.perfil()).toBe(PROPIO);
      expect(store.actuandoComoOrganizacion()).toBe(false);
      expect(store.avisoDePerfil()).toBe(AVISO_CHAT_NUEVO_CON_PERFIL_PROPIO);
      expect(sessionStorage.getItem(CLAVE)).toBeNull();
      // La vitrina se sigue ofreciendo: volver a ella es un toque.
      expect(store.vitrinasDeOrganizacion()).toEqual([{ profileId: FARMACIA, nombre: 'Farmacia Vida' }]);

      http
        .expectOne('/community/profiles/by-slug/dra-quispe')
        .flush({ id: 'pp-quispe', tenantId: 't', slug: 'dra-quispe', displayName: 'Dra. Quispe', targetTypeConceptId: 'c', statusConceptId: 's', badges: [], prestige: null });
      const alta = http.expectOne((r) => r.url === '/community/conversations' && r.method === 'POST');
      expect(alta.request.body).toEqual({ participantProfileIds: [PROPIO, 'pp-quispe'] });
      alta.flush({ id: 'c-nueva' });
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
      expect(abierto).toHaveBeenCalledWith('c-nueva');
    });

    it('sin perfil propio al que volver, escribirA lo explica y no pide nada', () => {
      sessionStorage.setItem(
        CLAVE,
        JSON.stringify({ userId: 'u-mostrador', profileId: FARMACIA, nombre: 'Farmacia Vida' }),
      );
      store.iniciar();
      http.expectOne('/community/profiles/me').flush(null);
      http.expectOne(VITRINAS).flush({ items: [vitrina(FARMACIA, 'Farmacia Vida')] });
      lecturasDeBandeja().forEach((r) => r.flush(bandeja()));
      expect(store.actuandoComoOrganizacion()).toBe(true);

      const abierto = vi.fn();
      store.escribirA('dra-quispe', abierto);

      expect(store.error()).toBe(ERROR_CHAT_NUEVO_COMO_ORGANIZACION);
      expect(store.perfil()).toBe(FARMACIA);
      expect(store.abriendo()).toBe(false);
      http.expectNone('/community/profiles/by-slug/dra-quispe');
      http.expectNone((r) => r.url === '/community/conversations' && r.method === 'POST');
      expect(abierto).not.toHaveBeenCalled();
    });
  });
});
