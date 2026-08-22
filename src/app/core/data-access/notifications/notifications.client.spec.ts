import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotificationsClient } from './notifications.client';

/**
 * Lo que estas pruebas fijan.
 *
 * Que los opcionales que el servidor manda en `null` **no llegan como `null`**
 * a la vista —es la regla de `wire.ts`, y el defecto que produce cuando se
 * rompe es una fecha de 1970 o un «hay dato» falso— y que los parámetros
 * opcionales **no viajan cuando no se piden**: el backend valida con
 * `forbidNonWhitelisted` y una clave declarada en `undefined` vuelve 400.
 */
describe('NotificationsClient', () => {
  let client: NotificationsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(NotificationsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no manda ningún parámetro cuando no se pide ninguno', () => {
    client.listMine().subscribe();

    const req = http.expectOne('/notifications/me');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], count: 0, limit: 20, nextCursor: null, unreadCount: 0 });
  });

  it('manda unread, cursor y limit sólo cuando vienen', () => {
    client.listMine({ unread: true, limit: 5 }).subscribe();

    const req = http.expectOne((r) => r.url === '/notifications/me');
    expect(req.request.params.get('unread')).toBe('true');
    expect(req.request.params.get('limit')).toBe('5');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], count: 0, limit: 5, nextCursor: null, unreadCount: 0 });
  });

  it('convierte fechas y descarta los nulos del transporte', () => {
    let recibido: unknown;
    client.listMine().subscribe((pagina) => (recibido = pagina.items[0]));

    http.expectOne('/notifications/me').flush({
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
      limit: 20,
      nextCursor: null,
      unreadCount: 1,
    });

    expect(recibido).toEqual({
      id: 'n-1',
      category: 'CLINICAL',
      subject: 'Tu receta está lista',
      destination: { type: 'PRESCRIPTION', id: 'rx-1' },
      unread: true,
      availableAt: new Date('2026-08-18T10:00:00.000Z'),
    });
    // Las claves nulas se eliminan, no se ponen en `undefined`: es lo que hace
    // que `'bodyText' in aviso` diga lo mismo que el tipo.
    expect(Object.keys(recibido as object)).not.toContain('bodyText');
    expect(Object.keys(recibido as object)).not.toContain('readAt');
  });

  it('marca una como leída por POST y convierte la fecha', () => {
    let recibido: unknown;
    client.markRead('n-1').subscribe((r) => (recibido = r));

    const req = http.expectOne('/notifications/in-app/n-1/read');
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'n-1',
      readAt: '2026-08-18T11:00:00.000Z',
      alreadyRead: false,
    });

    expect(recibido).toEqual({
      id: 'n-1',
      readAt: new Date('2026-08-18T11:00:00.000Z'),
      alreadyRead: false,
    });
  });

  it('marca toda la bandeja de una vez', () => {
    let recibido: unknown;
    client.markAllRead().subscribe((r) => (recibido = r));

    const req = http.expectOne('/notifications/in-app/read-all');
    expect(req.request.method).toBe('POST');
    req.flush({ marked: 12, unreadCount: 0 });

    expect(recibido).toEqual({ marked: 12, unreadCount: 0 });
  });
});
