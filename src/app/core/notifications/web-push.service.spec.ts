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

  it('si el servidor no tiene push lo dice; el permiso se pidió antes, dentro del gesto', async () => {
    // Order changed on purpose (06/11/2026): Firefox and Safari drop the click's user
    // activation after a network round trip, so the prompt goes before the config.
    instalarNavegador('default');
    const result = service.enable();
    const config = await vi.waitFor(() =>
      http.expectOne((r) => r.url.endsWith('/notifications/web-push/config')),
    );
    config.flush({ enabled: false, publicKey: null });
    expect(await result).toBe('unavailable');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    http.expectNone((r) => r.url.endsWith('/subscription'));
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

  async function rechazarSuscripcion(name: string): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    vi.mocked(registration!.pushManager.subscribe).mockRejectedValue(
      new DOMException('Registration failed - push service error', name),
    );
  }

  it('permiso concedido pero el servicio push del navegador lo rechaza (Brave): «service», sin PUT', async () => {
    instalarNavegador('granted');
    await rechazarSuscripcion('AbortError');
    const first = service.enable();
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/config')))).flush({ enabled: true, publicKey: 'BAAA' });
    expect(await first).toBe('service');
    expect(service.subscribed()).toBe(false);

    http.expectNone((r) => r.url.endsWith('/subscription'));
  });

  it('una clave VAPID que el navegador no acepta es «unavailable», no culpa del navegador', async () => {
    instalarNavegador('granted');
    await rechazarSuscripcion('InvalidAccessError');
    const result = service.enable();
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/config')))).flush({ enabled: true, publicKey: 'BAAA' });
    expect(await result).toBe('unavailable');
  });

  it('otro rechazo del navegador (NotAllowedError) puede ser pasajero: «failed»', async () => {
    instalarNavegador('granted');
    await rechazarSuscripcion('NotAllowedError');
    const result = service.enable();
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/config')))).flush({ enabled: true, publicKey: 'BAAA' });
    expect(await result).toBe('failed');
  });

  it('una clave VAPID que ni siquiera es base64 es «unavailable»', async () => {
    instalarNavegador('granted');
    const result = service.enable();
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/config')))).flush({ enabled: true, publicKey: '***' });
    expect(await result).toBe('unavailable');
    http.expectNone((r) => r.url.endsWith('/subscription'));
  });

  it('si la API no guarda la suscripción es «failed» (vale reintentar)', async () => {
    instalarNavegador('granted');
    const result = service.enable();
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/config')))).flush({ enabled: true, publicKey: 'BAAA' });
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/subscription')))).flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    expect(await result).toBe('failed');
  });

  it('el permiso bloqueado devuelve «denied» sin tocar la API', async () => {
    instalarNavegador('denied');
    expect(await service.enable()).toBe('denied');
    http.expectNone(() => true);
  });

  it('un doble clic comparte una sola activación', async () => {
    instalarNavegador('granted');
    const first = service.enable();
    const second = service.enable();
    expect(second).toBe(first);
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/config')))).flush({ enabled: false, publicKey: null });
    expect(await first).toBe('unavailable');
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
