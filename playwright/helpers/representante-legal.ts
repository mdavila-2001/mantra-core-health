import type { Page } from '@playwright/test';

import { esperarSubidaLista, pdfDePrueba, subirArchivo } from './documentos-legales';

/**
 * Completa las dos páginas del representante legal (subtarea 1.4): nombre,
 * CI y correo en «(1 de 2)», el poder notariado en «(2 de 2)». Deja el
 * asistente en «Directorio ejecutivo».
 */
export async function completarRepresentanteLegal(page: Page): Promise<void> {
  await page.getByTestId('registro-organizacion-representante-nombre').fill(
    'Mariana Siles Justiniano',
  );
  await page.getByTestId('registro-organizacion-representante-ci').fill('4872190 SC');
  await page
    .getByTestId('registro-organizacion-representante-correo')
    .fill('legal@andina.test');
  await page.getByTestId('paginated-form-continuar').click();

  await subirArchivo(page, 'powerOfAttorneyFileId', pdfDePrueba('poder-notariado'));
  await esperarSubidaLista(page, 'powerOfAttorneyFileId');
  await page.getByTestId('paginated-form-continuar').click();
}

/**
 * Completa las tres gerencias del acordeón (subtarea 1.4): la General ya
 * está abierta; Comercial y Marketing se abren por su cabecera antes de
 * escribir. Deja el asistente en la página siguiente («Tu cuenta»).
 */
export async function completarGerencias(page: Page): Promise<void> {
  await page
    .getByTestId('registro-organizacion-executives-general-manager-fullName')
    .fill('Carlos Mendoza');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-phone')
    .fill('70000001');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-email')
    .fill('gm@andina.test');

  await page.getByRole('button', { name: /Gerente Comercial/ }).click();
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-fullName')
    .fill('Ana Paz');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-phone')
    .fill('70000002');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-email')
    .fill('cm@andina.test');

  await page.getByRole('button', { name: /Gerente de Marketing/ }).click();
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-fullName')
    .fill('Luis Rojas');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-phone')
    .fill('70000003');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-email')
    .fill('mm@andina.test');

  await page.getByTestId('paginated-form-continuar').click();
}
