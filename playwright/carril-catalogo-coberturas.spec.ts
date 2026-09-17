import { expect, test } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const ROUTE = '/administration/insurance';

test.describe('catálogo administrable de planes y coberturas', () => {
  test('owner crea, edita y conserva importes y reglas después de recargar', async ({ page }) => {
    await entrarAlSimulador(page, 'aseguradora', '');
    await page.goto(ROUTE);
    await esperarAQueSeAsiente(page);

    await page.getByRole('button', { name: /Crear un plan en Seguros Andina/ }).click();
    let dialog = page.getByRole('dialog', { name: 'Nuevo plan' });
    await dialog.getByTestId('plan-code').fill('PW-INTEGRAL');
    await dialog.getByTestId('plan-name').fill('Plan Playwright Integral');
    await dialog.getByTestId('plan-effective-from').fill('2026-10-01');
    await dialog.getByRole('combobox').selectOption({ label: 'Boliviano' });
    await dialog.getByRole('button', { name: 'Crear plan' }).click();
    await expect(
      page.getByTestId('toast-mensaje').filter({ hasText: 'El plan se creó correctamente' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /Plan Playwright Integral/ })).toBeVisible();

    const newBenefit = page.getByRole('button', {
      name: 'Crear una cobertura en Plan Playwright Integral',
    });
    await newBenefit.click();
    dialog = page.getByRole('dialog', { name: 'Nueva cobertura' });
    await dialog.getByRole('combobox').selectOption({ label: 'Consulta externa' });
    await dialog.getByTestId('benefit-coverage').fill('80.50');
    await dialog.getByTestId('benefit-copay').fill('25.00');
    await dialog.getByRole('button', { name: 'Crear cobertura' }).click();
    await expect(
      page.getByTestId('toast-mensaje').filter({ hasText: 'La cobertura se creó correctamente' }),
    ).toBeVisible();

    let row = page.getByRole('row').filter({ hasText: 'Consulta externa' }).last();
    await expect(row).toContainText('80.50%');
    await row.getByRole('button', { name: /Editar cobertura/ }).click();
    dialog = page.getByRole('dialog', { name: 'Editar cobertura' });
    await dialog.getByTestId('benefit-coverage').fill('72.25');
    await dialog.getByTestId('benefit-copay').fill('');
    await dialog.getByTestId('benefit-deductible').fill('100.00');
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(
      page
        .getByTestId('toast-mensaje')
        .filter({ hasText: 'La cobertura se actualizó correctamente' }),
    ).toBeVisible();
    await expect(row).toContainText('72.25%');
    await expect(row).toContainText('100.00');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''))
      .toContain('Editar cobertura');

    await row.getByRole('button', { name: /Editar reglas de aprobación/ }).click();
    dialog = page.getByRole('dialog', { name: 'Reglas de aprobación' });
    await dialog.getByText('Requiere autorización previa', { exact: true }).click();
    await dialog.getByText('Orden médica justificativa', { exact: true }).click();
    await dialog.getByRole('textbox').fill('No cubre tratamientos experimentales.');
    await dialog.getByRole('button', { name: 'Guardar reglas' }).click();
    await expect(
      page
        .getByTestId('toast-mensaje')
        .filter({ hasText: 'Las reglas de aprobación se actualizaron' }),
    ).toBeVisible();

    await page.reload();
    await esperarAQueSeAsiente(page);
    row = page.getByRole('row').filter({ hasText: 'Consulta externa' }).last();
    await expect(row).toContainText('72.25%');
    await expect(row).toContainText('Sí');
    await row.getByRole('button', { name: /Editar reglas de aprobación/ }).click();
    dialog = page.getByRole('dialog', { name: 'Reglas de aprobación' });
    await expect(
      dialog.getByRole('checkbox', { name: 'Orden médica justificativa' }),
    ).toBeChecked();
    await expect(dialog.getByRole('textbox')).toHaveValue('No cubre tratamientos experimentales.');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const tableViewport = await page.locator('.catalog__table-scroll').last().boundingBox();
      expect(tableViewport).not.toBeNull();
      expect(tableViewport!.x).toBeGreaterThanOrEqual(0);
      expect(tableViewport!.x + tableViewport!.width).toBeLessThanOrEqual(width);
    }
  });

  test('staff del tenant conserva acceso de solo lectura sin acciones', async ({ page }) => {
    await entrarAlSimulador(page, 'aseguradora_staff', '');
    await page.goto(ROUTE);
    await esperarAQueSeAsiente(page);

    await expect(page.getByText(/Vista de solo lectura/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Crear un plan/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Crear una cobertura/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Editar cobertura/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reglas de aprobación/ })).toHaveCount(0);
  });
});
