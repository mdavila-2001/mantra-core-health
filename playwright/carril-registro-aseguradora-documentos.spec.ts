import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  archivoFalso,
  esperarSubidaLista,
  pdfDePrueba,
  subirArchivo,
  subirLosCincoDocumentos,
} from './helpers/documentos-legales';
import { completarGerencias, completarRepresentanteLegal } from './helpers/representante-legal';

/**
 * Subtarea 1.2 · documentación legal en PDF del autorregistro de aseguradora
 * (`/auth/register/organization`).
 *
 * ## Qué demuestra y qué no
 *
 * Comportamiento en el navegador contra el backend simulado
 * (`mock-backend.interceptor`): las 5 zonas de arrastre obligatorias, que un
 * archivo no-PDF o de más de 10 MB no se sube y explica por qué, que un PDF
 * válido termina en «listo» con su nombre y peso, que faltar uno bloquea
 * «Continuar», y que completarlos los cinco permite llegar a la confirmación.
 * El mock no emite `UploadProgress` (ver `mock-backend.interceptor.ts`), así
 * que la barra queda indeterminada acá; que el porcentaje real se calcula lo
 * prueba `dropzone-pdf.spec.ts` con un `Subject` simulando eventos HTTP. La
 * persistencia contra la API real (`directory.tenant_affiliation_documents`)
 * la cubre `organization-legal-documents.int-spec.ts` contra Neon.
 */

const RUTA = '/auth/register/organization';
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'registro-aseguradora-documentos');

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled' });
}

async function abrirElAlta(page: Page): Promise<void> {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByLabel('Tipo societario')).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByLabel('Tipo societario').locator('option:not([hidden])').first(),
  ).toBeAttached({ timeout: 20_000 });
}

/** Completa los tres primeros pasos (subtarea 1.1) y llega a la sección de documentos. */
async function llegarADocumentos(page: Page): Promise<void> {
  await page.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
  await page
    .getByLabel('Tipo societario')
    .selectOption({ label: 'S.R.L. · Sociedad de Responsabilidad Limitada' });
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toHaveText('Cómo se la identifica');
  await page.getByTestId('registro-organizacion-codigo').fill('ANDINA-SALUD');
  await page.getByTestId('registro-organizacion-sigla').fill('AS');
  await page.getByTestId('registro-organizacion-carrier').fill('CARRIER-AS');
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
  await page.getByTestId('registro-organizacion-nit').fill('NIT-123456');
  await page.getByTestId('registro-organizacion-direccion').fill('Av. Siempre Viva 123');
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toContainText(
    'Documentación legal obligatoria (PDF)',
  );
}

test.describe('alta pública de aseguradora — documentación legal en PDF (subtarea 1.2)', () => {
  test.describe.configure({ mode: 'serial' });

  test('la sección trae las 5 zonas obligatorias con rótulos de Bolivia', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    // `getByText` es ambiguo acá: el rótulo del campo y el texto visible del
    // botón de subida repiten el mismo texto a propósito (`textoDelBoton()`
    // en `file-input.ts` usa `label()` cuando no hay archivo elegido), y los
    // dos son `<label>` reales (el de `app-form-field` y el `dropzone-content`
    // interno de `app-file-input`). `.form-field-label` es el único de los
    // dos que pertenece al campo, no al control.
    const rotuloDeDocumento = (texto: string) =>
      page.locator('label.form-field-label', { hasText: texto });

    await expect(rotuloDeDocumento('Escritura de constitución')).toBeVisible();
    await expect(rotuloDeDocumento('Certificado de NIT')).toBeVisible();
    await expect(rotuloDeDocumento('Matrícula de comercio (SEPREC)')).toBeVisible();
    await expect(rotuloDeDocumento('Licencia de funcionamiento municipal')).toBeVisible();
    await capturar(page, 'paso-4-primera-tanda');

    // «Continuar» no avanza con la primera tanda vacía (los 4 son
    // obligatorios): hay que subirlos para ver la segunda tanda.
    for (const clave of [
      'constitutionFileId',
      'taxIdentifierFileId',
      'commerceRegistryFileId',
      'operatingLicenseFileId',
    ] as const) {
      await subirArchivo(page, clave, pdfDePrueba(clave));
      await esperarSubidaLista(page, clave);
    }
    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.locator('.paginated-form__titulo')).toContainText('(2 de 2)');
    await expect(rotuloDeDocumento('Certificado del SEDES')).toBeVisible();
    await capturar(page, 'paso-4-segunda-tanda');
  });

  test('un archivo que no es PDF se rechaza y no queda «subido»', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    await subirArchivo(
      page,
      'constitutionFileId',
      archivoFalso('constitucion.docx', 'application/vnd.openxmlformats', 1024),
    );

    await expect(page.getByTestId('registro-organizacion-doc-constitutionFileId-error')).toHaveText(
      'Solo se admiten documentos PDF de hasta 10 MB.',
    );
    await expect(
      page.getByTestId('registro-organizacion-doc-constitutionFileId-quitar'),
    ).toHaveCount(0);
    await capturar(page, 'rechazo-formato-invalido');
  });

  test('un PDF de más de 10 MB se rechaza igual', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    await subirArchivo(
      page,
      'taxIdentifierFileId',
      archivoFalso('nit-enorme.pdf', 'application/pdf', 11 * 1024 * 1024),
    );

    await expect(page.getByTestId('registro-organizacion-doc-taxIdentifierFileId-error')).toHaveText(
      'Solo se admiten documentos PDF de hasta 10 MB.',
    );
  });

  test('un PDF válido se sube y queda con su nombre y peso', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    await subirArchivo(page, 'constitutionFileId', pdfDePrueba('ESCRITURA DE CONSTITUCION'));
    await esperarSubidaLista(page, 'constitutionFileId');

    const estado = page.getByTestId('registro-organizacion-doc-constitutionFileId-estado');
    await expect(estado).toContainText('documento.pdf');
    await expect(estado).toContainText('KB');
    await capturar(page, 'documento-subido');
  });

  test('con 4 de 5 documentos, el paso no avanza y lo explica', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    await subirArchivo(page, 'constitutionFileId', pdfDePrueba('CONSTITUCION'));
    await esperarSubidaLista(page, 'constitutionFileId');
    await subirArchivo(page, 'taxIdentifierFileId', pdfDePrueba('NIT'));
    await esperarSubidaLista(page, 'taxIdentifierFileId');
    await subirArchivo(page, 'commerceRegistryFileId', pdfDePrueba('SEPREC'));
    await esperarSubidaLista(page, 'commerceRegistryFileId');
    // `operatingLicenseFileId` queda sin subir a propósito.

    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByText('Este documento es obligatorio para continuar')).toBeVisible();
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Documentación legal obligatoria (PDF)',
    );
    await capturar(page, 'bloqueo-documento-faltante');
  });

  test('con los 5 documentos, el alta llega a la confirmación', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    await subirLosCincoDocumentos(page);

    // Representante legal y directorio ejecutivo (subtarea 1.4); cubiertos a
    // fondo por `carril-registro-aseguradora-representante.spec.ts` — acá
    // sólo se completan para que el flujo llegue a la confirmación.
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Representante legal (1 de 2)',
    );
    await completarRepresentanteLegal(page);
    await expect(page.locator('.paginated-form__titulo')).toContainText('Directorio ejecutivo');
    await completarGerencias(page);

    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await page.getByTestId('registro-organizacion-owner-nombre').fill('Ana');
    await page.getByTestId('registro-organizacion-owner-apellido-paterno').fill('Paz');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText('Tu cuenta');
    await page.getByTestId('registro-organizacion-owner-correo').fill('admin@andina.test');
    await page.getByTestId('registro-organizacion-owner-password').fill('secreto12');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
    await capturar(page, 'exito-con-documentos');
  });

  test('la sección de documentos no se desborda en teléfono ni en tablet', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADocumentos(page);

    for (const [nombre, tamano] of [
      ['movil-390x844', { width: 390, height: 844 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
    ] as const) {
      await page.setViewportSize(tamano);
      await expect(
        page.locator('label.form-field-label', { hasText: 'Escritura de constitución' }),
      ).toBeVisible();

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, `responsive-${nombre}`);
    }
  });
});
