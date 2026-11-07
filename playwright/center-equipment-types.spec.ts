import { expect, test, type Page } from '@playwright/test';

/**
 * «Horarios y equipos»: an imaging center registers its MRI scanner. Before
 * mantra-core-health-api#1359 the form did not offer «Resonancia magnética»
 * (the API had no device type for it and answered 422), so the modality
 * stayed at «0 de 0 operativos» forever. Walks UI → request → response →
 * reload → UI against the simulator, which answers inside the browser and
 * records each request in `window.__mockRequests`.
 *
 * Runs against `yarn start:demo` (`E2E_BASE_URL`, default localhost:4200).
 */

interface MockEntry {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill('imagen@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
}

async function openEquipment(page: Page): Promise<void> {
  await page.goto('/administration/center-schedule');
  await expect(page.getByTestId('centro-horarios')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Equipos' }).click();
}

test('an imaging center registers an MRI scanner and it stays after a reload', async ({ page }) => {
  const name = `Resonador E2E ${Date.now()}`;
  await signIn(page);
  await openEquipment(page);

  await page.getByTestId('centro-equipo-agregar').click();
  await page.getByTestId('equipment-catalog-by-hand').click();
  const form = page.getByTestId('centro-equipo-formulario');
  await form.getByTestId('centro-equipo-nombre').fill(name);
  await form.getByTestId('centro-equipo-modalidad').locator('.select-trigger').click();
  await page.getByRole('option', { name: 'Resonancia magnética' }).click();

  const before = await page.evaluate(() => ((window as unknown as { __mockRequests?: unknown[] }).__mockRequests ?? []).length);
  await form.getByTestId('centro-equipo-guardar').click();
  const sent = await page.waitForFunction(
    (from) =>
      ((window as unknown as { __mockRequests?: MockEntry[] }).__mockRequests ?? [])
        .slice(from)
        .find((r) => r.method === 'POST' && r.url.endsWith('/equipment')) ?? false,
    before,
  );
  const request = (await sent.jsonValue()) as MockEntry;
  expect(request.status).toBeLessThan(300);
  expect(request.body).toMatchObject({ name, modalityCode: 'RM' });

  const section = page.getByRole('region', { name: 'Resonancia magnética' });
  await expect(section.getByRole('article', { name })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('centro-horarios')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Equipos' }).click();
  await expect(page.getByRole('region', { name: 'Resonancia magnética' }).getByRole('article', { name })).toBeVisible();
});

test('a center picks a mammography unit from the international catalog and it stays after a reload', async ({ page }) => {
  await signIn(page);
  await openEquipment(page);

  await page.getByTestId('centro-equipo-agregar').click();
  const dialog = page.getByRole('dialog', { name: 'Agregar equipo' });
  await dialog.getByRole('button', { name: 'Mamografía, 6 equipos' }).click();
  await dialog.getByTestId('equipment-catalog-pick-ims-giotto-class').click();
  const form = dialog.getByTestId('centro-equipo-formulario');
  const serial = `GIO-${Date.now()}`;
  await form.getByRole('textbox', { name: 'Nº de serie' }).fill(serial);

  const before = await page.evaluate(() => ((window as unknown as { __mockRequests?: unknown[] }).__mockRequests ?? []).length);
  await form.getByTestId('centro-equipo-guardar').click();
  const sent = await page.waitForFunction(
    (from) =>
      ((window as unknown as { __mockRequests?: MockEntry[] }).__mockRequests ?? [])
        .slice(from)
        .find((r) => r.method === 'POST' && r.url.endsWith('/equipment')) ?? false,
    before,
  );
  const request = (await sent.jsonValue()) as MockEntry;
  expect(request.status).toBeLessThan(300);
  expect(request.body).toMatchObject({ name: 'Mamógrafo Giotto Class', manufacturer: 'IMS Giotto', serialNumber: serial, modalityCode: 'MG' });
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('centro-horarios')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Equipos' }).click();
  await expect(page.getByRole('region', { name: 'Mamografía' }).getByRole('article', { name: 'Mamógrafo Giotto Class' }).first()).toBeVisible();
});

test('the catalog is a sortable table with modality chips, search and one «Elegir» per row', async ({ page }) => {
  await signIn(page);
  await openEquipment(page);

  await page.getByTestId('centro-equipo-agregar').click();
  const dialog = page.getByRole('dialog', { name: 'Agregar equipo' });
  const count = dialog.getByTestId('equipment-catalog-count');
  await expect(count).toContainText('Mostrando 41 de 41 equipos');
  await expect(dialog.getByRole('columnheader', { name: /Equipo/ })).toBeVisible();
  await expect(dialog.getByTestId('equipment-catalog-pick-ims-giotto-class')).toBeVisible();

  await dialog.getByRole('button', { name: 'Resonancia, 6 equipos' }).click();
  await expect(count).toContainText('Mostrando 6 de 41 equipos');
  await expect(dialog.getByTestId('equipment-catalog-pick-siemens-magnetom-vida')).toBeVisible();

  await dialog.getByRole('button', { name: 'Todos, 41 equipos' }).click();
  await dialog.getByLabel('Buscar equipo').fill('hologic');
  await expect(count).toContainText('Mostrando 3 de 41 equipos');

  await dialog.getByLabel('Buscar equipo').fill('zzz-sin-resultados');
  await expect(dialog.getByTestId('equipment-catalog-empty')).toBeVisible();

  await dialog.getByLabel('Buscar equipo').fill('selenia');
  await dialog.getByTestId('equipment-catalog-pick-hologic-selenia-dimensions').click();
  await expect(dialog.getByTestId('centro-equipo-formulario')).toBeVisible();
});
