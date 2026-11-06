import { expect, test } from '@playwright/test';

/**
 * The «Horario de atención» step of the organization sign-ups (05/11/2026), through the
 * laboratory sign-up: preloaded template, overlap error on the day row, per-branch hours that
 * start as «same as headquarters», and a submit that reaches the success screen.
 *
 * Runs against the demo mock. What goes on the wire (`openingHours` in `organization` and in
 * each branch) and the rows it leaves in `directory.tenant_opening_hours` are covered by the
 * real-API run in `docs/evidencias/2026-11-05-horario-de-atencion/`.
 */
const H = 'registration-lab-hours';

test('laboratorio: el paso «Horario de atención» viene precargado, valida y deja terminar el alta', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/auth/register/laboratory');
  await expect(page.locator('app-register-laboratory app-paginated-form')).toBeVisible({ timeout: 30_000 });

  // The fields under test are the hours; the rest is loaded through Angular's dev hooks.
  const marca = Date.now().toString().slice(-7);
  await page.evaluate((m) => {
    const el = document.querySelector('app-register-laboratory')!;
    // Dev-mode hook: the component's public surface is typed loosely on purpose.
    type Hook = Record<string, (...args: unknown[]) => unknown> & { form: { patchValue(v: object): void } };
    const ng = (window as unknown as { ng: { getComponent(e: Element): Hook; applyChanges(e: Element): void } }).ng;
    const c = ng.getComponent(el);
    c.form.patchValue({
      legalName: `Laboratorio Horario ${m} S.R.L.`,
      companyType: 'UNIPERSONAL',
      taxId: `10${m}`,
      legalRepName: { name: 'Lucía', lastName: 'Vargas' },
      legalRepIdNumber: '7654321',
      legalRepEmail: `horario-${m}@example.test`,
      password: 'S3cret-passw0rd',
      confirmPassword: 'S3cret-passw0rd',
      addressLines: 'Av. Cañoto 456',
    });
    c['fijarGpsCentral']!({ lat: -17.7833, lng: -63.1821 });
    c['agregarSucursal']!();
    const id = (c['sucursales']!() as { id: string }[])[0]!.id;
    c['escribirNombreDeSucursal']!(id, 'Sucursal Norte');
    c['fijarGpsDeSucursal']!(id, { lat: -17.7652, lng: -63.1961 });
    ng.applyChanges(el);
  }, marca);

  // Walk to the hours step.
  const sede = page.getByTestId(`${H}-headquarters`);
  for (let i = 0; i < 12 && !(await sede.isVisible()); i++) {
    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.locator('app-paginated-form')).toBeVisible();
  }
  await expect(sede).toBeVisible();

  // Preloaded: Monday open, Sunday closed.
  await expect(page.getByTestId(`${H}-hq-opens-0-0`)).toHaveValue('08:00');
  await expect(page.getByTestId(`${H}-hq-opens-6-0`)).toHaveCount(0);

  // A second shift that overlaps the first is refused on the row of the day.
  await page.getByTestId(`${H}-hq-add-shift-0`).click();
  await expect(page.getByTestId(`${H}-hq-error-0`)).toBeVisible();
  await page.getByTestId(`${H}-hq-closes-0-0`).fill('12:00');
  await expect(page.getByTestId(`${H}-hq-error-0`)).toHaveCount(0);

  // The branch starts with «same as headquarters»; turning it off gives it its own hours.
  await expect(page.getByTestId(`${H}-sucursal-1-24h`)).toHaveCount(0);
  await page.getByTestId(`${H}-same-sucursal-1`).locator('.switch-container').click();
  await expect(page.getByTestId(`${H}-sucursal-1-24h`)).toBeVisible();

  // To the end: the sign-up finishes.
  for (let i = 0; i < 15 && !(await page.getByTestId('registro-lab-exito').isVisible()); i++) {
    // The notarized power is required for every organization and is not a field the dev hook sets.
    const poder = page.locator('input[type="file"][data-testid="registro-lab-doc-powerOfAttorneyFileId"], [data-testid="registro-lab-doc-powerOfAttorneyFileId"] input[type="file"]');
    if ((await poder.count()) > 0 && !(await page.getByText('Quitar', { exact: true }).isVisible())) {
      await poder.first().setInputFiles({ name: 'poder.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });
      await expect(page.getByText('Quitar', { exact: true })).toBeVisible({ timeout: 15_000 });
    }
    await page.getByTestId('paginated-form-continuar').click({ timeout: 5_000 }).catch(() => undefined);
    await expect(page.getByTestId('paginated-form-continuar').or(page.getByTestId('registro-lab-exito'))).toBeVisible();
  }
  await expect(page.getByTestId('registro-lab-exito')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('registro-lab-error')).toHaveCount(0);
});
