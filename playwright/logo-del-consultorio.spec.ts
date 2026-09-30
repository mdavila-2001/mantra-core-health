import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * El logo del consultorio: en la ficha (Facturación), en el editor y en el
 * membrete del PDF. Contra el simulador de `mockup` (cuenta `medica@alovida.mock`).
 *
 * Deja evidencia en `docs/trabajo/2026-09-30-logo-del-consultorio/`:
 * capturas de la ficha y del editor y los PDF descargados con y sin logo.
 */

const EVIDENCIA = join('docs', 'trabajo', '2026-09-30-logo-del-consultorio');

test.beforeAll(() => {
  mkdirSync(EVIDENCIA, { recursive: true });
});

async function entrarComoMedica(page: Page): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Un PNG cuadrado, distinto del logo sembrado, dibujado en el propio navegador. */
async function pngCuadrado(page: Page, ruta: string): Promise<void> {
  const base64 = await page.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 240;
    lienzo.height = 240;
    const contexto = lienzo.getContext('2d')!;
    contexto.fillStyle = '#7c3aed';
    contexto.fillRect(0, 0, 240, 240);
    contexto.fillStyle = '#ffffff';
    contexto.font = 'bold 44px sans-serif';
    contexto.fillText('LOGO', 48, 140);
    return lienzo.toDataURL('image/png').split(',')[1]!;
  });
  writeFileSync(ruta, Buffer.from(base64, 'base64'));
}


/**
 * Navega **dentro** de la SPA, sin recargar. El simulador guarda los bytes de
 * un archivo recién subido en memoria: un F5 los pierde (limitación conocida de
 * `files.handlers.ts`), y con ellos el logo que se acaba de cargar.
 */
async function irA(page: Page, ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await page.waitForURL(`**${ruta.split('?')[0]}**`);
}

async function abrirFacturacion(page: Page): Promise<void> {
  await irA(page, '/my-account');
  await page.getByRole('tab', { name: 'Facturación' }).click();
  await expect(page.getByTestId('perfil-factura-recuadro')).toBeVisible();
}

async function descargarPdf(page: Page, destino: string): Promise<void> {
  await irA(page, '/administration/accounting/libros');
  // Al médico los libros se le ofrecen plegados: hay que abrirlos.
  await page.getByRole('button', { name: 'Ver los libros contables de la práctica' }).click();
  const boton = page.getByRole('button', { name: 'Exportar a PDF' }).first();
  await expect(boton).toBeVisible({ timeout: 60_000 });
  const [descarga] = await Promise.all([page.waitForEvent('download'), boton.click()]);
  await descarga.saveAs(destino);
}

test('el logo del consultorio se ve, se cambia, se quita y sale en el PDF', async ({ page }) => {
  test.setTimeout(300_000);
  await entrarComoMedica(page);

  // 1 · Ficha, Facturación: el logo sembrado, dentro del recuadro y en su caja 2:1.
  await abrirFacturacion(page);
  const logo = page.getByTestId('perfil-factura-logo');
  await expect(logo.locator('img')).toBeVisible();
  const caja = (await logo.boundingBox())!;
  expect(caja.width / caja.height).toBeCloseTo(2, 1);
  const alturaConLogo = (await page.getByTestId('perfil-factura-recuadro').boundingBox())!.height;
  await page.screenshot({ path: join(EVIDENCIA, 'ficha-facturacion-con-logo-1440.png') });

  // 2 · PDF con el logo en la ranura.
  await descargarPdf(page, join(EVIDENCIA, 'pdf-con-logo.pdf'));

  // 3 · Editor: la misma caja, con su logo.
  await irA(page, '/my-account/edit?pestana=2');
  await expect(page.getByTestId('edicion-logo-vista').locator('img')).toBeVisible();
  await page.screenshot({ path: join(EVIDENCIA, 'editor-facturacion-con-logo-1440.png') });

  // 4 · Subir uno nuevo (cuadrado) y guardar.
  const nuevo = join(EVIDENCIA, 'logo-nuevo-cuadrado.png');
  await pngCuadrado(page, nuevo);
  await page.locator('[data-testid="edicion-logo"] input[type="file"]').setInputFiles(nuevo);
  // La vista previa pasa del SVG sembrado al PNG recién elegido: recién ahí terminó de subir.
  await expect(page.getByTestId('edicion-logo-vista').locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Tu perfil quedó actualizado.')).toBeVisible();
  await page.screenshot({ path: join(EVIDENCIA, 'editor-facturacion-logo-cuadrado-1440.png') });

  await abrirFacturacion(page);
  await expect(logo.locator('img')).toBeVisible();
  await page.screenshot({ path: join(EVIDENCIA, 'ficha-facturacion-logo-cuadrado-1440.png') });
  await descargarPdf(page, join(EVIDENCIA, 'pdf-con-logo-cuadrado.pdf'));

  // 5 · Quitarlo: la caja sigue, con «Sin logo», y el recuadro no cambia de alto.
  await irA(page, '/my-account/edit?pestana=2');
  await page.getByTestId('edicion-logo-quitar').click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Tu perfil quedó actualizado.')).toBeVisible();
  await page.screenshot({ path: join(EVIDENCIA, 'editor-facturacion-sin-logo-1440.png') });

  await abrirFacturacion(page);
  await expect(page.getByTestId('logo-consultorio-vacio')).toBeVisible();
  const alturaSinLogo = (await page.getByTestId('perfil-factura-recuadro').boundingBox())!.height;
  expect(alturaSinLogo).toBeCloseTo(alturaConLogo, 0);
  await page.screenshot({ path: join(EVIDENCIA, 'ficha-facturacion-sin-logo-1440.png') });
  await descargarPdf(page, join(EVIDENCIA, 'pdf-sin-logo.pdf'));

  // 6 · Móvil: el recuadro y el logo caben en la pantalla, con el logo arriba de los datos.
  // (El desborde horizontal de la página a 390 px es previo y viene de la cabecera y de
  // las pestañas —se ve igual en «Datos personales»—; acá se mide sólo lo de este cambio.)
  await page.setViewportSize({ width: 390, height: 844 });
  await irA(page, '/my-account');
  await page.getByRole('tab', { name: 'Facturación' }).click();
  const recuadro = (await page.getByTestId('perfil-factura-recuadro').boundingBox())!;
  const cajaMovil = (await page.getByTestId('perfil-factura-logo').boundingBox())!;
  const nit = (await page.getByTestId('perfil-factura-nit').boundingBox())!;
  expect(recuadro.x + recuadro.width).toBeLessThanOrEqual(390);
  expect(cajaMovil.x + cajaMovil.width).toBeLessThanOrEqual(recuadro.x + recuadro.width);
  expect(cajaMovil.y + cajaMovil.height).toBeLessThanOrEqual(nit.y);
  await page.screenshot({ path: join(EVIDENCIA, 'ficha-facturacion-sin-logo-390.png') });
});
