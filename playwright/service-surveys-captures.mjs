/**
 * Evidence for «Encuestas por servicio», the read-only «Buzón» and the
 * patient's «Mis encuestas» (06/11/2026, second review round).
 *
 * Against the demo build (`yarn start:demo`, mock backend). One browser, serial
 * captures, VIEWPORT-only screenshots (a full-page one lets the side rail cover
 * content). Never waits for `networkidle`: waits on elements. Failure states are
 * forced with the mock's `mock:fallos` switch (`simulated-failures.ts`); the
 * loading state holds back the mock's reply timer so the skeleton can be seen.
 *
 * Usage: `yarn node playwright/service-surveys-captures.mjs`
 * (`BASE`, default http://localhost:4200; `OUT`, default the evidence folder).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, expect } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'docs/refactor-profesional/trabajo/capturas/despues/surveys-per-service-2026-11-06-r2';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const log = [];

async function signIn(page, email) {
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
async function go(page, path) {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
}

async function shot(page, name) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

async function fresh(width, height, failures = null) {
  // Reduced motion: transitions finish at once, so no capture is a cross-fade.
  const context = await browser.newContext({ viewport: { width, height }, locale: 'es-BO', timezoneId: 'America/La_Paz', reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (failures) {
    await page.addInitScript((f) => sessionStorage.setItem('mock:fallos', JSON.stringify(f)), failures);
  }
  return { context, page };
}

const requests = (page, method, prefix) =>
  page.evaluate(
    ([m, p]) => (window.__mockRequests ?? []).filter((r) => r.method === m && r.url.startsWith(p)),
    [method, prefix],
  );

const servicesUrl = '/questionnaires?encuestas=servicios';
const list = (page) => page.getByTestId('service-surveys-list');

// 1–2 · Before and after import (1440), with the PUT logged; 3 · «Cambiar» on the one in use.
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, 'medica@alovida.mock');
  await go(page, servicesUrl);
  await expect(list(page)).toBeVisible({ timeout: 30_000 });
  await shot(page, '01-per-service-before-1440');

  const importButton = page.locator('[data-testid^="service-survey-import-"]').first();
  const serviceId = (await importButton.getAttribute('data-testid')).replace('service-survey-import-', '');
  await importButton.click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await shot(page, '02-catalog-picker-1440');
  await page.getByTestId('standard-catalog-import').click();
  const row = page.getByTestId(`service-survey-${serviceId}`);
  await expect(row.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible();
  log.push({ step: 'import', requests: await requests(page, 'PUT', '/surveys/service-assignments/') });
  await page.reload();
  await expect(row.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible({ timeout: 30_000 });
  await shot(page, '03-per-service-after-import-and-reload-1440');

  await row.getByTestId(`service-survey-change-${serviceId}`).click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await shot(page, '04-change-opens-on-current-1440');
  await page.getByTestId('standard-catalog-cancel').click();

  // 5–6 · Quitar: confirm → DELETE → reload.
  await row.getByTestId(`service-survey-remove-${serviceId}`).click();
  await expect(page.getByTestId('dialogo-confirmar')).toBeVisible();
  await shot(page, '05-remove-confirm-1440');
  await page.getByTestId('dialogo-confirmar').click();
  await expect(row.getByTestId('service-surveys-base-only')).toBeVisible();
  log.push({ step: 'remove', requests: await requests(page, 'DELETE', '/surveys/service-assignments/') });
  await page.reload();
  await expect(row.getByTestId('service-surveys-base-only')).toBeVisible({ timeout: 30_000 });
  log.push({ step: 'reload-after-remove', requests: await requests(page, 'GET', '/surveys/service-assignments') });
  await shot(page, '06-removed-and-reloaded-1440');

  // 7 · «Ver preguntas» of the appointment, numbered.
  await page.getByTestId('service-surveys-appointment-view').click();
  await expect(page.getByTestId('service-surveys-questions')).toBeVisible();
  await shot(page, '07-appointment-numbered-questions-1440');
  await context.close();
}

// 8 · Loading: the mock answers after a 120 ms rxjs timer (setInterval); holding
// those timers back keeps the list in flight while the page still paints normally.
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, 'medica@alovida.mock');
  await go(page, '/questionnaires');
  await expect(page.getByRole('tab', { name: 'Buzón', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('surveys-inbox-list')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    const original = window.setInterval;
    window.setInterval = (fn, ms, ...rest) => (ms === 120 ? 0 : original(fn, ms, ...rest));
  });
  await page.getByRole('tab', { name: 'Encuestas por servicio', exact: true }).click();
  await expect(page.getByTestId('service-surveys-loading')).toBeVisible();
  await shot(page, '08-loading-1440');
  await context.close();
}

// 9 · No services (a new practitioner).
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, 'medico.nuevo@alovida.mock');
  await go(page, servicesUrl);
  await expect(page.getByTestId('service-surveys-no-services')).toBeVisible({ timeout: 30_000 });
  await shot(page, '09-no-services-1440');
  await context.close();
}

// 10 · Load error with request ID; 11 · catalog failure; 12 · PUT error.
for (const [name, failures, ready] of [
  ['10-load-error-with-id-1440', [{ patron: '/surveys/service-assignments', modo: 'error', metodos: ['GET'] }], 'app-view-state-host'],
  ['11-catalog-failure-1440', [{ patron: '/surveys/standard-catalog', modo: 'error' }], '[data-testid="service-surveys-catalog-error"]'],
  ['12-import-error-1440', [{ patron: '/surveys/service-assignments/', modo: 'error', metodos: ['PUT'] }], '[data-testid="service-surveys-list"]'],
]) {
  const { context, page } = await fresh(1440, 900, failures);
  await signIn(page, 'medica@alovida.mock');
  await go(page, servicesUrl);
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  if (name.startsWith('10')) await expect(page.getByText(/mock-fallo/).first()).toBeVisible({ timeout: 30_000 });
  if (name.startsWith('12')) {
    await page.locator('[data-testid^="service-survey-import-"]').first().click();
    await page.getByTestId('standard-catalog-import').click();
    await expect(page.getByTestId('standard-catalog-error')).toBeVisible();
    log.push({ step: 'import-error', requests: await requests(page, 'PUT', '/surveys/service-assignments/') });
  }
  await shot(page, name);
  await context.close();
}

// 13–15 · 390: list, picker scrolled to the preview and its license line.
{
  const { context, page } = await fresh(390, 844);
  await signIn(page, 'medica@alovida.mock');
  await go(page, servicesUrl);
  await expect(list(page)).toBeVisible({ timeout: 30_000 });
  await shot(page, '13-per-service-390');
  await page.getByTestId('service-surveys-appointment').scrollIntoViewIfNeeded();
  await page.locator('[data-testid^="service-survey-change-"]').first().scrollIntoViewIfNeeded();
  await shot(page, '14-per-service-row-actions-390');
  await page.locator('[data-testid^="service-survey-import-"]').first().click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await shot(page, '15-picker-390-top');
  await page.getByTestId('standard-catalog-source').scrollIntoViewIfNeeded();
  await shot(page, '16-picker-390-preview-and-license');
  await context.close();
}

// 17 · Read-only «Buzón» (1440).
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, 'medica@alovida.mock');
  await go(page, '/questionnaires');
  await expect(page.getByTestId('surveys-inbox-list')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('surveys-inbox-toolbar').scrollIntoViewIfNeeded();
  await shot(page, '17-inbox-read-only-1440');
  await page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Satisfacción con la consulta' }).scrollIntoViewIfNeeded();
  await shot(page, '17b-inbox-past-survey-1440');
  await context.close();
}

// 18–19 · Patient «Mis encuestas» at 390, no surveys yet, demo chip folded.
{
  const { context, page } = await fresh(390, 844, [{ patron: '/surveys/me/invitations', modo: 'vacio', metodos: ['GET'] }]);
  await signIn(page, 'paciente@alovida.mock');
  // Under 640 px the top bar's quick links sit behind «Más accesos» (shell design).
  await page.getByTestId('header-mas').click();
  await shot(page, '18-patient-more-shortcuts-390');
  await page.getByTestId('header-encuestas').click();
  await expect(page.getByTestId('questionnaires-no-surveys')).toBeVisible({ timeout: 30_000 });
  const chip = page.locator('aside.mock:not(.mock--plegado) .mock__boton');
  if (await chip.count()) await chip.click();
  await shot(page, '19-patient-my-surveys-empty-390');
  await context.close();
}

writeFileSync(join(OUT, 'requests.json'), `${JSON.stringify(log, null, 2)}\n`);
await browser.close();
console.log(`captures in ${OUT}`);
