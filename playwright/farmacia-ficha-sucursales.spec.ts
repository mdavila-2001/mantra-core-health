import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Public pharmacy sheet, "Sucursales" tab (demo mode, no network interception).
 * Serve with `yarn start:demo`. Regression for composition-rules §5: the
 * prescription field must not be capped to a form width, the single branch must
 * not leave empty columns, and the long "use my location" button must stay
 * inside the card at 390 px.
 */

const SHEET = '/pharmacies-directory/farmacia-vida';
const VIEWPORTS = [
  { width: 1440, height: 900, minFieldShare: 0.8 },
  { width: 390, height: 844, minFieldShare: 0.6 },
] as const;

async function signInAsPatient(page: Page): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/);
  }
}

for (const viewport of VIEWPORTS) {
  test(`pharmacy sheet: branches tab fills the card at ${viewport.width} px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await signInAsPatient(page);

    await page.goto(SHEET);
    await esperarAplicacionLista(page);
    const card = page.locator('app-card').first();
    await expect(card).toBeVisible();
    await expect(page.locator('app-card')).toHaveCount(1);

    await page.getByRole('tab', { name: /^Sucursales/ }).click();
    await expect(page).toHaveURL(/[?&]tab=sucursales/);
    const field = card.locator('textarea');
    await expect(field).toBeVisible();

    const cardBox = (await card.boundingBox())!;
    const fieldBox = (await field.boundingBox())!;
    expect(
      fieldBox.width / cardBox.width,
      'the prescription field must not be capped to a form width',
    ).toBeGreaterThanOrEqual(viewport.minFieldShare);

    const location = card.getByRole('button', { name: /Usar mi ubicación/ });
    await expect(location).toBeVisible();
    const locationBox = (await location.boundingBox())!;
    expect(
      locationBox.x + locationBox.width,
      'the location button stays inside the card',
    ).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);

    // A single branch (the grid <li>) must span the same width as the form container below it
    // (it used to take a third of the row). The <textarea> itself has inner padding, so compare
    // against its <app-form-field> wrapper.
    const branchItems = card.getByTestId('pharmacy-branches').locator('> li');
    await expect(branchItems).toHaveCount(1);
    const itemBox = (await branchItems.first().boundingBox())!;
    const formBox = (await card.locator('app-form-field').first().boundingBox())!;
    expect(
      Math.abs(itemBox.width - formBox.width),
      'a single branch spans the same width as the form container',
    ).toBeLessThanOrEqual(2);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      'no horizontal page scroll',
    ).toBe(false);
    expect(errors, 'browser console errors').toEqual([]);
  });
}
