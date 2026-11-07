import { expect, test, type Page } from '@playwright/test';

/**
 * Carril A — admin portal: the platform home is ONE card with tabs, and the
 * management menu keeps its domains in order. Runs against the simulator
 * (`yarn start:demo`, admin@alovida.mock). Status: VERIFIED_FUNCTIONAL_ONLY.
 * It waits on concrete elements, never on network quiescence (HMR never reaches it).
 */
test.setTimeout(180_000);

async function entrar(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill('admin@alovida.mock');
  await page.getByTestId('login-password').fill('S3cret-passw0rd');
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

test('Centro de la plataforma: una sola tarjeta con pestañas, a lo ancho del área', async ({ page }) => {
  await entrar(page);
  const portales = page.getByTestId('platform-home-portales');
  await expect(portales).toBeVisible({ timeout: 60_000 });
  await expect(portales.locator('app-tabs')).toHaveCount(1);
  await expect(portales.getByRole('tab')).toHaveCount(2);

  const ancho = await portales.evaluate((el) => {
    const area = el.closest('.app-main__inner') ?? el.parentElement!;
    const a = area.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return { ratio: b.width / a.width, izq: b.left - a.left, der: a.right - b.right };
  });
  expect(ancho.ratio).toBeGreaterThanOrEqual(0.85);
  expect(Math.abs(ancho.izq - ancho.der)).toBeLessThanOrEqual(2);

  await portales.getByRole('tab', { name: 'Observabilidad' }).click();
  await expect(page.getByTestId('portal-observabilidad')).toHaveAttribute('href', '/superadmin/observability');
  await page.screenshot({ path: 'docs/trabajo/2026-11-07-admin-portal/evidencia/a/pw-portada.png' });
});

test('el menú de gestión conserva la gestión y sin «Mi cuenta» para quien solo gestiona', async ({ page }) => {
  await entrar(page);
  await expect(page.getByTestId('platform-home-portales')).toBeVisible({ timeout: 60_000 });
  const menu = page.locator('nav').first();
  await expect(menu.getByText('Superadministración')).toBeVisible();
  await expect(menu.getByText('Mi cuenta')).toHaveCount(0);
  await expect(menu.getByText('Atención')).toHaveCount(0);
});
