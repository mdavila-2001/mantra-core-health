import type { Page } from '@playwright/test';

/**
 * Completa «Tu cuenta», la última página del alta: las cinco partes del
 * nombre del owner —que desde el bloque canónico viven todas en la misma
 * pantalla, no repartidas en dos— más el correo y la contraseña.
 *
 * El nombre se llena con las dos partes obligatorias; las tres opcionales
 * se pasan por `nombre` cuando una prueba quiera ejercitarlas.
 *
 * Deja pulsado «Continuar», que en esta página es el envío del alta.
 */
export async function completarCuentaDelOwner(
  page: Page,
  opciones: {
    readonly email: string;
    readonly nombre?: Partial<{
      middleName: string;
      thirdName: string;
      motherLastName: string;
    }>;
  },
): Promise<void> {
  const nombre = opciones.nombre ?? {};

  await page.getByTestId('registro-organizacion-owner-nombre').fill('Ana');
  if (nombre.middleName !== undefined) {
    await page.getByTestId('registro-organizacion-owner-segundo-nombre').fill(nombre.middleName);
  }
  if (nombre.thirdName !== undefined) {
    await page.getByTestId('registro-organizacion-owner-tercer-nombre').fill(nombre.thirdName);
  }
  await page.getByTestId('registro-organizacion-owner-apellido-paterno').fill('Paz');
  if (nombre.motherLastName !== undefined) {
    await page
      .getByTestId('registro-organizacion-owner-apellido-materno')
      .fill(nombre.motherLastName);
  }

  await page.getByTestId('registro-organizacion-owner-correo').fill(opciones.email);
  await page.getByTestId('registro-organizacion-owner-password').fill('secreto12');
  await page.getByTestId('paginated-form-continuar').click();
}
