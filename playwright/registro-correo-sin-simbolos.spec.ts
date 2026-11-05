import { expect, test } from '@playwright/test';

import {
  avanzarHasta,
  completarContacto,
  elegirLocalidadDeResidencia,
  empezarElAlta,
  marcarYConfirmarCasa,
  PASOS_DEL_ALTA,
} from './support/registro-paciente';

// Patient signup: the email field must not accept spaces or special symbols,
// neither typed key by key nor pasted.
test('patient signup email drops spaces and special symbols', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  await empezarElAlta(page);
  await elegirLocalidadDeResidencia(page);
  await marcarYConfirmarCasa(page);
  await page.getByTestId('paginated-form-continuar').click();
  await completarContacto(page);
  await avanzarHasta(page, PASOS_DEL_ALTA.resto);

  const correo = page.getByTestId('registro-correo');
  await correo.pressSequentially('qqoe wqw*[]@@gmail.com', { delay: 15 });
  await expect(correo).toHaveValue('qqoewqw@gmail.com');

  await correo.fill('ana pérez(1);@gmail .com');
  await expect(correo).toHaveValue('anaprez1@gmail.com');

  await correo.fill('---++++-++--+++++');
  await expect(correo).toHaveValue('');

  await correo.pressSequentially('--ana..+paz-@gmail.com', { delay: 15 });
  await expect(correo).toHaveValue('ana.paz@gmail.com');

  await correo.fill('ana@gmail');
  await correo.blur();
  await expect(page.getByText('Ingrese un correo válido.')).toBeVisible();

  await correo.fill('qqoewqw@gmail.com');
  await correo.blur();
  await expect(page.getByText('Ingrese un correo válido.')).toBeHidden();
  await page.screenshot({
    path: 'evidencias/2026-11-04-correo-paciente/registro-correo-sin-simbolos.png',
  });
  expect(errores).toEqual([]);
});
