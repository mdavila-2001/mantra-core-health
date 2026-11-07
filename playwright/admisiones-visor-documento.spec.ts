import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Admissions: the document viewer must show the file. The simulator answers the signed link
 * (`.../content?expires=…&signature=…`) only if it reads the query embedded in the URL; it used
 * to ignore it and answered 403, so the viewer said "No tiene acceso a este archivo".
 * Runs against the demo build (mock backend), signed in as the mock administrator.
 */
async function signInAsAdministrator(page: Page): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill('admin@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
  if (page.url().includes('/portal-selector')) {
    await page.getByRole('link', { name: /Portal de administración/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

test('Admisiones: el visor muestra el documento y no dice «No tiene acceso»', async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto('/administration/admissions?status=SUBMITTED');
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('admissions-table')).toBeVisible();
  await page.locator('tbody tr').first().click();
  await page.getByRole('tab', { name: /Documentos/ }).click();

  const viewer = page.locator('app-admission-document-viewer');
  await expect(page.getByTestId('viewer-zoom')).toBeVisible();
  await expect(viewer).not.toContainText('No tiene acceso a este archivo');

  // The signed link was requested and the content request answered 200 (mock requests log).
  const statuses = await page.evaluate(() =>
    ((window as unknown as { __mockRequests?: { url: string; status: number }[] }).__mockRequests ?? [])
      .filter((r) => r.url.includes('/documents/') && r.url.includes('/content'))
      .map((r) => r.status),
  );
  expect(statuses.length).toBeGreaterThan(0);
  expect(statuses.every((status) => status === 200)).toBe(true);
});
