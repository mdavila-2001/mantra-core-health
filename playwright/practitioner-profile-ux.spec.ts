import { profileTest as test } from './support/practitioner-profile-test';
import { expect } from '@playwright/test';
import { contextoDeApi, firstDepartmentConceptId, type Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

test.use({ trace: 'off' });

/** Integración real: no intercepta respuestas ni omite ante una API caída. */
test('cancelar protege el borrador y conserva el perfil persistido al recargar', async ({
  page,
}) => {
  const api = await contextoDeApi();
  const suffix = String(Date.now());
  const actor: Actor = {
    rol: 'doctora',
    identificador: 'perfil.h1.' + suffix + '@example.com',
    clave: 'Synthetic-H1-2026!',
    nombre: 'Prueba Perfil',
  };
  const issuerAdministrativeAreaConceptId = await firstDepartmentConceptId(api);
  const registration = await api.post('/iam/auth/register-practitioner', {
    data: {
      email: actor.identificador,
      password: actor.clave,
      name: 'Prueba',
      lastName: 'Perfil',
      licenseNumber: 'H1-' + suffix,
      nationalId: 'H1-' + suffix,
      issuerAdministrativeAreaConceptId,
    },
  });
  expect(registration.status(), 'alta sintética contra API real').toBe(201);
  await api.dispose();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(response.status() + ' ' + new URL(response.url()).pathname);
  });
  await entrar(page, actor);
  await irA(page, '/account/profile');
  await expect(page.getByRole('tab', { name: 'Datos personales', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Datos personales', exact: true })).toBeVisible();
  await irA(page, '/my-account/edit');
  const name = page.getByRole('textbox', { name: 'Nombre', exact: true });
  await expect(name).toHaveValue('Prueba');
  await page.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await irA(page, '/my-account/edit');
  await expect(name).toHaveValue('Prueba');
  let profileWrites = 0;
  page.on('request', (request) => {
    if (
      ['PATCH', 'PUT', 'POST'].includes(request.method()) &&
      new URL(request.url()).pathname.startsWith('/profiles/')
    )
      profileWrites++;
  });
  await name.fill('Borrador sintético');
  await page.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('¿Descarta lo que escribió?');
  await dialog.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(name).toHaveValue('Borrador sintético');
  await page.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
  await dialog.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Datos personales', exact: true })).toBeVisible();
  await irA(page, '/my-account/edit');
  await expect(name).toHaveValue('Prueba');
  expect(profileWrites, 'cancelar no escribe el perfil').toBe(0);
  expect(errors, 'consola y red del flujo real').toEqual([]);
});

test('la ruta directa sin sesión solicita autenticación', async ({ page }) => {
  await page.goto('/account/profile');
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByTestId('login-identifier')).toBeVisible();
});
