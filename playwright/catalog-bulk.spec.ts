import { expect, test, type Page } from '@playwright/test';

/**
 * Pharmacy catalog bulk load (`/superadmin/catalog-bulk`) against the SIMULATOR
 * (`yarn start:demo`, `E2E_BASE_URL`): UI → request → response → persistence in
 * the simulator store → reload → UI. This is NOT PostgreSQL persistence; the real
 * API was not exercised.
 */
const CSV = 'name\nAnalgésicos Spec\nVitaminas Spec\nanalgesicos spec\n';

async function pick(page: Page, testId: string, label: string | RegExp): Promise<void> {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: label }).first().click();
}

async function openAndLoad(page: Page): Promise<void> {
  await page.goto('/superadmin/catalog-bulk');
  await expect(page.getByTestId('cb-pharmacy')).toBeVisible({ timeout: 30_000 });
  await pick(page, 'cb-pharmacy', /./);
  await pick(page, 'cb-kind', 'Categorías');
  await page.locator('input[type=file]').setInputFiles({ name: 'categorias.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await expect(page.getByTestId('cb-rows-read')).toContainText('3 filas');
}

test.describe('Catalog bulk load (admin, simulator)', () => {
  test('simulates, confirms, reloads the catalog and survives a full page reload', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('admin@alovida.mock');
    await page.getByTestId('login-password').fill('S3cret-passw0rd');
    await page.getByTestId('login-submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
    // The simulator answers inside the browser: its request log is `window.__mockRequests`.
    const bulkCalls = async (): Promise<{ method: string; status: number; body: { mode: string; dryRun: boolean; rows: unknown[] } }[]> =>
      page.evaluate(() =>
        ((window as unknown as { __mockRequests?: { method: string; url: string; status: number; body: never }[] }).__mockRequests ?? []).filter(
          (r) => r.url.endsWith('/categories/bulk'),
        ),
      );

    await openAndLoad(page);
    await page.getByTestId('cb-simulate').click();
    await expect(page.getByTestId('cb-count-CREATED')).toContainText('2');
    await expect(page.getByTestId('cb-count-REJECTED')).toContainText('1');
    await expect(page.getByTestId('cb-results')).toContainText('repetida dentro del archivo');
    expect((await bulkCalls()).map((c) => [c.method, c.status, c.body.mode, c.body.dryRun, c.body.rows.length])).toEqual([['POST', 200, 'UPSERT', true, 3]]);

    await page.getByTestId('cb-confirm').click();
    await expect(page.getByTestId('cb-snapshot')).toContainText('Vitaminas Spec');
    expect((await bulkCalls()).map((c) => c.body.dryRun)).toEqual([true, false]);

    // Full reload: the same file now reports the persisted rows as unchanged.
    await page.reload();
    await openAndLoad(page);
    await page.getByTestId('cb-simulate').click();
    await expect(page.getByTestId('cb-count-UNCHANGED')).toContainText('2');
    await expect(page.getByTestId('cb-count-CREATED')).toContainText('0');
  });
});
