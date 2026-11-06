/**
 * Shared kit of the «Encuestas por servicio» evidence scripts
 * (`service-surveys-captures.mjs`, `survey-sheet-captures.mjs`): one browser,
 * serial, VIEWPORT-only captures, demo chip hidden, pointer away, reduced motion.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, expect } from '@playwright/test';

export const BASE = process.env.BASE ?? 'http://localhost:4200';
export const OUT = process.env.OUT ?? 'docs/refactor-profesional/trabajo/capturas/despues/surveys-per-service-2026-11-06-r6';
mkdirSync(OUT, { recursive: true });

export const DOCTOR = 'medica@alovida.mock';
export const servicesUrl = '/questionnaires?encuestas=servicios';
export const browser = await chromium.launch();

export async function signIn(page, email) {
  await page.goto(`${BASE}/auth`);
  await expect(page.getByTestId('login-identifier')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
}

/** Router navigation, like the menu (no reload). */
export async function go(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
}

export async function shot(page, name) {
  // No hover state in any capture: the pointer goes to a neutral corner first.
  await page.mouse.move(1, 1);
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const hide = await page.addStyleTag({ content: 'aside.mock { display: none !important; }' });
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await hide.evaluate((node) => node.remove());
}

export async function fresh(width, height, failures = null, theme = 'light') {
  // Reduced motion: transitions finish at once, so no capture is a cross-fade.
  const context = await browser.newContext({ viewport: { width, height }, locale: 'es-BO', timezoneId: 'America/La_Paz', reducedMotion: 'reduce', colorScheme: theme });
  const page = await context.newPage();
  if (failures) await page.addInitScript((f) => sessionStorage.setItem('mock:fallos', JSON.stringify(f)), failures);
  // The app's own theme preference (`ThemeService`, `mantra-core-health.theme`).
  if (theme === 'dark') await page.addInitScript(() => localStorage.setItem('mantra-core-health.theme', 'dark'));
  return { context, page };
}

export const requests = (page, method, prefix) =>
  page.evaluate(([m, p]) => (window.__mockRequests ?? []).filter((r) => r.method === m && r.url.startsWith(p)), [method, prefix]);

export const list = (page) => page.getByTestId('service-surveys-list');

/** Scrolls `locator` to the top of the viewport, below the sticky header. */
export async function reveal(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 72));
}

/** Writes what the mock served to `<OUT>/<file>`. */
export function writeLog(file, log) {
  writeFileSync(join(OUT, file), `${JSON.stringify(log, null, 2)}\n`);
}
