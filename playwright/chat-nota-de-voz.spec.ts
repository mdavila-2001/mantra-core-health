import { expect, test, type Page } from '@playwright/test';

import { contentSecurityPolicy } from '../src/server/security-headers';
import { entrar } from './support/sesion';

/**
 * Voice note in the chat: an uncaptioned audio goes out WITHOUT `bodyText`
 * (the API rejected `bodyText: ''` with a 400) and is drawn like a messaging
 * app — play button, the real waveform, time and speed — instead of the bare
 * browser `<audio controls>`.
 */

/**
 * `ng serve` sends no CSP; the SSR server in dev does. Every page here gets
 * the real policy's media and connection directives, so a player that feeds
 * `<audio>` a `data:` URL (blocked in dev) fails here too.
 */
test.beforeEach(async ({ page }) => {
  const directivas = contentSecurityPolicy()
    .split('; ')
    .filter((d) => d.startsWith('media-src') || d.startsWith('connect-src'))
    .join('; ');
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const respuesta = await route.fetch();
    await route.fulfill({ response: respuesta, headers: { ...respuesta.headers(), 'content-security-policy': directivas } });
  });
});

/** Records what the store hands to the chat client, keeping the real call. */
async function espiarEnvios(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface Cliente { sendMessage: (...a: unknown[]) => unknown }
    interface Composer { store: { community: Cliente } }
    const ng = (window as unknown as { ng: { getComponent(el: Element): Composer } }).ng;
    const cliente = ng.getComponent(document.querySelector('app-composer')!).store.community;
    const original = cliente.sendMessage.bind(cliente);
    const registro: unknown[] = [];
    (window as unknown as { envios: unknown[] }).envios = registro;
    cliente.sendMessage = (id: unknown, cuerpo: unknown, ...resto: unknown[]) => {
      registro.push(cuerpo);
      return original(id, cuerpo, ...resto);
    };
  });
}

// Chromium's fake microphone: a real recording through `MediaRecorder`, the
// same path a person takes, with a beeping tone so the waveform is not flat.
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

test('una nota de voz sale sin bodyText y se ve como reproductor', async ({ page }) => {
  await entrar(page, { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mockup', nombre: 'Paciente' });
  await page.goto('/messaging');
  await page.getByTestId('conversacion').first().click();
  await expect(page.locator('app-composer')).toBeVisible({ timeout: 30_000 });
  await espiarEnvios(page);

  // Records whether the loading skeleton ever shows up from here on: a sent
  // voice note must go straight from its local copy to the player.
  await page.evaluate(() => {
    const w = window as unknown as { vioEsqueleto: boolean };
    w.vioEsqueleto = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="hilo-adjunto-cargando"]')) w.vioEsqueleto = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId('composer-audio').click();
  // Recording time is the condition: wait until the recorder shows 2 seconds.
  await expect(page.locator('app-composer')).toContainText('0:02', { timeout: 15_000 });
  await page.getByTestId('composer-audio-enviar').click();

  const nota = page.getByTestId('hilo-nota-voz').last();
  await expect(nota).toBeVisible({ timeout: 30_000 });
  await expect(nota.getByTestId('nota-voz-tiempo')).toHaveText(/^0:0[2-3]$/);

  // The note shows at once from the local copy; the send follows the upload.
  const leerEnvios = () => page.evaluate(() => (window as unknown as { envios: Record<string, unknown>[] }).envios);
  await expect.poll(async () => (await leerEnvios()).length, { timeout: 15_000 }).toBe(1);
  const envios = await leerEnvios();
  // The sent message takes over the local copy: no skeleton in between.
  await expect(nota).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { vioEsqueleto: boolean }).vioEsqueleto)).toBe(false);
  await expect(nota.getByTestId('nota-voz-tiempo')).toHaveText(/^0:0[2-3]$/);
  expect(envios[0]).toMatchObject({ contentType: 'MEDIA' });
  expect(envios[0]).not.toHaveProperty('bodyText');

  // The waveform comes from decoding the audio: undecoded bars are all the same
  // height. (The fake microphone beeps, so the decoded bars have two heights.)
  // The thread refreshes shortly after sending (for the ✓✓) and may remount the
  // bubble: measure by condition, not once.
  await expect(nota.locator('.nota-voz__barra')).toHaveCount(36);
  await expect
    .poll(async () => {
      const alturas = await nota.locator('.nota-voz__barra').evaluateAll((barras) => barras.map((b) => Math.round(b.getBoundingClientRect().height)));
      return new Set(alturas).size;
    })
    .toBeGreaterThan(1);

  await nota.getByTestId('nota-voz-velocidad').click();
  await expect(nota.getByTestId('nota-voz-velocidad')).toHaveText('1.5×');
  await nota.getByTestId('nota-voz-play').click();
  await expect(nota.getByTestId('nota-voz-play')).toHaveAttribute('aria-label', 'Pausar nota de voz');
  // It really plays: the element is not blocked and time moves forward.
  await expect.poll(() => nota.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 5_000 }).toBeGreaterThan(0);
  await expect(nota.getByTestId('nota-voz-play')).toHaveAttribute('aria-label', 'Reproducir nota de voz', { timeout: 10_000 });
  await expect(nota.getByTestId('nota-voz-tiempo')).toHaveText(/^0:0[2-3]$/);

  await nota.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/playwright/chat-nota-de-voz.png' });
  await page.getByTestId('header-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Theme change animates colors: the condition is that no transition is left.
  await page.waitForFunction(() => !document.getAnimations().some((a) => a instanceof CSSTransition));
  // The player takes the bubble's own text color in both themes.
  const burbuja = page.locator('.hilo__burbuja', { has: nota });
  const color = (el: Element): string => getComputedStyle(el).color;
  expect(await nota.getByTestId('nota-voz-tiempo').evaluate(color)).toBe(await burbuja.evaluate(color));
  await page.screenshot({ path: 'artifacts/playwright/chat-nota-de-voz-oscuro.png' });
});

test('si el envío de la nota de voz falla, la burbuja lo dice y no sigue «Subiendo…»', async ({ page }) => {
  await entrar(page, { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mockup', nombre: 'Paciente' });
  await page.goto('/messaging');
  await page.getByTestId('conversacion').first().click();
  await expect(page.locator('app-composer')).toBeVisible({ timeout: 30_000 });
  // The file uploads but the message is rejected (the 400 seen in dev),
  // through the store's real error path.
  await page.evaluate(() => {
    type ObservableClass = new (fn: (s: { error(e: unknown): void }) => void) => object;
    interface Composer {
      store: { community: { sendMessage(...a: unknown[]): object; conversationAttachmentDataUrl: unknown } };
    }
    const ng = (window as unknown as { ng: { getComponent(el: Element): Composer } }).ng;
    const store = ng.getComponent(document.querySelector('app-composer')!).store;
    // A cold HTTP observable is never subscribed: it only lends its class.
    const Observable = Object.getPrototypeOf(store.community.sendMessage('x', {})).constructor as ObservableClass;
    store.community.sendMessage = () => new Observable((s) => s.error(new Error('Envío rechazado')));
    // Without a message the attachment cannot be fetched either (as in dev).
    store.community.conversationAttachmentDataUrl = () => new Observable((s) => s.error(new Error('Sin mensaje')));
  });

  await page.getByTestId('composer-audio').click();
  await expect(page.locator('app-composer')).toContainText('0:01', { timeout: 15_000 });
  await page.getByTestId('composer-audio-enviar').click();

  await expect(page.getByTestId('hilo-reintentar').last()).toBeVisible();
  // The local copy keeps it playable while it can be retried.
  await expect(page.locator('.hilo__burbuja').last().getByTestId('hilo-nota-voz')).toBeVisible();
  await expect(page.locator('.hilo__burbuja').last()).not.toContainText('Subiendo el archivo');
});
