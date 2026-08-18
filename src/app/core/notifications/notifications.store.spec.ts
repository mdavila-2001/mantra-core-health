import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { NotificationsStore } from './notifications.store';

/**
 * Lo que estas pruebas fijan.
 *
 * Las tres decisiones del carril que no se ven leyendo el tipo: que **el badge
 * es la suma de las dos bandejas**, que **un fallo de lo social no tapa lo
 * clínico** —si `community` se cae, la campana sigue mostrando la receta— y que
 * **no se finge marcar leído lo que el backend no sabe marcar**: `community` no
 * expone esa escritura, así que las sociales no se tocan.
 *
 * Las respuestas se drenan con `resolver()` en vez de contarlas una por una: el
 * arranque dispara la bandeja y, cuando el perfil público llega, la vuelve a
 * pedir con lo social. Afirmar el número exacto de llamadas ataría la prueba a
 * un detalle de orquestación que no es lo que la campana promete.
 */
describe('NotificationsStore', () => {
  let store: NotificationsStore;
  let http: HttpTestingController;

  const VACIA = {
    items: [],
    count: 0,
    limit: 8,
    nextCursor: null,
    unreadCount: 0,
  };

  const paginaMessaging = (unreadCount: number) => ({
    items: [
      {
        id: 'n-1',
        category: 'CLINICAL',
        subject: 'Tu receta está lista',
        bodyText: null,
        destination: { type: 'PRESCRIPTION', id: 'rx-1' },
        payloadJson: null,
        unread: true,
        availableAt: '2026-08-18T10:00:00.000Z',
        readAt: null,
      },
    ],
    count: 1,
    limit: 8,
    nextCursor: null,
    unreadCount,
  });

  const paginaSocial = (unreadCount: number) => ({
    items: [
      {
        id: 's-1',
        notificationTypeConceptId: 'c-follow',
        actorProfileId: null,
        sourceTypeConceptId: 'c-post',
        sourceRefId: 'p-1',
        previewText: 'Alguien comentó tu publicación',
        isRead: false,
        readAt: null,
        createdAt: '2026-08-18T11:00:00.000Z',
      },
    ],
    count: 1,
    limit: 8,
    nextCursor: null,
    unreadCount,
  });

  /**
   * Contesta todo lo pendiente, incluso lo que una respuesta dispare después.
   *
   * @param opciones - Qué contestar a cada fuente, y si lo social falla.
   */
  const resolver = (opciones: {
    /** Perfil público propio, o `null`. */
    perfil?: { id: string } | null;
    /** Página del módulo 35. */
    messaging?: unknown;
    /** Página social. */
    social?: unknown;
    /** Si lo social responde con error de red. */
    socialFalla?: boolean;
  }): void => {
    // Una respuesta puede disparar otra llamada (resolver el perfil vuelve a
    // pedir la bandeja): se repite hasta que no quede nada abierto.
    for (let vuelta = 0; vuelta < 5; vuelta += 1) {
      const pendientes = http.match(() => true);
      if (pendientes.length === 0) {
        return;
      }
      for (const pedido of pendientes) {
        const url = pedido.request.url;
        if (url === '/community/profiles/me') {
          pedido.flush(opciones.perfil ?? null);
        } else if (url === '/notifications/me') {
          pedido.flush(opciones.messaging ?? VACIA);
        } else if (url === '/community/notifications') {
          if (opciones.socialFalla) {
            pedido.error(new ProgressEvent('error'));
          } else {
            pedido.flush(opciones.social ?? VACIA);
          }
        } else {
          pedido.flush(null);
        }
      }
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
      ],
    });
    store = TestBed.inject(NotificationsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    store.detener();
    // Se drena antes de verificar: un pendiente que quedó por el sondeo no es
    // un defecto de la prueba anterior, y dejarlo abierto haría fallar en
    // cascada a todas las siguientes.
    http.match(() => true).forEach((pedido) => pedido.flush(VACIA));
    http.verify();
  });

  it('suma los dos totales sin leer: el badge cuenta las dos bandejas', () => {
    store.iniciar();
    resolver({
      perfil: { id: 'pp-1' },
      messaging: paginaMessaging(3),
      social: paginaSocial(2),
    });

    expect(store.sinLeer()).toBe(5);
    expect(store.avisos().length).toBe(2);
    // Ordenadas por fecha y no por fuente: lo último que pasó va arriba.
    expect(store.avisos()[0].fuente).toBe('community');
  });

  it('sigue mostrando lo clínico aunque lo social falle', () => {
    store.iniciar();
    resolver({
      perfil: { id: 'pp-1' },
      messaging: paginaMessaging(1),
      socialFalla: true,
    });

    expect(store.sinLeer()).toBe(1);
    expect(store.avisos()[0].titulo).toBe('Tu receta está lista');
    // El fallo de lo social no se le cuenta a nadie: la campana trajo lo que
    // importaba.
    expect(store.error()).toBe('');
  });

  it('sin perfil público sólo lee la bandeja del módulo 35', () => {
    store.iniciar();
    resolver({ perfil: null, messaging: paginaMessaging(4) });

    expect(store.sinLeer()).toBe(4);
    expect(store.avisos().length).toBe(1);
    // `null` es un estado legítimo —quien no publicó nunca no tiene vitrina—,
    // no un error.
    expect(store.error()).toBe('');
  });

  it('no borra lo que ya mostraba cuando un tic falla', () => {
    store.iniciar();
    resolver({ perfil: null, messaging: paginaMessaging(2) });
    expect(store.avisos().length).toBe(1);

    store.refrescar();
    http
      .match((r) => r.url === '/notifications/me')
      .forEach((pedido) => pedido.error(new ProgressEvent('error')));

    expect(store.avisos().length).toBe(1);
    expect(store.error()).not.toBe('');
  });

  it('no intenta marcar leída una notificación social', () => {
    store.iniciar();
    resolver({
      perfil: { id: 'pp-1' },
      messaging: paginaMessaging(1),
      social: paginaSocial(1),
    });

    const social = store.avisos().find((aviso) => aviso.fuente === 'community');
    store.marcarLeida(social!);

    // Ni una llamada: `community` no expone la escritura, y bajar el badge en
    // pantalla haría que el próximo tic lo volviera a subir.
    http.expectNone((r) => r.method === 'POST');
  });

  it('marca la del módulo 35 y vuelve a leer', () => {
    store.iniciar();
    resolver({ perfil: null, messaging: paginaMessaging(1) });

    store.marcarLeida(store.avisos()[0]);
    http.expectOne('/notifications/in-app/n-1/read').flush({
      id: 'n-1',
      readAt: '2026-08-18T12:00:00.000Z',
      alreadyRead: false,
    });
    resolver({ messaging: paginaMessaging(0) });

    expect(store.sinLeer()).toBe(0);
  });

  it('marca toda la bandeja de una vez', () => {
    store.iniciar();
    resolver({ perfil: null, messaging: paginaMessaging(5) });

    store.marcarTodasLeidas();
    http
      .expectOne('/notifications/in-app/read-all')
      .flush({ marked: 5, unreadCount: 0 });
    resolver({ messaging: VACIA });

    expect(store.sinLeer()).toBe(0);
  });
});
