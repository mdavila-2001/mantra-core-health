import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Lane G — «Usuarios y roles»: the directory of ALL app users (simulated,
 * provisional contract). Runs against the in-app simulator, never the API.
 */
const PANTALLA = '/superadmin/portal/governance/users';
const ADMIN: Actor = {
  rol: 'administrador',
  identificador: 'admin@alovida.mock',
  clave: 'S3cret-passw0rd',
  nombre: 'Admin (maqueta)',
};

test('the directory lists every account type, filters by type and never shows raw e-mails', async ({ page }) => {
  await entrar(page, ADMIN);
  await irA(page, PANTALLA);
  const tabla = page.getByTestId('portal-directory-table');
  await expect(tabla).toBeVisible({ timeout: 30_000 });
  await estable(page);

  await expect(page.getByTestId('directory-simulated')).toBeVisible();
  for (const tipo of ['Paciente', 'Médico', 'Farmacia', 'Laboratorio', 'Interno']) {
    await expect(tabla).toContainText(tipo);
  }
  const texto = (await tabla.textContent()) ?? '';
  expect(texto).not.toMatch(/password|contraseña|documento/i);
  // Every e-mail on screen carries the mask character.
  expect(texto).not.toMatch(/[a-z]@(ejemplo|alovida)\.test/);

  await page.getByRole('button', { name: /Médicos/ }).click();
  await expect(page).toHaveURL(/type=DOCTOR/);
  await expect(tabla).toContainText('Médico');
  await expect(tabla).not.toContainText('Paciente');
});

test('the internal users tab still lists the console staff', async ({ page }) => {
  await entrar(page, ADMIN);
  await irA(page, `${PANTALLA}?view=users`);
  const tabla = page.getByTestId('portal-internal-users-table');
  await expect(tabla).toContainText('Lucía Paredes', { timeout: 30_000 });
});
