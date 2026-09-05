import { expect, test } from '@playwright/test';

test('AG-49 forensic check: apellido paterno obligatorio vs spec (solo 6 campos deben ser obligatorios)', async ({ page }) => {
  await page.goto('/auth/register/patient');
  await page.waitForSelector('.paginated-form__titulo');
  const titulo1 = await page.locator('.paginated-form__titulo').textContent();
  console.log('TITULO_PAGINA_1:', titulo1);

  const continuar = page.getByTestId('paginated-form-continuar');
  await continuar.click();
  await page.waitForTimeout(800);
  const tituloDespues = await page.locator('.paginated-form__titulo').textContent();
  console.log('TITULO_DESPUES_DE_CLICK_SIN_LLENAR_NADA:', tituloDespues);
  const erroresVisibles = await page.locator('.form-field__error, [class*="error"]').allTextContents();
  console.log('ERRORES_VISIBLES:', JSON.stringify(erroresVisibles));

  await page.screenshot({ path: 'artifacts/playwright/ag49-check-pagina1-tras-click.png', fullPage: true });

  // Ahora llenar SOLO el nombre (custom), dejar apellido paterno vacío, reintentar.
  const nombreCustom = page.locator('input').first();
  await nombreCustom.fill('Juana');
  await page.getByTestId('registro-apellido-paterno').fill('');
  await continuar.click();
  await page.waitForTimeout(800);
  const tituloTrasNombreSoloConNombre = await page.locator('.paginated-form__titulo').textContent();
  console.log('TITULO_TRAS_LLENAR_SOLO_NOMBRE_SIN_APELLIDO:', tituloTrasNombreSoloConNombre);
  await page.screenshot({ path: 'artifacts/playwright/ag49-check-pagina1-solo-nombre.png', fullPage: true });
});
