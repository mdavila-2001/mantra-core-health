import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * The doctors of a medical organization, in two doors of the menu (2026-11-07): «Médicos del
 * centro» (who asks to join) and «Accesos de médicos» (who already works there: suspend, end).
 * Runs against `ng serve --configuration development,demo`; the simulator answers inside the app.
 */
const OUT = 'artifacts/evidencia/organizacion-accesos-medicos-2026-11-07';
mkdirSync(OUT, { recursive: true });

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-password').press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  await page.locator('#app-side-nav').waitFor({ timeout: 60_000 });
}

test('la organización médica ve los dos módulos de médicos y gestiona un acceso (suspender y terminar)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'quirofano@alovida.mock');

  const links = page.locator('#app-side-nav [data-testid="nav-enlace"]');
  await expect(links.and(page.locator('[href="/administration/my-organization/affiliations"]'))).toHaveCount(1);
  await expect(links.and(page.locator('[href="/administration/doctor-access"]'))).toHaveCount(1);

  await page.goto('/administration/doctor-access', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Accesos de médicos' })).toBeVisible({ timeout: 60_000 });
  // The simulator's active doctor works in «Centro Médico Sur».
  await page.getByTestId('access-practice').click();
  await page.getByRole('option', { name: 'Centro Médico Sur' }).click();

  const status = page.locator('[data-testid^="access-status-"]').first();
  await expect(status).toHaveText(/Activa/);
  await page.screenshot({ path: `${OUT}/accesos-activo-1440.png`, fullPage: true });

  await page.locator('[data-testid^="access-suspend-"]').first().click();
  await expect(status).toHaveText(/Suspendida/);
  await expect(page.locator('[data-testid^="access-suspend-"]')).toHaveCount(0);

  // Ending asks first, and nothing changes until it is confirmed.
  await page.locator('[data-testid^="access-end-"]:not([data-testid*="confirm"]):not([data-testid*="cancel"])').first().click();
  await expect(page.getByText('No se puede deshacer')).toBeVisible();
  await page.locator('[data-testid^="access-end-cancel-"]').first().click();
  await expect(status).toHaveText(/Suspendida/);

  await page.locator('[data-testid^="access-end-"]:not([data-testid*="confirm"]):not([data-testid*="cancel"])').first().click();
  await page.locator('[data-testid^="access-end-confirm-"]').first().click();
  await expect(page.locator('[data-testid^="access-status-"]')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/accesos-terminado-1440.png`, fullPage: true });
});
