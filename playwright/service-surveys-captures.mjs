/**
 * Evidence for «Encuestas por servicio», the read-only «Buzón», the read-only
 * survey sheet and the patient's «Mis encuestas» (06/11/2026, eighth round).
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
import { expect } from '@playwright/test';

import { browser, digest, DOCTOR, fresh, go, list, requests, reveal, servicesUrl, shot, signIn, writeLog } from './support/capture-kit.mjs';

const log = [];

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
  await reveal(page, card);
  await shot(page, '04-inbox-after-import-sent-1440', { belowHeader: true });
  await card.getByRole('link', { name: `Ver las respuestas de ${title}` }).click();
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Se envía', { timeout: 30_000 });
  // Settled: just imported, no answers yet, so the answers tab is an S3 with its next action.
  await expect(page.getByTestId('survey-detail-answers')).toContainText('Todavía no respondió nadie', { timeout: 30_000 });
  // 05: the sheet's top on «Preguntas» (status «Se envía», the questionnaire).
  await page.getByRole('tab', { name: 'Preguntas', exact: true }).click();
  await expect(page.getByTestId('survey-detail-questions')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '05-imported-survey-sheet-1440');
  // 05b: «Respuestas», the S3 state itself (no answers yet, with its next action), framed from the tab strip down.
  await page.getByRole('tab', { name: 'Respuestas', exact: true }).click();
  await expect(page.getByTestId('survey-detail-answers')).toContainText('Todavía no respondió nadie');
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, '05b-imported-survey-no-answers-yet-1440', { belowHeader: true });
  if (digest('05-imported-survey-sheet-1440') === digest('05b-imported-survey-no-answers-yet-1440')) throw new Error('05 and 05b are the same capture');
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
  if (name.startsWith('11')) {
    await expect(page.getByText(/mock-fallo/).first()).toBeVisible({ timeout: 30_000 });
    log.push({ step: 'load-error', requests: await requests(page, 'GET', '/surveys/service-assignments') });
  }
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
  await reveal(page, page.locator('li[app-service-survey-row]', { has: page.locator('[data-testid^="service-survey-change-"]') }).first());
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
    // 19: from the imported surveys down to the «ya no se envía» ones, each card whole.
    await expect(legacy).toContainText('Encuesta anterior (ya no se envía)');
    await reveal(page, page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Estudios por imágenes' }));
    const legacyBox = await legacy.boundingBox();
    if (legacyBox.y + legacyBox.height > 900) throw new Error('19: the «ya no se envía» card is out of frame');
    await shot(page, '19-inbox-read-only-1440');
    await reveal(page, legacy);
    await shot(page, '20-inbox-past-survey-1440', { belowHeader: true });
  }
  await legacy.getByRole('link', { name: /Ver las respuestas/ }).click();
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Encuesta anterior (ya no se envía)', { timeout: 30_000 });
  await expect(page.locator('.encuesta__respuesta').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `21-legacy-sheet-read-only-${suffix}`);
  // The questionnaire tab, scrolled so several questions show.
  await page.getByRole('tab', { name: 'Preguntas', exact: true }).click();
  await reveal(page, page.getByTestId('survey-detail-questions'));
  await shot(page, `22-legacy-sheet-questions-${suffix}`, { belowHeader: true });
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
  await reveal(page, page.getByTestId('surveys-inbox-list'));
  await shot(page, `27-dark-inbox-${suffix}`);
  await page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Experiencia de teleconsulta' }).getByRole('link', { name: /Ver las respuestas/ }).click();
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Encuesta anterior (ya no se envía)', { timeout: 30_000 });
  await expect(page.locator('.encuesta__respuesta').first()).toBeVisible({ timeout: 30_000 });
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

writeLog('requests.json', log);
await browser.close();
console.log('service-surveys captures done');
