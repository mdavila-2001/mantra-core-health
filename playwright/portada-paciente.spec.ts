import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar } from './support/sesion';

/**
 * The patient's home, mounted through `@defer (on immediate)` in
 * `features/dashboard/dashboard.html` (commit daa626670), against the
 * simulator (`yarn start:demo`).
 *
 * `tsc` does not check templates and a deferred block that never resolves
 * leaves an empty page that still answers 200: only a browser can say the
 * home shows up with its content.
 */

const PACIENTE: Actor = { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' };

test('la portada del paciente aparece con su contenido', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  await entrar(page, PACIENTE);
  await expect(page).toHaveURL(/\/dashboard/);

  const portada = page.getByTestId('mi-salud');
  await expect(portada).toBeVisible({ timeout: 60_000 });
  await expect(portada.getByRole('heading', { level: 1 })).toHaveText(/\S/);
  await expect(page.getByTestId('mi-salud-sintomas')).toBeVisible();
  await expect(page.getByTestId('mi-salud-proxima-cita')).toBeVisible();
  expect(errores).toEqual([]);
});
