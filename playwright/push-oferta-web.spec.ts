import { expect, test, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';

import {
  fakeBrowserPush,
  login,
  logout,
  mockApi,
  openSignedIn,
  PUSH_DIST,
  PUSH_EVIDENCE,
  pushBuildMissing,
  pushCalls,
  routeApi,
  serveBuild,
  type MockApi,
} from './support/push-web';

/**
 * The one-time push offer of the private area (06/11/2026), against the `real-api`
 * build with the API answered by `page.route` and a fake `PushManager` (headless
 * Chromium has no push service). What is asserted is what leaves the page: the PUT
 * and its endpoint, the browser subscription, and what the person sees.
 * Screenshots go to docs/trabajo/2026-11-06-push-notificaciones/evidencia/.
 */
// Without the build this fails on purpose (never a silent skip): build it first.
test.beforeAll(() => {
  if (pushBuildMissing) throw new Error(`Falta el build real-api en ${PUSH_DIST} (E2E_PUSH_DIST).`);
});
test.use({ channel: 'chromium' });

let origin = '';
let close: () => void = () => undefined;
test.beforeAll(async () => ({ origin, close } = await serveBuild()));
test.afterAll(() => close());
const contexts: BrowserContext[] = [];
// Open background pages keep the browser busy and starve `@defer (on idle)` of later tests.
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

const offer = (page: Page) => page.getByTestId('web-push-offer');
/** The offer component finished deciding for this sign-in (resync done, offer shown or not). */
const decided = (page: Page) => expect(page.locator('app-web-push-offer[data-ready]')).toBeAttached({ timeout: 30_000 });
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${PUSH_EVIDENCE}/${name}.png`, animations: 'disabled', caret: 'hide' });

async function start(
  browser: Browser,
  api: MockApi,
  opts: { permission?: NotificationPermission; answer?: NotificationPermission; push?: boolean; serviceOff?: boolean; theme?: string } & BrowserContextOptions = {},
): Promise<Page> {
  const { permission = 'default', answer, push, serviceOff, theme = 'light', ...context } = opts;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...context });
  contexts.push(ctx);
  await ctx.addInitScript((mode) => localStorage.setItem('mantra-core-health.theme', mode), theme);
  await fakeBrowserPush(ctx, { permission, answer, push, serviceOff });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => console.log(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  await routeApi(page, api);
  await openSignedIn(page, origin, api);
  return page;
}

test('ofrece una vez, «Activar avisos» suscribe, y recargar no repite el PUT ni el aviso (consola y red limpias)', async ({ browser }) => {
  const api = mockApi('u-a');
  const page = await start(browser, api, { permission: 'granted' });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

  await expect(offer(page)).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.getByTestId('web-push-offer-activar').click();
  await expect(offer(page)).toBeHidden();
  await expect.poll(() => pushCalls(api).length).toBe(1);
  expect(pushCalls(api)[0]).toMatchObject({ method: 'PUT', body: { endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-1' } });

  await page.reload();
  await decided(page);
  await expect(offer(page)).toBeHidden();
  expect(pushCalls(api)).toHaveLength(1);
  expect(errors).toEqual([]);
});

for (const [name, opts] of [
  ['light-390', {}],
  ['dark-390', { theme: 'dark' }],
  ['light-320', { viewport: { width: 320, height: 720 } }],
  ['light-640', { viewport: { width: 640, height: 800 } }],
  ['light-1280', { viewport: { width: 1280, height: 800 } }],
  // 200 % zoom of a 1280 px window: 640 CSS px at device scale 2.
  ['zoom200-1280', { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }],
] as const) {
  test(`captura de la oferta: ${name}`, async ({ browser }) => {
    const page = await start(browser, mockApi('u-a'), opts);
    await expect(offer(page)).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await shot(page, `oferta-push-${name}`);
  });
}

test('teclado: «Activar avisos» y luego «Ahora no», con el foco visible', async ({ browser }) => {
  const page = await start(browser, mockApi('u-a'), { viewport: { width: 1280, height: 800 } });
  const activar = page.getByTestId('web-push-offer-activar');
  await expect(activar).toBeVisible({ timeout: 30_000 });
  await activar.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(activar).toBeFocused();
  expect(await activar.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  await shot(page, 'oferta-push-foco-activar-1280');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('web-push-offer-ahora-no')).toBeFocused();
  await shot(page, 'oferta-push-foco-ahora-no-1280');
});

test('mientras activa: «Activar» ocupado y «Ahora no» deshabilitado', async ({ browser }) => {
  const api = mockApi('u-a');
  api.putDelayMs = 4000;
  const page = await start(browser, api, { permission: 'granted' });
  await expect(offer(page)).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('web-push-offer-activar').click();
  await expect(page.getByTestId('web-push-offer-activar')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('web-push-offer-ahora-no')).toHaveAttribute('aria-disabled', 'true');
  await shot(page, 'oferta-push-cargando-390');
  await expect(offer(page)).toBeHidden({ timeout: 10_000 });
});

test('errores: bloqueado dice cómo desbloquearlo, no disponible solo «Entendido», fallo permite reintentar', async ({ browser }) => {
  for (const theme of ['light', 'dark']) {
    const denied = await start(browser, mockApi('u-a'), { answer: 'denied', theme });
    await denied.getByTestId('web-push-offer-activar').click();
    await expect(denied.getByTestId('web-push-offer-notice')).toHaveAttribute('data-reason', 'denied');
    await expect(denied.getByTestId('web-push-offer-notice')).toContainText('candado');
    await expect(denied.getByTestId('web-push-offer-ajustes')).toHaveCount(0);
    await expect(denied.getByTestId('web-push-offer-activar')).toHaveCount(0);
    await shot(denied, theme === 'light' ? 'oferta-push-error-denied-390' : 'oferta-push-error-denied-dark-390');
  }

  const off = mockApi('u-a');
  off.config = [true, false];
  const unavailable = await start(browser, off, { permission: 'granted' });
  await unavailable.getByTestId('web-push-offer-activar').click();
  await expect(unavailable.getByTestId('web-push-offer-notice')).toHaveAttribute('data-reason', 'unavailable');
  await expect(unavailable.getByTestId('web-push-offer-activar')).toHaveCount(0);
  await shot(unavailable, 'oferta-push-error-unavailable-390');
  await unavailable.getByTestId('web-push-offer-entendido').click();
  await expect(offer(unavailable)).toBeHidden();

  const broken = mockApi('u-a');
  broken.putStatus = 500;
  const failed = await start(browser, broken, { permission: 'granted' });
  await failed.getByTestId('web-push-offer-activar').click();
  await expect(failed.getByTestId('web-push-offer-notice')).toHaveAttribute('data-reason', 'failed');
  await expect(failed.getByTestId('web-push-offer-activar')).toContainText('Reintentar');
  await shot(failed, 'oferta-push-error-failed-390');
  // While retrying, «Entendido» is disabled as well.
  broken.putDelayMs = 3000;
  await failed.getByTestId('web-push-offer-activar').click();
  await expect(failed.getByTestId('web-push-offer-entendido')).toHaveAttribute('aria-disabled', 'true');
});

test('Brave con su servicio push apagado: permiso concedido, dice dónde activarlo, sin «Reintentar» ni PUT', async ({ browser }) => {
  for (const [theme, viewport] of [['light', { width: 390, height: 844 }], ['light', { width: 1280, height: 800 }], ['dark', { width: 390, height: 844 }]] as const) {
    const api = mockApi('u-a');
    const page = await start(browser, api, { permission: 'granted', serviceOff: true, theme, viewport });
    await page.getByTestId('web-push-offer-activar').click();
    const notice = page.getByTestId('web-push-offer-notice');
    await expect(notice).toHaveAttribute('data-reason', 'service');
    await expect(notice).toContainText('mensajería push');
    await expect(notice).not.toContainText('Intente de nuevo');
    await expect(page.getByTestId('web-push-offer-activar')).toHaveCount(0);
    expect(pushCalls(api)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await shot(page, `oferta-push-error-service-${theme}-${viewport.width}`);
    await page.getByTestId('web-push-offer-entendido').click();
    await expect(offer(page)).toBeHidden();
  }
});

test('sin PushManager (no soportado) no se ofrece ni se pregunta al servidor', async ({ browser }) => {
  const api = mockApi('u-a');
  const page = await start(browser, api, { push: false });
  await decided(page);
  await expect(offer(page)).toHaveCount(0);
  expect(api.calls.filter((c) => c.path.includes('web-push'))).toEqual([]);
});

test('«Ahora no» lo oculta y no vuelve al recargar', async ({ browser }) => {
  const api = mockApi('u-a');
  const page = await start(browser, api);
  await page.getByTestId('web-push-offer-ahora-no').click();
  await expect(offer(page)).toBeHidden();
  await page.reload();
  await decided(page);
  await expect(offer(page)).toHaveCount(0);
  expect(pushCalls(api)).toEqual([]);
});

test('con otro aviso del área privada en pantalla, la oferta espera', async ({ browser }) => {
  const api = mockApi('u-a');
  api.extraClaims = { deniedTenants: { 't-2': 'OUTSIDE_HOURS' } };
  const page = await start(browser, api);
  await expect(page.getByTestId('aviso-organizaciones-negadas')).toBeVisible({ timeout: 30_000 });
  await decided(page);
  await expect(offer(page)).toHaveCount(0);
  await shot(page, 'oferta-push-apilada-390');
});

test('salir y volver: la misma persona recupera el push sola; otra persona no lo hereda', async ({ browser }) => {
  const api = mockApi('u-a');
  const page = await start(browser, api, { permission: 'granted' });
  await page.getByTestId('web-push-offer-activar').click();
  await expect.poll(() => pushCalls(api).length).toBe(1);

  await logout(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('e2e.sub'))).toBeNull();

  await login(page);
  await expect.poll(() => pushCalls(api).length).toBe(2);
  expect(pushCalls(api)[1]!.body).toMatchObject({ endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-2' });
  await expect(offer(page)).toHaveCount(0);

  await logout(page);
  api.user = 'u-b';
  await login(page);
  await expect(offer(page)).toBeVisible({ timeout: 30_000 });
  expect(pushCalls(api)).toHaveLength(2);
  expect(await page.evaluate(() => localStorage.getItem('e2e.sub'))).toBeNull();
});

test('si la limpieza del cierre no corrió, quien entra después no adopta la suscripción ajena', async ({ browser }) => {
  const api = mockApi('u-b');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  contexts.push(ctx);
  await fakeBrowserPush(ctx, { permission: 'granted' });
  const page = await ctx.newPage();
  await routeApi(page, api);
  // A's registered worker, live subscription and owner record, as left by a session
  // that ended without its cleanup (expired refresh, cleanup chunk not loaded).
  await page.goto(`${origin}/e2e-blank`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;
    localStorage.setItem('e2e.sub', 'https://fcm.googleapis.com/fcm/send/de-a');
    localStorage.setItem('alovida.webpush.owner', JSON.stringify({ user: 'u-a', endpoint: 'x' }));
    localStorage.setItem('alovida.webpush.optin:u-a', '1');
  });
  await openSignedIn(page, origin, api);

  await expect(offer(page)).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem('e2e.sub'))).toBeNull();
  expect(pushCalls(api)).toEqual([]);
});

test('Ajustes › Permisos: si encender «Avisos del navegador» no deja el push andando, lo dice', async ({ browser }) => {
  const api = mockApi('u-a');
  api.config = [false];
  const page = await start(browser, api);
  await page.goto(`${origin}/settings`);
  await page.getByRole('tab', { name: 'Permisos' }).click();
  await page.getByTestId('permission-avisos').locator('.switch-track').click();
  await expect(page.getByTestId('permission-avisos-notice')).toContainText('todavía no están disponibles');
  // Permission granted but push unavailable: the switch says off, as the notice does.
  await expect(page.getByTestId('permission-avisos').locator('input[role="switch"]')).not.toBeChecked();
  await expect(page.getByTestId('permission-avisos').locator('input[role="switch"]')).toBeEnabled();
  await page.getByTestId('permission-avisos-notice').scrollIntoViewIfNeeded();
  await shot(page, 'ajustes-avisos-no-disponible-390');
});
