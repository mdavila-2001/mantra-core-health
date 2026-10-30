import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const FOTO = join(
  'docs',
  'progress',
  'evidence',
  'lane-40',
  'fotos',
  'despues',
  'directorio-ficha-medico-paciente-1440.png',
);

test('el paciente abre una ficha pública desde el directorio', async ({ page }) => {
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(`${BASE}/directory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Directorio de médicos' })).toBeVisible();
  await esperarAQueSeAsiente(page);

  const tarjeta = page.locator('li[app-result-card]').first();
  const enlace = tarjeta.locator('a[href^="/directory/"]').first();
  await expect(enlace).toBeVisible();

  const nombre = (await enlace.innerText()).trim().replace(/^,\s*/, '');
  const ruta = await enlace.getAttribute('href');
  const especialidad = (await tarjeta.locator('.tarjeta-resultado__subtitulo').innerText()).trim();
  expect(ruta).toMatch(/^\/directory\/[^/]+$/);
  expect(especialidad).not.toBe('');

  await enlace.click();
  await page.waitForURL((url) => url.pathname === ruta);
  await expect(page.locator('h1.page-header__title')).toContainText(nombre);
  await expect(page.locator('app-practitioner-profile-view')).toBeVisible();
  await expect(
    page.locator('app-practitioner-profile-view').getByLabel('Especialidades').getByText(especialidad),
  ).toBeVisible();

  mkdirSync(join('docs', 'progress', 'evidence', 'lane-40', 'fotos', 'despues'), {
    recursive: true,
  });
  await page.screenshot({ path: FOTO });
  expect(statSync(FOTO).size).toBeGreaterThan(8 * 1024);
});
