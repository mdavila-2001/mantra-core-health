import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { endpointHash, writeOwner } from './web-push-local';
import { SUBSCRIPTION_CHANGED_MESSAGE, WebPushService } from './web-push.service';

/**
 * What these tests pin: a browser subscription belongs to one person. Logout
 * unsubscribes it, the same person gets push back on login without a prompt, and
 * nobody ever inherits a live subscription saved for someone else (even when the
 * logout cleanup did not run). The API is not told again when nothing changed.
 */
function jwt(sub: string): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub, roles: ['USER'], tenants: ['t-1'] })}.firma`;
}

describe('WebPushService · ownership and resync', () => {
  let service: WebPushService;
  let session: SessionStore;
  let http: HttpTestingController;
  let live: PushSubscription | null;
  let created: number;
  let messageListener: ((event: MessageEvent) => void) | null;

  function fakeSubscription(endpoint: string): PushSubscription {
    const sub = {
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(30), auth: 'a'.repeat(12) } }),
      unsubscribe: vi.fn(async () => {
        if (live === sub) live = null;
        return true;
      }),
    } as unknown as PushSubscription;
    return sub;
  }

  function installBrowser(permission: NotificationPermission): void {
    vi.stubGlobal('Notification', { permission, requestPermission: vi.fn() });
    vi.stubGlobal('PushManager', class {});
    const registration = {
      pushManager: {
        getSubscription: vi.fn(async () => live),
        subscribe: vi.fn(async () => (live = fakeSubscription(`https://fcm.googleapis.com/fcm/send/${++created}`))),
      },
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        getRegistration: vi.fn().mockResolvedValue(registration),
        addEventListener: (_: string, fn: (event: MessageEvent) => void) => (messageListener = fn),
        removeEventListener: () => (messageListener = null),
      },
    });
  }

  const signIn = (sub: string) => session.start({ accessToken: jwt(sub), refreshToken: 'r' });

  async function answerConfig(): Promise<void> {
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/web-push/config')))).flush({
      enabled: true,
      publicKey: 'BAAA',
    });
  }

  async function answerConfigAndPut(): Promise<string> {
    await answerConfig();
    const put = await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/web-push/subscription')));
    expect(put.request.method).toBe('PUT');
    put.flush(null);
    return put.request.body.endpoint as string;
  }

  /** Person `sub` turns push on, as from the offer or Settings. */
  async function enableAs(sub: string): Promise<void> {
    signIn(sub);
    const enabling = service.enable();
    await answerConfigAndPut();
    expect(await enabling).toBe('enabled');
  }

  beforeEach(() => {
    localStorage.clear();
    live = null;
    created = 0;
    messageListener = null;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WebPushService);
    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('after a logout the same person gets push back on login, fresh and with no prompt', async () => {
    installBrowser('granted');
    await enableAs('u-1');
    await service.forgetBrowser();
    session.clear();
    expect(live).toBeNull();

    signIn('u-1');
    const resync = service.resync();
    expect(await answerConfigAndPut()).toBe('https://fcm.googleapis.com/fcm/send/2');
    await resync;
    expect(service.subscribed()).toBe(true);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("A's live subscription, B logs in and no cleanup ran: B is not subscribed and it is removed", async () => {
    installBrowser('granted');
    await enableAs('u-a');
    session.clear(); // the session ended without forgetBrowser (expired refresh, failed chunk…)

    signIn('u-b');
    await service.resync();

    expect(live).toBeNull();
    expect(service.subscribed()).toBe(false);
    expect(service.canOffer()).toBe(true);
  });

  it('and if B had opted in here, B gets a fresh subscription, never A’s', async () => {
    installBrowser('granted');
    await enableAs('u-b');
    await service.forgetBrowser();
    await enableAs('u-a');
    session.clear();

    signIn('u-b');
    const resync = service.resync();
    expect(await answerConfigAndPut()).toBe('https://fcm.googleapis.com/fcm/send/3');
    await resync;
  });

  it('a reload with this person’s unchanged subscription does not repeat the PUT (nor ask the config)', async () => {
    installBrowser('granted');
    await enableAs('u-1');
    await service.resync();
    await service.resync();
    expect(service.subscribed()).toBe(true);
  });

  it('a rotated endpoint is sent once; concurrent resyncs (tabs, worker messages) share one run', async () => {
    installBrowser('granted');
    await enableAs('u-1');
    live = fakeSubscription('https://fcm.googleapis.com/fcm/send/rotated');

    const stop = service.watchWorker();
    messageListener?.({ data: { type: SUBSCRIPTION_CHANGED_MESSAGE } } as MessageEvent);
    messageListener?.({ data: { type: SUBSCRIPTION_CHANGED_MESSAGE } } as MessageEvent);
    expect(await answerConfigAndPut()).toBe('https://fcm.googleapis.com/fcm/send/rotated');
    await service.resync();
    stop();
    expect(messageListener).toBeNull();
  });

  it('a live subscription nobody owns (saved before ownership existed) is removed and offered again', async () => {
    installBrowser('granted');
    live = fakeSubscription('https://fcm.googleapis.com/fcm/send/legacy');
    localStorage.setItem('alovida.webpush.offered', '1');
    signIn('u-1');

    await service.resync();

    expect(live).toBeNull();
    expect(service.canOffer()).toBe(true);
  });

  it('the legacy browser-wide offer flag is honoured once, for the first person, then dropped', async () => {
    installBrowser('default');
    localStorage.setItem('alovida.webpush.offered', '1');
    signIn('u-1');
    await service.resync();
    expect(service.canOffer()).toBe(false);
    expect(localStorage.getItem('alovida.webpush.offered')).toBeNull();

    signIn('u-2');
    await service.resync();
    expect(service.canOffer()).toBe(true);
  });

  it('a logout while the resync waits for the server aborts it: no PUT with the next token', async () => {
    installBrowser('granted');
    await enableAs('u-1');
    await service.forgetBrowser();
    signIn('u-1');
    const resync = service.resync();
    const config = await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/web-push/config')));
    signIn('u-2');
    config.flush({ enabled: true, publicKey: 'BAAA' });
    await resync;
    http.expectNone((r) => r.url.endsWith('/web-push/subscription'));
    expect(live).toBeNull();
  });

  it('turning it off in Settings forgets the opt-in', async () => {
    installBrowser('granted');
    await enableAs('u-1');
    const disabling = service.disable();
    (await vi.waitFor(() => http.expectOne((r) => r.method === 'DELETE'))).flush(null);
    await disabling;

    await service.resync();
    expect(live).toBeNull();
  });

  it('the offer is per person and never with the permission blocked', () => {
    installBrowser('default');
    expect(service.canOffer()).toBe(false);
    signIn('u-1');
    expect(service.canOffer()).toBe(true);
    service.markOffered();
    expect(service.canOffer()).toBe(false);
    signIn('u-2');
    expect(service.canOffer()).toBe(true);

    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(service.canOffer()).toBe(false);
  });

  it('an owner record for this person with the same endpoint is trusted without network', async () => {
    installBrowser('granted');
    live = fakeSubscription('https://fcm.googleapis.com/fcm/send/kept');
    writeOwner({ user: 'u-1', endpoint: endpointHash('https://fcm.googleapis.com/fcm/send/kept') });
    signIn('u-1');
    await service.resync();
    expect(service.subscribed()).toBe(true);
  });
});
