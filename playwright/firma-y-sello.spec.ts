import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * La firma y el sello médicos: se suben, se ven, se cambian y se quitan desde el
 * perfil del doctor («Datos personales» de la ficha y del editor), se estampan
 * al pie de los PDF, y el alta los acepta como paso opcional. Son **imágenes**,
 * no una firma electrónica.
 *
 * Contra el simulador de `mockup` (cuenta `medica@alovida.mock`). Deja evidencia
 * en `docs/trabajo/2026-09-30-firma-y-sello/`.
 *
 * El simulador pierde los bytes de un archivo subido al recargar (F5), así que
 * después de subir se navega dentro de la SPA.
 */

const EVIDENCIA = join('docs', 'trabajo', '2026-09-30-firma-y-sello');

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

/** Navega dentro de la SPA, sin recargar (ver el comentario del archivo). */
async function irA(page: Page, ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await page.waitForURL(`**${ruta.split('?')[0]}**`);
}

type Dibujo = 'firma' | 'sello';

/** Una imagen PNG de mentira para subir, dibujada en el propio navegador. */
async function pngDe(page: Page, dibujo: Dibujo, ruta: string): Promise<void> {
  const base64 = await page.evaluate((tipo) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = tipo === 'firma' ? 450 : 200;
    lienzo.height = tipo === 'firma' ? 150 : 200;
    const c = lienzo.getContext('2d')!;
    c.clearRect(0, 0, lienzo.width, lienzo.height);
    c.strokeStyle = tipo === 'firma' ? '#065f46' : '#9a3412';
    c.lineWidth = tipo === 'firma' ? 5 : 6;
    c.lineCap = 'round';
    if (tipo === 'firma') {
      c.beginPath();
      c.moveTo(20, 100);
      c.bezierCurveTo(80, -10, 120, 160, 180, 60);
      c.bezierCurveTo(230, -20, 280, 150, 430, 70);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(100, 100, 92, 0, Math.PI * 2);
      c.stroke();
      c.font = 'bold 26px sans-serif';
      c.fillStyle = '#9a3412';
      c.textAlign = 'center';
      c.fillText('SELLO', 100, 92);
      c.font = '18px sans-serif';
      c.fillText('Mat. 7777', 100, 124);
    }
    return lienzo.toDataURL('image/png').split(',')[1]!;
  }, dibujo);
  writeFileSync(ruta, Buffer.from(base64, 'base64'));
}

async function abrirDatosPersonales(page: Page): Promise<Locator> {
  await irA(page, '/my-account');
  await page.getByRole('tab', { name: 'Datos personales' }).click();
  const bloque = page.getByTestId('perfil-firma-y-sello');
  await expect(bloque).toBeVisible();
  return bloque;
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

test('la firma y el sello se ven, se cambian y se quitan desde el perfil y salen en el PDF', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await entrarComoMedica(page);

  // 1 · Ficha, «Datos personales»: los dos sembrados, cada uno en su caja.
  let bloque = await abrirDatosPersonales(page);
  await expect(page.getByTestId('perfil-firma-vista').locator('img')).toBeVisible();
  await expect(page.getByTestId('perfil-sello-vista').locator('img')).toBeVisible();
  const cajaFirma = (await page.getByTestId('perfil-firma-vista').boundingBox())!;
  const cajaSello = (await page.getByTestId('perfil-sello-vista').boundingBox())!;
  expect(cajaFirma.width / cajaFirma.height).toBeCloseTo(3, 1);
  expect(cajaSello.width / cajaSello.height).toBeCloseTo(1, 1);
  // La ficha es de lectura: no hay cómo subir nada desde ahí.
  await expect(bloque.locator('input[type="file"]')).toHaveCount(0);
  await bloque.screenshot({ path: join(EVIDENCIA, 'ficha-con-firma-y-sello.png') });

  // 2 · PDF con la firma y el sello sembrados.
  await descargarPdf(page, join(EVIDENCIA, 'pdf-con-firma-y-sello.pdf'));

  // 3 · Editor: el bloque está en «Datos personales» y se puede cambiar.
  await irA(page, '/my-account/edit?pestana=0');
  const editor = page.getByTestId('edicion-firma-y-sello');
  await expect(editor).toBeVisible();
  await expect(page.getByTestId('edicion-firma-vista').locator('img')).toBeVisible();
  await expect(page.getByTestId('edicion-sello-vista').locator('img')).toBeVisible();
  await editor.screenshot({ path: join(EVIDENCIA, 'editor-con-firma-y-sello.png') });

  // 4 · Subir una firma y un sello nuevos y guardar.
  const firmaNueva = join(EVIDENCIA, 'firma-nueva.png');
  const selloNuevo = join(EVIDENCIA, 'sello-nuevo.png');
  await pngDe(page, 'firma', firmaNueva);
  await pngDe(page, 'sello', selloNuevo);
  await page.locator('[data-testid="edicion-firma"] input[type="file"]').setInputFiles(firmaNueva);
  await page.locator('[data-testid="edicion-sello"] input[type="file"]').setInputFiles(selloNuevo);
  // La vista previa pasa del SVG sembrado al PNG recién elegido: recién ahí terminó de subir.
  await expect(page.getByTestId('edicion-firma-vista').locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.getByTestId('edicion-sello-vista').locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Su perfil quedó actualizado.')).toBeVisible();
  await editor.screenshot({ path: join(EVIDENCIA, 'editor-con-firma-y-sello-nuevos.png') });

  bloque = await abrirDatosPersonales(page);
  await expect(page.getByTestId('perfil-firma-vista').locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.getByTestId('perfil-sello-vista').locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await bloque.screenshot({ path: join(EVIDENCIA, 'ficha-con-firma-y-sello-nuevos.png') });
  await descargarPdf(page, join(EVIDENCIA, 'pdf-con-firma-y-sello-nuevos.pdf'));

  // 5 · Quitar las dos: «Sin firma» y «Sin sello», y el PDF sale igual, con la línea vacía.
  await irA(page, '/my-account/edit?pestana=0');
  await page.getByTestId('edicion-firma-quitar').click();
  await page.getByTestId('edicion-sello-quitar').click();
  await expect(page.getByTestId('firma-o-sello-vacio-firma')).toBeVisible();
  await expect(page.getByTestId('firma-o-sello-vacio-sello')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Su perfil quedó actualizado.')).toBeVisible();
  await editor.screenshot({ path: join(EVIDENCIA, 'editor-sin-firma-ni-sello.png') });

  bloque = await abrirDatosPersonales(page);
  await expect(bloque.getByTestId('firma-o-sello-vacio-firma')).toBeVisible();
  await expect(bloque.getByTestId('firma-o-sello-vacio-sello')).toBeVisible();
  await bloque.screenshot({ path: join(EVIDENCIA, 'ficha-sin-firma-ni-sello.png') });
  await descargarPdf(page, join(EVIDENCIA, 'pdf-sin-firma-ni-sello.pdf'));

  // 6 · Móvil: el bloque entra en la pantalla.
  await page.setViewportSize({ width: 390, height: 844 });
  bloque = await abrirDatosPersonales(page);
  const caja = (await bloque.boundingBox())!;
  expect(caja.x + caja.width).toBeLessThanOrEqual(390);
  await bloque.screenshot({ path: join(EVIDENCIA, 'ficha-sin-firma-ni-sello-390.png') });
});

test('el alta del doctor ofrece la firma y el sello como paso opcional y se puede saltar', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const encabezado = page.locator('.paginated-form__titulo');
  const avanzar = async (siguiente: string): Promise<void> => {
    const continuar = page.getByTestId('paginated-form-continuar');
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await expect(encabezado).toHaveText(siguiente, { timeout: 20_000 });
  };

  await page.goto('/auth/register/practitioner');
  await expect(page.getByTestId('registro-form-profesional')).toBeVisible();
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await avanzar('Su documento de identidad');
  await page.getByTestId('registro-pro-documento').fill('1234567');
  await page.getByTestId('registro-pro-departamento-ci').locator('select').selectOption({ index: 1 });
  await avanzar('Cuéntenos un poco sobre usted');
  await page
    .getByTestId('registration-practitioner-sex')
    .locator('select')
    .selectOption({ label: 'Femenino' });
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, '12/05/1985');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await avanzar('Cómo le contactamos en privado');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill('ana.paz@example.test');
  await avanzar('El contacto de su trabajo');
  await avanzar('¿Dónde vive?');
  await avanzar('¿Dónde trabaja?');
  await avanzar('Su consultorio propio');
  await avanzar('Su título profesional y foto');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option', { name: 'Médico / Médica', exact: true }).click();
  await avanzar('Su habilitación para ejercer');
  await page.getByTestId('registro-pro-matricula').fill('MP-12345');
  await page.getByTestId('registro-pro-credencial').fill('T.I. 538/14');
  await avanzar('Los respaldos de su habilitación');
  await avanzar('Sus títulos');
  await avanzar('Sus especialidades');

  // El paso nuevo: opcional, con las dos cajas vacías.
  await avanzar('Su firma y su sello');
  await expect(page.getByTestId('firma-o-sello-vacio-firma')).toBeVisible();
  await expect(page.getByTestId('firma-o-sello-vacio-sello')).toBeVisible();
  await page.screenshot({ path: join(EVIDENCIA, 'alta-paso-firma-y-sello-vacio.png') });

  // Subir las dos: se ven en las cajas y se pueden quitar.
  const firma = join(EVIDENCIA, 'alta-firma.png');
  const sello = join(EVIDENCIA, 'alta-sello.png');
  await pngDe(page, 'firma', firma);
  await pngDe(page, 'sello', sello);
  await page.getByTestId('registro-pro-firma-input').setInputFiles(firma);
  await page.getByTestId('registro-pro-sello-input').setInputFiles(sello);
  await expect(page.locator('app-signature-or-seal img')).toHaveCount(2);
  await page.screenshot({ path: join(EVIDENCIA, 'alta-paso-firma-y-sello-cargados.png') });

  // Un formato que no es imagen se rechaza con su motivo.
  await page.getByTestId('registro-pro-firma-quitar').click();
  await expect(page.getByTestId('firma-o-sello-vacio-firma')).toBeVisible();
  const txt = join(EVIDENCIA, 'no-es-imagen.txt');
  writeFileSync(txt, 'no soy una imagen');
  await page.getByTestId('registro-pro-firma-input').setInputFiles({
    name: 'firma.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('no soy una imagen'),
  });
  await expect(page.getByRole('alert').filter({ hasText: 'JPG, PNG o WebP' })).toBeVisible();

  // Y termina el alta con el paso cargado (la firma se quitó y el sello sigue).
  await avanzar('Su contraseña');
  await page.getByTestId('registro-pro-password').fill('una-clave-segura-1');
  await page.getByTestId('paginated-form-continuar').click();
  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: join(EVIDENCIA, 'alta-terminada.png') });
});

test('el alta se completa sin cargar firma ni sello: el paso se salta', async ({ page }) => {
  test.setTimeout(300_000);
  const encabezado = page.locator('.paginated-form__titulo');
  const avanzar = async (siguiente: string): Promise<void> => {
    const continuar = page.getByTestId('paginated-form-continuar');
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await expect(encabezado).toHaveText(siguiente, { timeout: 20_000 });
  };

  await page.goto('/auth/register/practitioner');
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await avanzar('Su documento de identidad');
  await page.getByTestId('registro-pro-documento').fill('1234567');
  await page.getByTestId('registro-pro-departamento-ci').locator('select').selectOption({ index: 1 });
  await avanzar('Cuéntenos un poco sobre usted');
  await page
    .getByTestId('registration-practitioner-sex')
    .locator('select')
    .selectOption({ label: 'Femenino' });
  await page.getByPlaceholder('DD/MM/AAAA').evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, '12/05/1985');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await avanzar('Cómo le contactamos en privado');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill('ana.saltea@example.test');
  await avanzar('El contacto de su trabajo');
  await avanzar('¿Dónde vive?');
  await avanzar('¿Dónde trabaja?');
  await avanzar('Su consultorio propio');
  await avanzar('Su título profesional y foto');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option', { name: 'Médico / Médica', exact: true }).click();
  await avanzar('Su habilitación para ejercer');
  await page.getByTestId('registro-pro-matricula').fill('MP-12345');
  await page.getByTestId('registro-pro-credencial').fill('T.I. 538/14');
  await avanzar('Los respaldos de su habilitación');
  await avanzar('Sus títulos');
  await avanzar('Sus especialidades');
  await avanzar('Su firma y su sello');
  // Sin tocar nada, el motor deja pasar.
  await avanzar('Su contraseña');
  await page.getByTestId('registro-pro-password').fill('una-clave-segura-1');
  await page.getByTestId('paginated-form-continuar').click();
  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 30_000 });
});
