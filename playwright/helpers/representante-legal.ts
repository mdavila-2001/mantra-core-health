import type { Page } from '@playwright/test';

import { esperarSubidaLista, pdfDePrueba, subirArchivo } from './documentos-legales';

/**
 * Completa las dos páginas del representante legal (subtarea 1.4 + desglose
 * de nombre): las cinco partes del nombre, CI, correo y contraseña en
 * «(1 de 2)», el poder notariado en «(2 de 2)». Deja el asistente en
 * «Directorio ejecutivo».
 *
 * El representante legal es también el owner: es la única persona que inicia
 * sesión por la aseguradora, así que el correo y la contraseña de acá son los
 * del login. No hay una página «Tu cuenta» aparte.
 */
export async function completarRepresentanteLegal(
  page: Page,
  opciones: { readonly email?: string } = {},
): Promise<void> {
  await page.getByTestId('registro-organizacion-representante-nombre').fill('Mariana');
  await page.getByTestId('registro-organizacion-representante-apellido-paterno').fill('Siles');
  await page
    .getByTestId('registro-organizacion-representante-apellido-materno')
    .fill('Justiniano');
  await page.getByTestId('registro-organizacion-representante-ci').fill('4872190 SC');
  await page
    .getByTestId('registro-organizacion-representante-correo')
    .fill(opciones.email ?? 'legal@andina.test');
  await page.getByTestId('registro-organizacion-representante-password').fill('secreto12');
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
 * (AC-02). Es la última página del alta: su «Continuar» **envía** el alta.
 */
export async function completarGerencias(page: Page): Promise<void> {
  // La General trae las cinco partes (AC-01): es la que demuestra el
  // desglose completo, comercial y marketing sólo las dos obligatorias.
  await page
    .getByTestId('registro-organizacion-executives-general-manager-nombre')
    .fill('Carlos');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-segundo-nombre')
    .fill('Eduardo');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-tercer-nombre')
    .fill('Andrés');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-apellido-paterno')
    .fill('Mendoza');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-apellido-materno')
    .fill('Rivero');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-phone')
    .fill('70000001');
  await page
    .getByTestId('registro-organizacion-executives-general-manager-email')
    .fill('gm@andina.test');

  await page.getByRole('button', { name: /Gerente Comercial/ }).click();
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-nombre')
    .fill('Ana');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-apellido-paterno')
    .fill('Paz');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-phone')
    .fill('70000002');
  await page
    .getByTestId('registro-organizacion-executives-commercial-manager-email')
    .fill('cm@andina.test');

  await page.getByRole('button', { name: /Gerente de Marketing/ }).click();
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-nombre')
    .fill('Luis');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-apellido-paterno')
    .fill('Rojas');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-phone')
    .fill('70000003');
  await page
    .getByTestId('registro-organizacion-executives-marketing-manager-email')
    .fill('mm@andina.test');

  await page.getByTestId('paginated-form-continuar').click();
}
