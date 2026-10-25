import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WebPushService, urlBase64ToBytes } from './web-push.service';

/**
 * Lo que estas pruebas fijan: que el permiso se ofrece **una sola vez** y sólo
 * cuando tiene sentido, que un navegador sin push no rompe nada, y que lo que
 * viaja a la API es la suscripción tal como la entrega el navegador.
 */
describe('WebPushService', () => {
  let service: WebPushService;
  let http: HttpTestingController;
  let requestPermission: ReturnType<typeof vi.fn>;
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'p'.repeat(30), auth: 'a'.repeat(12) },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };

  function instalarNavegador(permission: NotificationPermission): void {
    requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission, requestPermission });
    vi.stubGlobal('PushManager', class {});
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(subscription),
      },
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WebPushService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('sin soporte del navegador no hace nada ni pide red', async () => {
    expect(service.supported).toBe(false);
    expect(await service.offerAfterFirstBooking()).toBe('skipped');
    expect(await service.enable()).toBe('unsupported');
    http.expectNone(() => true);
  });

  it('si el servidor no tiene push, lo dice y no pide el permiso', async () => {
    instalarNavegador('default');
    const result = service.enable();
    const config = await vi.waitFor(() =>
      http.expectOne((r) => r.url.endsWith('/notifications/web-push/config')),
    );
    config.flush({ enabled: false, publicKey: null });
    expect(await result).toBe('unavailable');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('activa: pide permiso, suscribe y manda la suscripción a la API', async () => {
    instalarNavegador('default');
    const result = service.enable();
    const config = await vi.waitFor(() =>
      http.expectOne((r) => r.url.endsWith('/notifications/web-push/config')),
    );
    config.flush({ enabled: true, publicKey: 'BAAA' });
    const put = await vi.waitFor(() =>
      http.expectOne((r) => r.url.endsWith('/notifications/web-push/subscription')),
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.endpoint).toBe('https://fcm.googleapis.com/fcm/send/abc');
    expect(put.request.body.keys.auth).toBe('a'.repeat(12));
    put.flush(null);
    expect(await result).toBe('enabled');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(service.subscribed()).toBe(true);
  });

  it('el permiso bloqueado devuelve «denied» sin tocar la API de suscripción', async () => {
    instalarNavegador('denied');
    const result = service.enable();
    const config = await vi.waitFor(() =>
      http.expectOne((r) => r.url.endsWith('/notifications/web-push/config')),
    );
    config.flush({ enabled: true, publicKey: 'BAAA' });
    expect(await result).toBe('denied');
    http.expectNone((r) => r.url.endsWith('/subscription'));
  });

  it('ofrece el permiso una sola vez', async () => {
    instalarNavegador('default');
    const first = service.offerAfterFirstBooking();
    const config = await vi.waitFor(() =>
      http.expectOne((r) => r.url.endsWith('/notifications/web-push/config')),
    );
    config.flush({ enabled: false, publicKey: null });
    expect(await first).toBe('unavailable');
    expect(await service.offerAfterFirstBooking()).toBe('skipped');
  });

  it('al cerrar sesión da de baja la suscripción del navegador sin llamar a la API', async () => {
    instalarNavegador('granted');
    const registration = await navigator.serviceWorker.getRegistration();
    const baja = vi.fn().mockResolvedValue(true);
    vi.mocked(registration!.pushManager.getSubscription).mockResolvedValue({
      unsubscribe: baja,
    } as unknown as PushSubscription);

    await service.forgetBrowser();

    expect(baja).toHaveBeenCalledTimes(1);
    expect(service.subscribed()).toBe(false);
    http.expectNone(() => true);
  });

  it('no ofrece nada si la persona ya decidió', async () => {
    instalarNavegador('granted');
    expect(await service.offerAfterFirstBooking()).toBe('skipped');
    http.expectNone(() => true);
  });
});

describe('urlBase64ToBytes', () => {
  it('decodifica base64url con y sin relleno', () => {
    expect(Array.from(urlBase64ToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToBytes('-_8'))).toEqual([251, 255]);
  });
});
