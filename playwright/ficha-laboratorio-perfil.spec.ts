/**
 * Public sheet of a laboratory / imaging centre (`/laboratory-directory/:unitId`),
 * in the simulator.
 *
 * Read-only screen: the journey is `UI → request → response → UI`, with the
 * patient deciding where to get a study done.
 *
 * 1. On a phone the sheet no longer scrolls sideways (it measured 624 px in a
 *    390 px viewport), the summary shows what the centre offers and the patient
 *    gets «Reservar desde mis órdenes», which leads to their orders;
 * 2. an area chip narrows the studies and says «N de M estudios»;
 * 3. a 252-study catalogue is drawn in batches of 24: «Mostrar más» adds the
 *    next batch and moves focus to it, and a new filter starts again at 24;
 * 4. a practitioner sees the sheet without the booking action.
 *
 * Runs against `ng serve` in demo mode (simulator).
 */
import { expect, test } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const IMAGING = `${BASE}/laboratory-directory/6eb39d1c-18d9-4a7c-a09a-00e0152d3f58`;
const PLEXUS = `${BASE}/laboratory-directory/33274214-9365-47b2-a526-281efcdee4e6`;

test('en el teléfono la ficha del centro de imagen cabe, resume y ofrece reservar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(IMAGING, { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('unit-card')).toBeVisible();
  await expect(page.getByTestId('unit-summary')).toContainText('Lo que ofrece este centro');
  await expect(page.getByTestId('unit-summary')).toContainText('Equipos operativos');
  await expect(page.getByTestId('unit-trust')).toContainText('Centro acreditado');

  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0], 'no sideways scroll on a phone').toBeLessThanOrEqual(widths[1]!);

  await page.locator('app-lab-area-filter app-chip', { hasText: 'Ecografía' }).click();
  await expect(page.getByTestId('unit-study')).toHaveCount(2);
  await expect(page.locator('.studies-panel__count')).toHaveText('2 de 11 estudios');

  await page.getByTestId('unit-book').click();
  await expect(page).toHaveURL(/\/my-account\/diagnostic-orders/);
});

test('un catálogo de 252 estudios va por tandas y «Mostrar más» lleva el foco a la nueva', async ({ page }) => {
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(PLEXUS, { waitUntil: 'domcontentloaded' });

  const cards = page.getByTestId('unit-study');
  await expect(cards).toHaveCount(24);
  await expect(page.getByText('Mostrando 24 de 252 estudios')).toBeVisible();

  await page.getByTestId('unit-studies-more').focus();
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(48);
  await expect(page.locator('[data-testid="unit-studies"] > li').nth(24)).toBeFocused();

  // A new filter starts from one batch again.
  const search = page.getByRole('textbox', { name: 'Buscar en estudios y servicios' });
  await search.fill('glucosa');
  await expect(cards).not.toHaveCount(48);
  await search.fill('');
  await expect(cards).toHaveCount(24);
});

test('el médico ve la ficha sin la acción de reservar', async ({ page }) => {
  await entrarAlSimulador(page, 'medico.nuevo', BASE);
  await page.goto(IMAGING, { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('unit-card')).toBeVisible();
  await expect(page.getByTestId('unit-book')).toHaveCount(0);
});
