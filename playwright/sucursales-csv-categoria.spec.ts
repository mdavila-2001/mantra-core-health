import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Browser evidence (2026-11-06): the branch CSV takes an optional `categoria`
 * column on the Branches tab. A row may not become a second head office (the
 * pharmacy already has one), and the created rows keep their category after a
 * full reload (the simulator persists branches).
 *
 * Run against `ng serve --configuration development,demo` (E2E_BASE_URL).
 * Waits only on concrete elements (HMR never settles). Screenshots go to
 * `evidencias/sucursales-csv-categoria-2026-11-06/`.
 */
const OUT = 'evidencias/sucursales-csv-categoria-2026-11-06';
mkdirSync(OUT, { recursive: true });

const CSV =
  'nombre;categoria;latitud;longitud\n' +
  'Sucursal Urbarí;sucursal;-17.7930;-63.1950\n' +
  'Sucursal Pampa;por defecto;-17.8010;-63.1580\n' +
  'Otra matriz;casa matriz;-17.7700;-63.1800\n' +
  'Sucursal Rara;franquicia;;\n';

test('CSV con categoría: valida, crea y la etiqueta persiste tras recargar', async ({ page }) => {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('login-identifier').fill('farmacia@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-password').press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });

  await page.goto('/administration/pharmacy-branches', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('branches-table').waitFor({ timeout: 60_000 });
  await page.getByTestId('branches-bulk-open').click();
  await page.getByRole('dialog').waitFor();
  await expect(page.getByRole('dialog').getByText('categoria', { exact: true })).toBeVisible();

  await page.getByTestId('branches-bulk-file').setInputFiles({
    name: 'sucursales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV, 'utf8'),
  });
  await expect(page.getByTestId('branches-bulk-valid-count')).toHaveText('2');
  await expect(page.getByTestId('branches-bulk-problem-count')).toHaveText('2');
  const problems = page.getByTestId('branches-bulk-problems');
  await expect(problems).toContainText('ya tiene una casa matriz');
  await expect(problems).toContainText('«casa matriz», «sucursal», «por defecto»');
  await expect(page.getByTestId('branches-bulk-preview')).toContainText('Por defecto');
  await page.screenshot({ path: `${OUT}/01-revision-del-csv-1440.png`, fullPage: true });

  await page.getByTestId('branches-bulk-confirm').click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 60_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('branches-table').waitFor({ timeout: 60_000 });

  const rowOf = (name: string) => page.getByTestId('branches-table').locator('tr', { hasText: name });
  await expect(rowOf('Sucursal Urbarí').locator('[data-testid^="branches-category-"]')).toHaveText(/Sucursal/);
  await expect(rowOf('Sucursal Pampa').locator('[data-testid^="branches-category-"]')).toHaveText(/Por defecto/);
  await expect(page.getByTestId('branches-table')).not.toContainText('Otra matriz');
  await page.screenshot({ path: `${OUT}/02-tras-recargar-1440.png`, fullPage: true });
});
