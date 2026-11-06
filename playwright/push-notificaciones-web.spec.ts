import { expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';

import { pushBuildMissing, PUSH_DIST, serveBuild } from './support/push-web';

/**
 * Push web (06/11/2026): the real `push-sw.js` in a real Chromium.
 *
 * A trusted `push` event is delivered through the DevTools protocol
 * (`ServiceWorker.deliverPushMessage`), so the real handler shows the notice; its
 * tag, route and body are read back with `getNotifications()`. The click handler's
 * routing (`openRoute`) runs inside the worker and must move the open window to the
 * payload route, or to `/notification-center` for an unsafe route. A real OS click
 * cannot be synthesised: the `notificationclick` listener is a one-line call to it.
 * The offer in the private area is in `push-oferta-web.spec.ts`.
 *
 * Needs the build: `yarn ng build --configuration real-api` (path in E2E_PUSH_DIST).
 */
test.skip(pushBuildMissing, `Falta el build en ${PUSH_DIST}. No es un verde.`);
// The headless shell denies the notifications permission even when granted;
// the full Chromium build (new headless) shows them.
test.use({ channel: 'chromium' });

let origin = '';
let close: () => void = () => undefined;
test.beforeAll(async () => ({ origin, close } = await serveBuild()));
test.afterAll(() => close());

async function registeredWorker(context: BrowserContext, page: Page): Promise<Worker> {
  await page.goto(`${origin}/e2e-blank`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;
  });
  // The worker claims open clients on activate; a reload makes control certain.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

test('el aviso push real muestra un aviso por notificación con su ruta, y al tocarlo abre esa ruta', async ({ browser }) => {
  const context = await browser.newContext();
  await context.grantPermissions(['notifications'], { origin });
  const page = await context.newPage();
  const worker = await registeredWorker(context, page);

  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((found) =>
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const ours = registrations.find((r: { scopeURL: string }) => r.scopeURL.startsWith(origin));
      if (ours) found(ours.registrationId);
    }),
  );
  await cdp.send('ServiceWorker.enable');
  const id = await registrationId;
  for (const n of ['n-1', 'n-2']) {
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin, registrationId: id,
      data: JSON.stringify({ notificationId: n, route: `/notification-center`, destinationType: '', destinationId: '', category: 'SCHEDULING' }),
    });
  }
  await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId: id, data: JSON.stringify({ route: '//evil.example/x' }) });

  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const registration = (self as unknown as { registration: ServiceWorkerRegistration }).registration;
        return (await registration.getNotifications()).map((x) => `${x.tag}|${x.data?.route}|${x.body}`).sort();
      }),
    )
    .toEqual([
      'alovida-aviso|/notification-center|Tiene un aviso nuevo en AloVida',
      'alovida-n-1|/notification-center|Tiene un aviso nuevo en AloVida',
      'alovida-n-2|/notification-center|Tiene un aviso nuevo en AloVida',
    ]);

  interface Push { openRoute: (r: string) => Promise<unknown> }
  await worker.evaluate((r) => (self as unknown as { alovidaPush: Push }).alovidaPush.openRoute(r), '/agenda/mis-turnos');
  await expect(page).toHaveURL(`${origin}/agenda/mis-turnos`);
  await worker.evaluate(() => (self as unknown as { alovidaPush: Push }).alovidaPush.openRoute('https://evil.example/'));
  await expect(page).toHaveURL(`${origin}/notification-center`);
  await context.close();
});

