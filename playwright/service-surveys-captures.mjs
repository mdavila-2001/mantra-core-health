/**
 * Evidence for «Encuestas por servicio», the read-only «Buzón», the read-only
 * survey sheet and the patient's «Mis encuestas» (06/11/2026, fourth round).
 *
 * Against the demo build (`yarn start:demo`, mock backend). One browser, serial
 * captures, VIEWPORT-only screenshots (never full page: the side rail would cover
 * content), demo chip hidden. Waits on elements, never on network quiescence.
 * Failure states are forced with the mock's `mock:fallos` switch
 * (`simulated-failures.ts`); the loading state holds back the mock's reply timer.
 *
 * Usage: `yarn node playwright/service-surveys-captures.mjs`
 * (`BASE`, default http://localhost:4200; `OUT`, default the evidence folder).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, expect } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'docs/refactor-profesional/trabajo/capturas/despues/surveys-per-service-2026-11-06-r4';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const log = [];
const DOCTOR = 'medica@alovida.mock';

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
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const hide = await page.addStyleTag({ content: 'aside.mock { display: none !important; }' });
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  await hide.evaluate((node) => node.remove());
}

async function fresh(width, height, failures = null, theme = 'light') {
  // Reduced motion: transitions finish at once, so no capture is a cross-fade.
  const context = await browser.newContext({ viewport: { width, height }, locale: 'es-BO', timezoneId: 'America/La_Paz', reducedMotion: 'reduce', colorScheme: theme });
  const page = await context.newPage();
  if (failures) await page.addInitScript((f) => sessionStorage.setItem('mock:fallos', JSON.stringify(f)), failures);
  // The app's own theme preference (`ThemeService`, `mantra-core-health.theme`).
  if (theme === 'dark') await page.addInitScript(() => localStorage.setItem('mantra-core-health.theme', 'dark'));
  return { context, page };
}

const requests = (page, method, prefix) =>
  page.evaluate(([m, p]) => (window.__mockRequests ?? []).filter((r) => r.method === m && r.url.startsWith(p)), [method, prefix]);

const servicesUrl = '/questionnaires?encuestas=servicios';
const list = (page) => page.getByTestId('service-surveys-list');

// 01–07 · Import → reload → Buzón «Se envía» → its sheet → Cambiar → Quitar → reload (1440).
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, DOCTOR);
  await go(page, servicesUrl);
  await expect(list(page)).toBeVisible({ timeout: 30_000 });
  await shot(page, '01-per-service-before-1440');

  const importButton = page.locator('[data-testid^="service-survey-import-"]').first();
  const serviceId = (await importButton.getAttribute('data-testid')).replace('service-survey-import-', '');
  await importButton.click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await page.locator('[data-testid^="standard-catalog-option-"]').nth(1).hover();
  await shot(page, '02-catalog-picker-hover-is-not-selected-1440');
  const title = (await page.locator('.catalogo__opcion.is-elegida .catalogo__opcion-titulo').textContent()).trim();
  await page.getByTestId('standard-catalog-import').click();
  const row = page.getByTestId(`service-survey-${serviceId}`);
  await expect(row.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible();
  log.push({ step: 'import', requests: await requests(page, 'PUT', '/surveys/service-assignments/') });
  await page.reload();
  await expect(row.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible({ timeout: 30_000 });
  log.push({ step: 'reload-after-import', requests: (await requests(page, 'GET', '/surveys/service-assignments')).slice(-1) });
  await shot(page, '03-per-service-after-import-and-reload-1440');

  await page.getByRole('tab', { name: 'Buzón', exact: true }).click();
  const card = page.getByTestId('surveys-inbox-list').locator('li', { hasText: title });
  await expect(card).toContainText('Se envía', { timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await shot(page, '04-inbox-after-import-sent-1440');
  await card.getByRole('link', { name: `Ver las respuestas de ${title}` }).click();
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Se envía', { timeout: 30_000 });
  await shot(page, '05-imported-survey-sheet-1440');
  // Just imported: no answers yet, so the answers tab is an S3 with its next action.
  await expect(page.getByTestId('survey-detail-no-answers-list')).toBeVisible();
  await page.getByTestId('survey-detail-tabs').scrollIntoViewIfNeeded();
  await shot(page, '05b-imported-survey-no-answers-yet-1440');
  await go(page, servicesUrl);
  await expect(list(page)).toBeVisible({ timeout: 30_000 });

  await row.getByTestId(`service-survey-change-${serviceId}`).click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await shot(page, '06-change-opens-on-current-1440');
  await page.getByTestId('standard-catalog-cancel').click();

  await row.getByTestId(`service-survey-remove-${serviceId}`).click();
  await expect(page.getByTestId('dialogo-confirmar')).toBeVisible();
  await shot(page, '07-remove-confirm-1440');
  await page.getByTestId('dialogo-confirmar').click();
  await expect(row.getByTestId('service-surveys-base-only')).toBeVisible();
  log.push({ step: 'remove', requests: await requests(page, 'DELETE', '/surveys/service-assignments/') });
  await page.reload();
  await expect(row.getByTestId('service-surveys-base-only')).toBeVisible({ timeout: 30_000 });
  log.push({ step: 'reload-after-remove', requests: (await requests(page, 'GET', '/surveys/service-assignments')).slice(-1) });
  await shot(page, '07b-removed-and-reloaded-1440');

  await page.getByTestId('service-surveys-appointment-view').click();
  await expect(page.getByTestId('service-surveys-questions')).toBeVisible();
  await shot(page, '08-appointment-numbered-questions-1440');
  await context.close();
}

// 09 · Loading: the mock answers after a 120 ms rxjs timer; holding those timers back keeps the list in flight.
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, DOCTOR);
  await go(page, '/questionnaires');
  await expect(page.getByTestId('surveys-inbox-list')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    const original = window.setInterval;
    window.setInterval = (fn, ms, ...rest) => (ms === 120 ? 0 : original(fn, ms, ...rest));
  });
  await page.getByRole('tab', { name: 'Encuestas por servicio', exact: true }).click();
  await expect(page.getByTestId('service-surveys-loading')).toBeVisible();
  await shot(page, '09-loading-1440');
  await context.close();
}

// 10 · No services (a new practitioner): the next action is a real button.
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, 'medico.nuevo@alovida.mock');
  await go(page, servicesUrl);
  await expect(page.getByTestId('service-surveys-go-to-my-services')).toBeVisible({ timeout: 30_000 });
  await shot(page, '10-no-services-1440');
  await context.close();
}

// 11–14 · Failures, all with the S9 anatomy: load, catalog, PUT, DELETE.
for (const [name, failures, ready] of [
  ['11-load-error-with-id-1440', [{ patron: '/surveys/service-assignments', modo: 'error', metodos: ['GET'] }], 'app-view-state-host'],
  ['12-catalog-failure-1440', [{ patron: '/surveys/standard-catalog', modo: 'error' }], '[data-testid="service-surveys-catalog-error"]'],
  ['13-import-error-1440', [{ patron: '/surveys/service-assignments/', modo: 'error', metodos: ['PUT'] }], '[data-testid="service-surveys-list"]'],
  ['14-remove-error-1440', [{ patron: '/surveys/service-assignments/', modo: 'error', metodos: ['DELETE'] }], '[data-testid="service-surveys-list"]'],
]) {
  const { context, page } = await fresh(1440, 900, failures);
  await signIn(page, DOCTOR);
  await go(page, servicesUrl);
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  if (name.startsWith('11')) await expect(page.getByText(/mock-fallo/).first()).toBeVisible({ timeout: 30_000 });
  if (name.startsWith('12')) log.push({ step: 'catalog-error', requests: await requests(page, 'GET', '/surveys/standard-catalog') });
  if (name.startsWith('13')) {
    await page.locator('[data-testid^="service-survey-import-"]').first().click();
    await page.getByTestId('standard-catalog-import').click();
    await expect(page.getByTestId('standard-catalog-error')).toBeVisible();
    log.push({ step: 'import-error', requests: await requests(page, 'PUT', '/surveys/service-assignments/') });
  }
  if (name.startsWith('14')) {
    await page.locator('[data-testid^="service-survey-remove-"]').first().click();
    await page.getByTestId('dialogo-confirmar').click();
    await expect(page.getByTestId('service-surveys-write-error')).toBeVisible();
    log.push({ step: 'remove-error', requests: await requests(page, 'DELETE', '/surveys/service-assignments/') });
  }
  await shot(page, name);
  await context.close();
}

// 15–18 · 390: list, rows with actions, picker top, picker preview with the license line.
{
  const { context, page } = await fresh(390, 844);
  await signIn(page, DOCTOR);
  await go(page, servicesUrl);
  await expect(list(page)).toBeVisible({ timeout: 30_000 });
  await shot(page, '15-per-service-390');
  await page.locator('[data-testid^="service-survey-change-"]').first().scrollIntoViewIfNeeded();
  await shot(page, '16-per-service-row-actions-390');
  await page.locator('[data-testid^="service-survey-import-"]').first().click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await shot(page, '17-picker-390-top');
  await page.getByTestId('standard-catalog-source').scrollIntoViewIfNeeded();
  await shot(page, '18-picker-390-preview-and-license');
  await context.close();
}

// 19–22 · Read-only Buzón (1440) and a legacy survey's read-only sheet (1440 and 390).
for (const [width, height, suffix] of [[1440, 900, '1440'], [390, 844, '390']]) {
  const { context, page } = await fresh(width, height);
  await signIn(page, DOCTOR);
  await go(page, '/questionnaires');
  await expect(page.getByTestId('surveys-inbox-list')).toBeVisible({ timeout: 30_000 });
  const legacy = page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Experiencia de teleconsulta' });
  if (width === 1440) {
    await page.getByTestId('surveys-inbox-toolbar').scrollIntoViewIfNeeded();
    await shot(page, '19-inbox-read-only-1440');
    await legacy.scrollIntoViewIfNeeded();
    await shot(page, '20-inbox-past-survey-1440');
  }
  await legacy.getByRole('link', { name: /Ver las respuestas/ }).click();
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Ya no se envía', { timeout: 30_000 });
  await expect(page.locator('.encuesta__respuesta').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `21-legacy-sheet-read-only-${suffix}`);
  // The questionnaire tab, scrolled so several questions show.
  await page.getByRole('tab', { name: 'Preguntas', exact: true }).click();
  await page.getByTestId('survey-detail-questions').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await shot(page, `22-legacy-sheet-questions-${suffix}`);
  await context.close();
}

// 23–24 · Patient «Mis encuestas» at 390, no surveys yet.
{
  const { context, page } = await fresh(390, 844, [{ patron: '/surveys/me/invitations', modo: 'empty' }]);
  await signIn(page, 'paciente@alovida.mock');
  // Under 640 px the top bar's quick links sit behind «Más accesos» (shell design).
  await page.getByTestId('header-mas').click();
  await shot(page, '23-patient-more-shortcuts-390');
  await page.getByTestId('header-encuestas').click();
  await expect(page.getByTestId('questionnaires-no-surveys')).toBeVisible({ timeout: 30_000 });
  await shot(page, '24-patient-my-surveys-empty-390');
  await context.close();
}

// 25–30 · Dark mode of the new screens, 1440 and 390.
for (const [width, height, suffix] of [[1440, 900, '1440'], [390, 844, '390']]) {
  const { context, page } = await fresh(width, height, null, 'dark');
  await signIn(page, DOCTOR);
  await go(page, servicesUrl);
  await expect(list(page)).toBeVisible({ timeout: 30_000 });
  await shot(page, `25-dark-per-service-${suffix}`);
  await page.locator('[data-testid^="service-survey-import-"]').first().click();
  await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
  await shot(page, `26-dark-picker-${suffix}`);
  await page.getByTestId('standard-catalog-cancel').click();
  await page.getByRole('tab', { name: 'Buzón', exact: true }).click();
  await expect(page.getByTestId('surveys-inbox-list')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('surveys-inbox-list').scrollIntoViewIfNeeded();
  await shot(page, `27-dark-inbox-${suffix}`);
  await page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Experiencia de teleconsulta' }).getByRole('link', { name: /Ver las respuestas/ }).click();
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Ya no se envía', { timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `28-dark-sheet-${suffix}`);
  await context.close();
}
{
  const { context, page } = await fresh(390, 844, [{ patron: '/surveys/me/invitations', modo: 'empty' }], 'dark');
  await signIn(page, 'paciente@alovida.mock');
  await page.getByTestId('header-mas').click();
  await page.getByTestId('header-encuestas').click();
  await expect(page.getByTestId('questionnaires-no-surveys')).toBeVisible({ timeout: 30_000 });
  await shot(page, '29-dark-patient-my-surveys-390');
  await context.close();
}

writeFileSync(join(OUT, 'requests.json'), `${JSON.stringify(log, null, 2)}\n`);
await browser.close();
console.log(`captures in ${OUT}`);
