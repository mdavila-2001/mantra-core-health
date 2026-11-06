import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Browser evidence (2026-11-06): every organization's Branches screen —pharmacy,
 * laboratory, imaging and medical organization— shows a map with each site's
 * exact point and its category (head office, branch, default) as a label and
 * as a "by waves" filter (`?categoria=`) applied to both table and map.
 *
 * The mutation is proven UI → save → full reload → UI (the simulator persists
 * branches). The simulator answers inside the app (an HTTP interceptor), so no
 * network request is visible here: the request body is pinned by the component
 * spec and the response/persistence against PostgreSQL by the API integration
 * test `v4291-branches-category.int-spec.ts`.
 *
 * Run against `ng serve --configuration development,demo` (E2E_BASE_URL).
 * Waits only on concrete elements (HMR never settles). Screenshots go to
 * `evidencias/sucursales-mapa-categorias-2026-11-06/`.
 */
const OUT = 'evidencias/sucursales-mapa-categorias-2026-11-06';
mkdirSync(OUT, { recursive: true });

const ORGS = [
  { key: 'farmacia', email: 'farmacia@alovida.mock', path: '/administration/pharmacy-branches', pins: 3 },
  { key: 'laboratorio', email: 'laboratorio@alovida.mock', path: '/administration/laboratory-branches', pins: 1 },
  { key: 'imagenologia', email: 'imagen@alovida.mock', path: '/administration/laboratory-branches', pins: 1 },
  // A hospital staff member (the pilot hospital account is a platform admin with another menu).
  { key: 'organizacion-medica', email: 'quirofano@alovida.mock', path: '/administration/medical-branches', pins: 2 },
] as const;

/** Branch pins only (province name labels are markers too, in another pane). */
const PINS = '.leaflet-marker-pane .mapa__marcador';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-password').press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  await page.locator('#app-side-nav').waitFor({ timeout: 60_000 });
}

async function openBranches(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('branches-table').waitFor({ timeout: 60_000 });
  await page.getByTestId('branches-filter').waitFor({ timeout: 60_000 });
  await page.locator(PINS).first().waitFor({ timeout: 60_000 });
}

test.describe('Sucursales · mapa y categorías en toda organización', () => {
  for (const org of ORGS) {
    test(`${org.key}: mapa con un pin por sede, etiqueta y filtro por oleadas`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await login(page, org.email);

      const menu = await page
        .locator('#app-side-nav [data-testid="nav-enlace"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(menu, 'Branches entry in the menu').toContain(org.path);

      await openBranches(page, org.path);
      await expect(page.locator(PINS)).toHaveCount(org.pins);
      const labels = await page.locator('[data-testid^="branches-category-"]').allTextContents();
      expect(labels.length).toBeGreaterThan(0);
      await page.screenshot({ path: `${OUT}/${org.key}-todas-1440.png`, fullPage: true });

      await page.getByRole('radio', { name: /^Casa matriz/ }).click();
      await page.waitForURL(/categoria=head_office/);
      await expect(page.locator(PINS)).toHaveCount(1);
      for (const label of await page.locator('[data-testid^="branches-category-"]').allTextContents()) {
        expect(label.trim()).toBe('Casa matriz');
      }
      await page.screenshot({ path: `${OUT}/${org.key}-casa-matriz-1440.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  }

  test('organización médica: cambiar la categoría persiste (UI → guardar → recarga → UI)', async ({ page }) => {
    await login(page, 'hospital.piloto@alovida.mock');
    await openBranches(page, '/administration/medical-branches');
    await expect(page.getByTestId('branches-category-URUBO')).toHaveText(/Por defecto/);

    await page.getByTestId('branches-edit-URUBO').click();
    await page.getByRole('dialog').waitFor();
    await page.getByTestId('branches-category').click();
    // Another site is already the head office: the option is there but disabled.
    await expect(page.getByRole('option', { name: /Casa matriz/ })).toHaveAttribute('aria-disabled', 'true');
    await page.screenshot({ path: `${OUT}/organizacion-medica-dialogo-categoria-1440.png` });
    await page.getByRole('option', { name: /^Sucursal/ }).click();

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('branches-category-URUBO')).toHaveText(/Sucursal/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('branches-table').waitFor({ timeout: 60_000 });
    await expect(page.getByTestId('branches-category-URUBO')).toHaveText(/Sucursal/);
    await page.screenshot({ path: `${OUT}/organizacion-medica-tras-recarga-1440.png`, fullPage: true });
  });

  test('390 px: el mapa y la tabla caben sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1200 });
    await login(page, 'farmacia@alovida.mock');
    await openBranches(page, '/administration/pharmacy-branches');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${OUT}/farmacia-todas-390.png`, fullPage: true });
  });
});
