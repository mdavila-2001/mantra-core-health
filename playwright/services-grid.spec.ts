import { expect, test } from '@playwright/test';

/**
 * Read-only services grid (`/administration/services-grid`) against the simulator
 * (`yarn start:demo`, `E2E_BASE_URL`). It proves what the admin role sees per tab,
 * including the 403 of the laboratory catalog, and that the screen sends GETs only.
 * The real API was not exercised.
 */
test.describe('Services grid (admin, simulator)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('admin@alovida.mock');
    await page.getByTestId('login-password').fill('S3cret-passw0rd');
    await page.getByTestId('login-submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
    // The admin lands on the portal picker; the grid is opened by URL.
    await page.goto('/administration/services-grid');
    await expect(page.getByTestId('services-grid-tabs')).toBeVisible({ timeout: 30_000 });
  });

  test('Médico lists the services with their organization type', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'CONS-GEN' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Tipo de organización/i })).toBeVisible();
  });

  test('Laboratorio shows the 403 as a forbidden state, not an empty list', async ({ page }) => {
    await page.getByRole('tab', { name: /Laboratorio/ }).click();
    await expect(page.getByText('No tiene acceso a esta sección')).toBeVisible();
  });

  test('Hospital says it has no catalog of its own and calls no endpoint for it', async ({ page }) => {
    await page.getByRole('tab', { name: /Hospital/ }).click();
    await expect(page.getByTestId('services-grid-hospital')).toContainText('no tiene un catálogo propio');
    const reqs = await page.evaluate(() => (window as unknown as { __mockRequests?: { url: string }[] }).__mockRequests ?? []);
    expect(reqs.filter((r) => /hospital/i.test(r.url))).toEqual([]);
  });

  test('Farmacia shows the partial notice and the screen only reads', async ({ page }) => {
    await page.getByRole('tab', { name: /Farmacia/ }).click();
    await expect(page.getByTestId('services-grid-partial')).toBeVisible();
    const reqs = await page.evaluate(() => (window as unknown as { __mockRequests?: { method: string; url: string }[] }).__mockRequests ?? []);
    const catalogs = reqs.filter((r) => /catalogs\/services|lab\/services|catalog-products/.test(r.url));
    expect(catalogs.length).toBeGreaterThan(0);
    expect(catalogs.filter((r) => r.method !== 'GET')).toEqual([]);
  });
});
