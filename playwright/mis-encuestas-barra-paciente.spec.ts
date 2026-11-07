import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar } from './support/sesion';

/**
 * The patient's «Mis encuestas» in the top bar is ALWAYS offered (06/11/2026),
 * even before the first survey arrives; the screen it opens is titled «Mis
 * encuestas» and explains when surveys come (S3 with next action).
 *
 * Runs against the demo build (mock backend), signed in as the mock patient.
 * The mock patient always has invitations, so the «no surveys yet» case is
 * forced with the mock's `empty` mode (`simulated-failures.ts`, GET only): a 200
 * with an empty list for `GET /surveys/me/invitations`. Before this change that
 * same empty list hid the link entirely, so this spec fails without it.
 *
 * Waits on elements, never on network quiescence.
 */

const PATIENT: Actor = { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' };

/** The three widths required for the screen. */
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

interface ServedRequest {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly respuesta?: unknown;
}

async function invitationReads(page: Page): Promise<readonly ServedRequest[]> {
  const all = await page.evaluate(() => (window as unknown as { __mockRequests?: ServedRequest[] }).__mockRequests ?? []);
  return all.filter((r) => r.method === 'GET' && r.url.startsWith('/surveys/me/invitations'));
}

/** Runs before the app on every load of this tab: the mock reads it per request. */
async function withoutSurveys(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/surveys/me/invitations', modo: 'empty' }]));
  });
}

/** Under 640 px the quick links sit behind «Más accesos» (the top bar's design). */
async function myLink(page: Page) {
  const link = page.getByTestId('header-encuestas');
  if (!(await link.isVisible())) await page.getByTestId('header-mas').click();
  await expect(link).toBeVisible({ timeout: 30_000 });
  return link;
}

test('sin encuestas todavía: «Mis encuestas» sigue en la barra y lleva al estado vacío', async ({ page }) => {
  await withoutSurveys(page);
  await entrar(page, PATIENT);

  const link = await myLink(page);
  await expect(link).toContainText('Mis encuestas');
  // No permanent «0»: the number shows only with pending surveys.
  await expect(page.getByTestId('header-encuestas-badge')).toHaveCount(0);

  // The bar really asked and really got nothing.
  await expect.poll(async () => (await invitationReads(page)).length).toBeGreaterThan(0);
  const [read] = await invitationReads(page);
  expect(read!.status).toBe(200);
  expect(read!.respuesta).toEqual([]);

  await link.click();
  await expect(page).toHaveURL(/\/my-account\/questionnaires\?.*seccion=encuestas/);
  const emptyState = page.getByTestId('questionnaires-no-surveys');
  await expect(emptyState).toBeVisible({ timeout: 30_000 });
  await expect(emptyState).toContainText('Todavía no tiene encuestas');
  await expect(emptyState.getByTestId('questionnaires-see-appointments')).toBeVisible();
  await expect(link).toHaveAttribute('aria-current', 'page');
  // The link, the page heading and the tab share one name.
  await expect(page.getByRole('heading', { level: 1, name: 'Mis encuestas' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Mis encuestas', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('con encuestas pendientes: «Mis encuestas» muestra el número de pendientes', async ({ page }) => {
  await entrar(page, PATIENT);

  const link = await myLink(page);
  await expect(page.getByTestId('header-encuestas-badge')).toBeVisible();

  await link.click();
  await expect(page).toHaveURL(/\/my-account\/questionnaires\?.*seccion=encuestas/);
  await expect(page.getByTestId('cuestionarios-lista')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('questionnaires-no-surveys')).toHaveCount(0);
});

test.describe('«Mis encuestas» sin scroll horizontal en los tres anchos', () => {
  const overflows = (page: Page): Promise<boolean> =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

  for (const viewport of VIEWPORTS) {
    test(`vacío y con encuestas en ${viewport.width}px`, async ({ browser }) => {
      for (const empty of [true, false]) {
        // One session at a time: each case in its own context, closed before the next.
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        const page = await context.newPage();
        if (empty) await withoutSurveys(page);
        await entrar(page, PATIENT);
        await (await myLink(page)).click();
        await expect(page.getByTestId(empty ? 'questionnaires-no-surveys' : 'cuestionarios-lista')).toBeVisible({ timeout: 30_000 });
        const label = empty ? 'vacío' : 'con encuestas';
        expect(await overflows(page), `«Mis encuestas» ${label} desborda en ${viewport.width}px`).toBe(false);
        await page.screenshot({ path: `artifacts/playwright/mis-encuestas/${empty ? 'empty' : 'list'}-${viewport.name}.png` });
        await context.close();
      }
    });
  }
});
