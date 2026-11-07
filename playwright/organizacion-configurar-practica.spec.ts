import { expect, test, type Page } from '@playwright/test';

/**
 * «Configurar práctica» is the door that creates an organization's practice. Once the
 * organization has one, the menu stops offering it (2026-11-07), but the route stays open
 * for the links that point to it. Runs against `ng serve --configuration development,demo`.
 */
async function login(page: Page, email: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-password').press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  await page.locator('#app-side-nav').waitFor({ timeout: 60_000 });
}

test('con la práctica ya creada, el menú no ofrece «Configurar práctica» y la ruta sigue abierta', async ({ page }) => {
  await login(page, 'quirofano@alovida.mock');
  const links = page.locator('#app-side-nav [data-testid="nav-enlace"]');
  // The branches entry is there, so the menu has loaded for a medical organization.
  await expect(links.and(page.locator('[href="/administration/medical-branches"]'))).toHaveCount(1);
  await expect(links.and(page.locator('[href="/administration/medical-center-setup"]'))).toHaveCount(0);

  await page.goto('/administration/medical-center-setup', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configurar práctica' })).toBeVisible({ timeout: 60_000 });
});
