/* Medical-center signup: empty fields show an example (client request, 2026-11-05).
   Runs against the mock (`yarn start:demo`), one worker, waits on elements only. */
import { expect, test } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

const ID = 'medical-center-signup';

test('los campos vacíos del alta médica muestran un ejemplo, no una caja en blanco', async ({ page }) => {
  await page.goto('/auth/register/medical-center', { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);

  // Page 1 · legal and trade name.
  await expect(page.getByTestId(`${ID}-legal-name`)).toHaveAttribute('placeholder', /\S/);
  await expect(page.getByTestId(`${ID}-trade-name`)).toHaveAttribute('placeholder', /\S/);

  await page.getByTestId(`${ID}-tenant-type`).getByRole('combobox').click();
  await page.locator('dialog.select-dialog[open]').getByRole('option', { name: 'Clínica', exact: true }).click();
  await page.getByTestId(`${ID}-legal-name`).fill('Clínica Norte');
  await page.getByTestId(`${ID}-legal-entity-type`).getByRole('combobox').click();
  await page.locator('dialog.select-dialog[open]').getByRole('option').nth(1).click();
  await page.getByTestId('paginated-form-continuar').click();

  // Page 2 · NIT and SEDES number.
  await page.getByTestId(`${ID}-tax-id`).fill('1023456789');
  await page.getByTestId(`${ID}-health-registration`).fill('SEDES-SC-2020-0412');
  await page.getByTestId('paginated-form-continuar').click();

  // Page 3 · medical director: the name boxes and the e-mail.
  for (const campo of ['nombre', 'segundo-nombre', 'apellido-paterno', 'apellido-materno']) {
    await expect(page.getByTestId(`${ID}-director-${campo}`)).toHaveAttribute('placeholder', /\S/);
  }
  await expect(page.getByTestId(`${ID}-director-email`)).toHaveAttribute('placeholder', /\S/);
});
