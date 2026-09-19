import type { Page } from '@playwright/test';

import { esperarSubidaLista, pdfDePrueba, subirArchivo } from './documentos-legales';

/**
 * Completa las dos páginas del representante legal (subtarea 1.4 + desglose
 * de nombre): las cinco partes del nombre, CI y correo en «(1 de 2)», el
 * poder notariado en «(2 de 2)». Deja el asistente en «Directorio ejecutivo».
 */
export async function completarRepresentanteLegal(page: Page): Promise<void> {
  await page.getByTestId('registro-organizacion-representante-nombre').fill('Mariana');
  await page.getByTestId('registro-organizacion-representante-apellido-paterno').fill('Siles');
  await page
    .getByTestId('registro-organizacion-representante-apellido-materno')
    .fill('Justiniano');
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
 * Completa las tres gerencias del acordeón (subtarea 1.4 + desglose de
 * nombre): la General ya está abierta y trae las cinco partes del nombre
 * (AC-01); Comercial y Marketing se abren por su cabecera antes de escribir
 * y sólo llevan nombre y apellido paterno, las dos partes obligatorias
 * (AC-02). Deja el asistente en la página siguiente («Tu cuenta»).
 */
export async function completarGerencias(page: Page): Promise<void> {
  // La General trae las cinco partes (AC-01): es la que demuestra el
  // desglose completo, comercial y marketing sólo las dos obligatorias.
  await page
    .getByTestId('registro-organizacion-executives-general-manager-name')
    .fill('Carlos');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-middleName')
    .fill('Eduardo');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-thirdName')
    .fill('Andrés');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-lastName')
    .fill('Mendoza');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-motherLastName')
    .fill('Rivero');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-phone')
    .fill('70000001');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-email')
    .fill('gm@andina.test');

  await page.getByRole('button', { name: /Gerente Comercial/ }).click();
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-name')
    .fill('Ana');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-lastName')
    .fill('Paz');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-phone')
    .fill('70000002');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-email')
    .fill('cm@andina.test');

  await page.getByRole('button', { name: /Gerente de Marketing/ }).click();
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-name')
    .fill('Luis');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-lastName')
    .fill('Rojas');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-phone')
    .fill('70000003');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-email')
    .fill('mm@andina.test');

  await page.getByTestId('paginated-form-continuar').click();
}
