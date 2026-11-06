import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Bug fixed 2026-11-06: on /schedule/blocks a time range over several days was
 * saved as ONE exception (first day 09:00 → last day 11:00), which also closed
 * the nights and mornings in between. Now it is one block per day.
 *
 * Flow: UI → save → three cards «de 09:00 a 11:00», one per day → reload →
 * still three. Runs against the demo (in-browser mock API). It fails without
 * the fix: the list shows a single card spanning the three days.
 */
async function entrarComoMedica(page: Page): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

function dentroDe(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
}

/** The date picker masks its text: type the digits like a person. */
async function escribirFecha(campo: Locator, fecha: Date): Promise<void> {
  const digitos = `${String(fecha.getDate()).padStart(2, '0')}${String(fecha.getMonth() + 1).padStart(2, '0')}${fecha.getFullYear()}`;
  await campo.click();
  await campo.press('Control+A');
  await campo.press('Backspace');
  await campo.pressSequentially(digitos, { delay: 30 });
  await campo.press('Tab');
}

test('una franja de tres días queda como tres bloqueos, uno por día', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarComoMedica(page);

  await page.goto('/schedule/blocks', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('bloqueo-nuevo').click();
  const form = page.locator('app-block-form');
  await expect(form).toBeVisible();

  const fechas = form.locator('app-date-picker input');
  await escribirFecha(fechas.nth(0), dentroDe(50));
  await escribirFecha(fechas.nth(1), dentroDe(52));

  await page.getByRole('radio', { name: 'Sólo una franja de cada día' }).click();
  await form.getByLabel('Desde').fill('09:00');
  await form.getByLabel('Hasta').fill('11:00');
  await form.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(form).toBeHidden();

  const tarjetas = page.locator('.bloqueos__item').filter({ hasText: 'de 09:00 a 11:00' });
  await expect(tarjetas).toHaveCount(3);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.bloqueos__item').filter({ hasText: 'de 09:00 a 11:00' })).toHaveCount(3);
});
