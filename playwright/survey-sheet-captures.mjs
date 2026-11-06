/**
 * Evidence for the read-only survey sheet's tabs (06/11/2026, sixth round):
 * Resumen with data and below the minimum, Respuestas with data, «Ver como el
 * paciente», the #resumen entry, an unpublished survey, the answers' S5/S9 and
 * dark mode. Run after `service-surveys-captures.mjs` (one browser at a time).
 *
 * Usage: `yarn node playwright/survey-sheet-captures.mjs` (`BASE`, `OUT` as there).
 */
import { expect } from '@playwright/test';

import { BASE, browser, DOCTOR, fresh, go, reveal, shot, signIn } from './support/capture-kit.mjs';

async function openSheet(page, title) {
  await go(page, '/questionnaires');
  const card = page.getByTestId('surveys-inbox-list').locator('li', { hasText: title });
  await card.getByRole('link', { name: /Ver las respuestas/ }).click();
  await expect(page.getByTestId('survey-detail-answers')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('survey-detail-answers').locator('app-skeleton')).toHaveCount(0);
}

// 30–35 · The sheet's tabs: Resumen with data and below the minimum (1440, 390), Respuestas with
// data (390), «Ver como el paciente», the #resumen entry, and an unpublished survey (single tab).
for (const [width, height, suffix] of [[1440, 900, '1440'], [390, 844, '390']]) {
  const { context, page } = await fresh(width, height);
  await signIn(page, DOCTOR);
  await openSheet(page, 'Estudios por imágenes');
  if (width === 390) {
    // Landing from «Ver respuestas»: no anchor scroll, the tab strip stays on screen.
    const strip = await page.getByTestId('survey-detail-tabs').locator('[role="tablist"]').boundingBox();
    if (strip === null || strip.y + strip.height > height) throw new Error('390: the tab strip is below the fold after landing');
    await shot(page, '30a-landing-from-see-answers-390');
    await reveal(page, page.getByTestId('survey-detail-tabs'));
    await shot(page, '30-answers-with-data-390');
  }
  await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
  await expect(page.getByTestId('survey-detail-summary-bars')).toBeVisible();
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, `31-summary-with-data-${suffix}`);
  await openSheet(page, 'Satisfacción general con el servicio');
  await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
  await expect(page.getByTestId('survey-detail-summary-below-minimum')).toBeVisible();
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, `32-summary-below-minimum-${suffix}`);
  await context.close();
}
{
  const { context, page } = await fresh(1440, 900);
  await signIn(page, DOCTOR);
  await openSheet(page, 'Estudios por imágenes');
  await page.getByRole('tab', { name: 'Preguntas', exact: true }).click();
  await page.getByTestId('encuesta-previa').click();
  await expect(page.locator('app-survey-form')).toBeVisible();
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, '33-as-the-patient-sees-it-1440');
  // The #resumen entry: a full load straight into the summary tab.
  const sheetUrl = new URL(page.url());
  await page.goto('about:blank');
  await page.goto(`${BASE}${sheetUrl.pathname}#resumen`);
  await expect(page.getByRole('tab', { name: 'Resumen', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  await expect(page.getByTestId('survey-detail-summary-bars')).toBeVisible({ timeout: 30_000 });
  await shot(page, '34-entry-by-resumen-link-1440');
  // An unpublished (draft) survey: only «Preguntas», even if the link asks for answers.
  await go(page, '/questionnaires');
  await expect(page.getByTestId('surveys-inbox-list')).toBeVisible({ timeout: 30_000 });
  const draftId = await page.evaluate(() => {
    const read = (window.__mockRequests ?? []).filter((r) => r.url.startsWith('/surveys/catalog') && Array.isArray(r.respuesta)).pop();
    return read?.respuesta.find((s) => s.status === 'DRAFT')?.id ?? null;
  });
  await page.goto(`${BASE}/questionnaires/${draftId}#respuestas`);
  await expect(page.getByTestId('survey-detail-sending')).toHaveText('Nunca se envió', { timeout: 30_000 });
  await shot(page, '35-unpublished-single-tab-1440');
  await context.close();
}
// 36 · Dark: «Preguntas» and «Resumen» (1440 and 390).
for (const [width, height, suffix] of [[1440, 900, '1440'], [390, 844, '390']]) {
  const { context, page } = await fresh(width, height, null, 'dark');
  await signIn(page, DOCTOR);
  await openSheet(page, 'Estudios por imágenes');
  await page.getByRole('tab', { name: 'Preguntas', exact: true }).click();
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, `36-dark-questions-${suffix}`);
  await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
  await expect(page.getByTestId('survey-detail-summary-bars')).toBeVisible();
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, `36b-dark-summary-${suffix}`);
  await context.close();
}

// 37–38 · The answers' S5 (refused) and S9 (failed) inside the tabs.
for (const [name, mode, tab] of [['37-answers-refused-s5-1440', 'forbidden', 'Respuestas'], ['38-summary-failed-s9-1440', 'error', 'Resumen']]) {
  const { context, page } = await fresh(1440, 900, [{ patron: '/responses', modo: mode, metodos: ['GET'] }]);
  await signIn(page, DOCTOR);
  await go(page, '/questionnaires');
  await page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Estudios por imágenes' }).getByRole('link', { name: /Ver las respuestas/ }).click();
  await page.getByRole('tab', { name: tab, exact: true }).click();
  const panel = page.getByTestId(tab === 'Resumen' ? 'survey-detail-summary' : 'survey-detail-answers');
  await expect(panel.locator('app-alert')).toBeVisible({ timeout: 30_000 });
  await reveal(page, page.getByTestId('survey-detail-tabs'));
  await shot(page, name);
  await context.close();
}

await browser.close();
console.log('survey sheet captures done');
