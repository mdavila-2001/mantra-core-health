/**
 * Shared kit of the «Encuestas por servicio» evidence scripts
 * (`service-surveys-captures.mjs`, `survey-sheet-captures.mjs`): one browser,
 * serial, VIEWPORT-only captures, demo chip hidden, pointer away, reduced motion.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, expect } from '@playwright/test';

export const BASE = process.env.BASE ?? 'http://localhost:4200';
export const OUT = process.env.OUT ?? 'docs/refactor-profesional/trabajo/capturas/despues/surveys-per-service-2026-11-06-r7';
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

/**
 * A survey sheet is captured only once it settled: status checked, no skeleton,
 * and the open answers panel showing its content (answers, bars or a state).
 */
export async function settledSheet(page) {
  const sheet = page.locator('app-survey-detail');
  await expect(page.getByTestId('survey-detail-sending')).not.toHaveText('Comprobando…', { timeout: 30_000 });
  await expect(sheet.locator('app-skeleton')).toHaveCount(0, { timeout: 30_000 });
  const panel = sheet.locator('[data-testid="survey-detail-answers"], [data-testid="survey-detail-summary"]');
  if ((await panel.count()) > 0) {
    await expect(panel.locator('.encuesta__respuesta, [data-testid="survey-detail-summary-bars"], app-empty-state, app-alert').first()).toBeVisible({ timeout: 30_000 });
  }
}

/** Bottom edge of the sticky top bar (0 when there is none). */
const headerBottom = (page) => page.evaluate(() => document.querySelector('header[app-header]')?.getBoundingClientRect().bottom ?? 0);

/** `belowHeader`: the frame starts under the sticky top bar, so nothing scrolled shows through it. */
export async function shot(page, name, { belowHeader = false } = {}) {
  if ((await page.locator('app-survey-detail').count()) > 0) await settledSheet(page);
  // No hover state in any capture: the pointer goes to a neutral corner first.
  await page.mouse.move(1, 1);
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const hide = await page.addStyleTag({ content: 'aside.mock { display: none !important; }' });
  const top = belowHeader ? Math.ceil(await headerBottom(page)) : 0;
  const { width, height } = page.viewportSize();
  await page.screenshot({ path: join(OUT, `${name}.png`), ...(top > 0 ? { clip: { x: 0, y: top, width, height: height - top } } : {}) });
  await hide.evaluate((node) => node.remove());
}

/** md5 of a capture already written, to prove two captures differ. */
export const digest = (name) => createHash('md5').update(readFileSync(join(OUT, `${name}.png`))).digest('hex');

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

/** Scrolls `locator` to the top of the viewport, just below the sticky header (measured, not guessed). */
export async function reveal(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const offset = (await headerBottom(page)) + 16;
  await locator.evaluate((element, gap) => window.scrollBy(0, element.getBoundingClientRect().top - gap), offset);
}

/** Writes what the mock served to `<OUT>/<file>`. */
export function writeLog(file, log) {
  writeFileSync(join(OUT, file), `${JSON.stringify(log, null, 2)}\n`);
}
