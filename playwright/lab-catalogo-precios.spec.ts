/**
 * Lab «Precios» with the LOINC catalog (proceso 4.2), in the simulator.
 *
 * The journey, `UI → request → response → persistence → reload → UI`:
 *
 * 1. «Agregar del catálogo» leads to the catalog, grouped by sample type (blood,
 *    urine…) and filtered to urine; the Hemograma is added with its
 *    components and, after reloading, says it is already in the price list;
 *    with one component unticked, which is then not offered at all;
 * 2. «Precios» shows the panel with its components under it, and the component
 *    that came without a suggested price waits as «Falta el precio»;
 * 3. its first price is typed and saved, and it is still there after reloading;
 *
 * Runs against `ng serve` in demo mode (simulator).
 */
import { expect, test } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const PRICES = `${BASE}/administration/laboratory-prices`;

test('el laboratorio agrega el Hemograma del catálogo y le pone precio a un componente', async ({ page }) => {
  await entrarAlSimulador(page, 'laboratorio', BASE);

  await page.goto(PRICES, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('lab-prices-table')).toBeVisible();
  await page.getByTestId('lab-prices-catalog').click();
  await expect(page).toHaveURL(/laboratory-prices\/catalog/);

  // Browsed by sample type: blood first, urine apart, each card with its section.
  const sangre = page.getByRole('heading', { name: /^Análisis de sangre/ });
  await expect(sangre).toBeVisible();
  await page.goto(`${PRICES}/catalog?sample=URINE`, { waitUntil: 'domcontentloaded' });
  const ego = page.locator('[data-testid="lab-catalog-item"][data-code="EGO"]');
  await expect(ego).toContainText('Uroanálisis y orina');
  await expect(page.getByTestId('lab-catalog-item')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: /^Análisis de orina/ })).toBeVisible();
  await expect(sangre).toHaveCount(0);

  await page.goto(`${PRICES}/catalog?q=hemograma`, { waitUntil: 'domcontentloaded' });
  const hemograma = page.locator('[data-testid="lab-catalog-item"][data-code="HEMOGRAMA"]');
  await expect(hemograma).toBeVisible();
  await hemograma.locator('summary').click();
  // Every component starts ticked; the lab unticks the ones it does not offer.
  const partes = hemograma.getByTestId('lab-catalog-part');
  await expect(partes.getByRole('checkbox', { checked: true })).toHaveCount(6);
  await partes.filter({ hasText: 'Hematocrito' }).locator('app-checkbox').click();
  await expect(hemograma).toContainText('Sus componentes: 5 de 6 elegidos');
  await hemograma.locator('app-checkbox').first().click();
  await page.getByTestId('lab-catalog-add').click();
  await expect(page.getByTestId('lab-catalog-result')).toContainText('agreg');

  // Persistence: after a full reload it still says it is in the price list.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(hemograma).toContainText('Ya está en su lista de precios');

  // The panel with its components under it; the unsuggested one waits for its price.
  await page.goto(PRICES, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Buscar un servicio' }).fill('hemograma');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lab-prices-price-HEMOGRAMA.VCM')).toBeVisible();
  // The unticked component was never made a service: it is not in the price list.
  await expect(page.getByTestId('lab-prices-price-HEMOGRAMA.HTO')).toHaveCount(0);
  await expect(page.locator('.price-table__of').first()).toContainText('Componente de');
  await expect(page.getByText('Falta el precio').first()).toBeVisible();

  const vcm = page.getByTestId('lab-prices-price-HEMOGRAMA.VCM');
  await vcm.fill('12');
  await page.getByTestId('lab-prices-save').click();
  await expect(page.getByText('Guardó el precio de 1 servicio.')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Buscar un servicio' }).fill('hemograma');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lab-prices-price-HEMOGRAMA.VCM')).toHaveValue('12.00');
});
