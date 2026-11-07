import { expect, test, type Page } from '@playwright/test';

/**
 * «Horarios y equipos» edits each schedule with the practitioner's week: one
 * row per day with «Dura» and «Descanso», the lunch and «Previsualizar
 * horario» with the weekly grid. Walks UI → request → response → reload → UI
 * against the simulator, which answers inside the browser and records each
 * request in `window.__mockRequests`.
 *
 * Runs against `yarn start:demo` (`E2E_BASE_URL`, default localhost:4200).
 */

interface MockEntry {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill('imagen@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
}

async function openSchedule(page: Page): Promise<void> {
  await page.goto('/administration/center-schedule');
  await expect(page.getByTestId('centro-horarios')).toBeVisible({ timeout: 120_000 });
}

/** Tuesday's row of the general schedule (the practitioner's rows start at Monday = 0). */
const tuesday = (page: Page) => page.locator('tr', { has: page.getByTestId('centro-general-dia-1') });

async function pick(page: Page, trigger: ReturnType<Page['locator']>, option: string): Promise<void> {
  await trigger.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('the center sets Tuesday to 20 min with 10 min of rest in the practitioner table, and it stays after a reload', async ({ page }) => {
  await signIn(page);
  await openSchedule(page);

  // The practitioner's table: Día, Desde, Hasta, Dura, Descanso, Horarios.
  const table = page.getByRole('table', { name: /Horario general: un día por fila/ });
  await expect(table.getByRole('columnheader', { name: 'Dura' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Descanso' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Telemedicina' })).toHaveCount(0);

  await pick(page, tuesday(page).locator('td[data-label="Dura"] .select-trigger'), '20 min');
  await pick(page, tuesday(page).locator('td[data-label="Descanso"] .select-trigger'), '10 min');
  // 08:00–17:00 with 20 + 10: starts 08:00 … 16:30 → 18.
  await expect(tuesday(page).locator('td[data-label="Horarios"]')).toHaveText('18');

  const before = await page.evaluate(() => ((window as unknown as { __mockRequests?: unknown[] }).__mockRequests ?? []).length);
  await page.getByTestId('centro-publicar').click();
  const sent = await page.waitForFunction(
    (from) =>
      ((window as unknown as { __mockRequests?: MockEntry[] }).__mockRequests ?? [])
        .slice(from)
        .find((r) => r.method === 'PUT' && r.url.endsWith('/schedule')) ?? false,
    before,
  );
  const request = (await sent.jsonValue()) as MockEntry;
  expect(request.status).toBeLessThan(300);
  expect(request.body).toMatchObject({
    general: { windows: expect.arrayContaining([expect.objectContaining({ dayOfWeek: 2, slotMinutes: 20, gapMinutes: 10 })]) },
  });
  await expect(page.getByTestId('centro-publicado')).toBeVisible();

  await page.reload();
  await openSchedule(page);
  await expect(tuesday(page).locator('td[data-label="Dura"]')).toContainText('20 min');
  await expect(tuesday(page).locator('td[data-label="Descanso"]')).toContainText('10 min');
  await expect(page.getByTestId('centro-general-previa')).toContainText('18 citas de 20 min · 10 min de descanso');

  // «Previsualizar horario»: the same weekly grid the practitioner sees.
  await page.getByTestId('centro-general-previsualizar').click();
  const dialog = page.getByRole('dialog', { name: 'Así va a quedar su horario' });
  await expect(dialog).toBeVisible();
  // Weekday headers are upper-cased by CSS: the text is «Mar».
  await expect(dialog.getByText(/^mar$/i)).toBeVisible();
});
