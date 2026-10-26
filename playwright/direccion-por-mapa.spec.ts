/**
 * La dirección empieza por el mapa (pedido del cliente, 26/10/2026): primero se
 * toca el lugar en el mapa de Bolivia y **aparece, ya lleno**, el formulario con
 * calle, distrito, municipio, provincia y departamento.
 *
 * Se prueba en el alta pública de paciente. El de profesional monta el mismo
 * componente (`app-address-by-map`) para su domicilio y su consultorio.
 *
 * Contra `ng serve --configuration development,demo` (la maqueta responde el
 * catálogo de municipios). Nunca se espera `networkidle`: con HMR no llega.
 */
import { expect, test, type Page } from '@playwright/test';

import { elegirOpcion, empezarElAlta, PASOS_DEL_ALTA } from './support/registro-paciente';

const RUTA_DE_SALIDA = 'artifacts/playwright/direccion-por-mapa';

/**
 * Toca el plano de Leaflet hasta que un toque cae dentro de Bolivia.
 *
 * El plano abre mostrando el país entero, y según el ancho de la ventana el
 * centro cae en Bolivia o en el Brasil de al lado: un toque fuera del país no
 * abre el formulario (y lo dice), así que se prueban unos cuantos puntos del
 * centro hasta que uno entra. Devuelve el prefijo del formulario ya abierto.
 */
async function tocarDentroDeBolivia(page: Page, prefijo: string): Promise<void> {
  const plano = page.getByTestId(`${prefijo}-mapa`).locator('.leaflet-container');
  await expect(plano).toBeVisible({ timeout: 30_000 });
  await plano.scrollIntoViewIfNeeded();
  // Deja que Leaflet termine de encuadrar Bolivia antes de tocar.
  await page.waitForTimeout(1_500);
  const caja = await plano.boundingBox();
  expect(caja).not.toBeNull();

  const candidatos: readonly (readonly [number, number])[] = [
    [0.5, 0.55],
    [0.46, 0.6],
    [0.5, 0.45],
    [0.54, 0.62],
    [0.42, 0.5],
    [0.5, 0.7],
  ];
  for (const [fx, fy] of candidatos) {
    await page.mouse.click(caja!.x + caja!.width * fx, caja!.y + caja!.height * fy);
    const abrio = await page
      .getByTestId(`${prefijo}-formulario`)
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (abrio) return;
  }
  throw new Error('Ningún toque cayó dentro de Bolivia');
}

test.describe('la dirección empieza por el mapa', () => {
  test('alta de paciente: primero el mapa, y al tocarlo el formulario sale lleno', async ({
    page,
  }) => {
    await empezarElAlta(page);
    await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.residencia })).toBeVisible();

    // 1. Lo primero es el mapa de Bolivia. Todavía no hay formulario.
    await expect(page.getByTestId('registration-residence-mapa')).toBeVisible();
    await expect(page.getByTestId('registration-residence-formulario')).toHaveCount(0);
    await expect(page.getByTestId('registro-domicilio-calle')).toHaveCount(0);
    await page.screenshot({ path: `${RUTA_DE_SALIDA}/1-mapa-primero-1440.png`, fullPage: true });

    // 2. Al tocar, el mapa se acerca al punto y aparece el formulario.
    await tocarDentroDeBolivia(page, 'registration-residence');
    const formulario = page.getByTestId('registration-residence-formulario');
    await expect(formulario).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('registration-residence-buscando')).toHaveCount(0);

    const mapa = page.getByTestId('registration-residence-mapa');
    await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible();

    // 3. Los cinco datos de la dirección, y los tres que salen del mapa llenos.
    await expect(page.getByTestId('registro-domicilio-calle')).toBeVisible();
    await expect(page.getByTestId('registration-residence-distrito')).toBeVisible();
    // El municipio sale del mapa cuando el catálogo lo tiene (la maqueta trae
    // sólo un subconjunto): si no, queda por elegir, nunca inventado. Lo que
    // siempre sale del punto es la provincia y el departamento.
    await expect(
      page.getByTestId('registration-residence-departamento').locator('.select-value'),
    ).not.toHaveText(/Elija el departamento/);
    await expect(page.getByTestId('registration-residence-provincia')).not.toHaveValue('');
    await page.screenshot({ path: `${RUTA_DE_SALIDA}/2-formulario-lleno-1440.png`, fullPage: true });

    // 4. La calle y el distrito los escribe la persona; el municipio llegó solo,
    //    así que el alta deja seguir sin tocarlo.
    await page.getByTestId('registro-domicilio-calle').fill('Av. Banzer #42');
    await page.getByTestId('registration-residence-distrito').fill('5');
    // Si el catálogo de la maqueta no trae el municipio del punto, se elige entre
    // los del departamento que el mapa ya dedujo.
    const municipio = page.getByTestId('registration-residence-municipio').locator('.select-value');
    if (/Elija el municipio/.test((await municipio.textContent()) ?? '')) {
      await elegirOpcion(page, 'registration-residence-municipio', { index: 1 });
    }
    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.contacto })).toBeVisible();

    // 5. Volver trae el formulario ya lleno, sin pedir el mapa otra vez.
    await page.getByTestId('paginated-form-atras').click();
    await expect(page.getByTestId('registration-residence-formulario')).toBeVisible();
    await expect(page.getByTestId('registro-domicilio-calle')).toHaveValue('Av. Banzer #42');
    await expect(page.getByTestId('registration-residence-distrito')).toHaveValue('5');
  });

  test('con «Usar mi ubicación» el formulario sale con municipio, provincia y departamento', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -17.7833, longitude: -63.1821 });

    await empezarElAlta(page);
    await page.getByTestId('registration-residence-usar-ubicacion').click();

    await expect(page.getByTestId('registration-residence-formulario')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByTestId('registration-residence-municipio').locator('.select-value'),
    ).toHaveText(/Santa Cruz de la Sierra/);
    await expect(page.getByTestId('registration-residence-provincia')).toHaveValue('Andrés Ibáñez');
    await expect(
      page.getByTestId('registration-residence-departamento').locator('.select-value'),
    ).toHaveText(/Santa Cruz/);
    await page.screenshot({ path: `${RUTA_DE_SALIDA}/2b-santa-cruz-1440.png`, fullPage: true });

    // El municipio llegó solo: el alta deja seguir sin tocarlo.
    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.contacto })).toBeVisible();
  });

  test('tocar otro punto vacía la calle escrita y la vuelve a pedir', async ({ page }) => {
    await empezarElAlta(page);
    await tocarDentroDeBolivia(page, 'registration-residence');
    await expect(page.getByTestId('registration-residence-formulario')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('registro-domicilio-calle').fill('Av. Banzer #42');

    // El mapa ya está acercado: un toque desplazado cae en otro punto.
    const caja = await page
      .getByTestId('registration-residence-mapa')
      .locator('.leaflet-container')
      .boundingBox();
    await page.mouse.click(caja!.x + caja!.width / 2 + 60, caja!.y + caja!.height / 2 + 40);

    await expect(page.getByTestId('registro-domicilio-calle')).toHaveValue('');
    await expect(page.getByTestId('registration-residence-reescribir')).toBeVisible();
  });

  test('«completar a mano» deja elegir sin mapa, y el departamento acota el municipio', async ({
    page,
  }) => {
    await empezarElAlta(page);
    await page.getByTestId('registration-residence-a-mano').click();

    await expect(page.getByTestId('registration-residence-formulario')).toBeVisible();
    await elegirOpcion(page, 'registration-residence-departamento', { label: 'Santa Cruz' });
    await elegirOpcion(page, 'registration-residence-municipio', { index: 1 });
    await expect(
      page.getByTestId('registration-residence-municipio').locator('.select-value'),
    ).not.toHaveText(/Elija el municipio/);

    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.contacto })).toBeVisible();
  });

  test('a 375 px el formulario cabe sin desborde horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await empezarElAlta(page);
    await tocarDentroDeBolivia(page, 'registration-residence');
    await expect(page.getByTestId('registration-residence-formulario')).toBeVisible({
      timeout: 20_000,
    });

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${RUTA_DE_SALIDA}/3-formulario-lleno-375.png`, fullPage: true });
  });
});

test.describe('alta de médico: la dirección también empieza por el mapa', () => {
  async function escribirFecha(page: Page, digitos: string): Promise<void> {
    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    await fecha.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await fecha.pressSequentially(digitos, { delay: 20 });
  }

  async function continuar(page: Page): Promise<void> {
    const boton = page.getByTestId('paginated-form-continuar');
    await expect(boton).toBeEnabled({ timeout: 15_000 });
    await boton.click();
  }

  /** Deja la pantalla en «¿Dónde vive?», tras los cuatro primeros pasos. */
  async function llegarAlDomicilio(page: Page): Promise<void> {
    await page.goto('/auth/register/practitioner');
    await expect(page.getByTestId('registro-form-profesional')).toBeVisible();

    await page.getByTestId('registro-pro-nombre').fill('Ana');
    await page.getByTestId('registro-pro-apellido-paterno').fill('Rojas');
    await page.getByTestId('registro-pro-documento').fill('7654321');
    await elegirOpcion(page, 'registro-pro-departamento-ci', { index: 1 });
    await continuar(page);

    await expect(page.getByTestId('registration-practitioner-sex')).toBeVisible();
    await elegirOpcion(page, 'registration-practitioner-sex', { index: 1 });
    await escribirFecha(page, '02021985');
    await continuar(page);

    await expect(page.getByTestId('registro-pro-celular-personal')).toBeVisible();
    await page.getByTestId('registro-pro-celular-personal').fill('70011223');
    await page.getByTestId('registro-pro-correo-personal').fill('ana.rojas@example.com');
    await continuar(page);

    // «El contacto de su trabajo» es todo opcional.
    await expect(page.getByTestId('registro-pro-celular-trabajo')).toBeVisible();
    await continuar(page);

    await expect(page.getByRole('heading', { name: '¿Dónde vive?' })).toBeVisible();
  }

  test('el domicilio: mapa primero y el formulario sale lleno', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -17.7833, longitude: -63.1821 });
    await llegarAlDomicilio(page);

    await expect(page.getByTestId('registration-practitioner-residence-mapa')).toBeVisible();
    await expect(page.getByTestId('registration-practitioner-residence-formulario')).toHaveCount(0);
    await page.screenshot({ path: `${RUTA_DE_SALIDA}/4-medico-mapa-primero-1440.png`, fullPage: true });

    await page.getByTestId('registration-practitioner-residence-usar-ubicacion').click();
    await expect(page.getByTestId('registration-practitioner-residence-formulario')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByTestId('registration-practitioner-residence-municipio').locator('.select-value'),
    ).toHaveText(/Santa Cruz de la Sierra/);
    await expect(page.getByTestId('registration-practitioner-residence-provincia')).toHaveValue(
      'Andrés Ibáñez',
    );
    await expect(
      page.getByTestId('registration-practitioner-residence-departamento').locator('.select-value'),
    ).toHaveText(/Santa Cruz/);
    await expect(page.getByTestId('registration-practitioner-home-address')).toBeVisible();
    await expect(page.getByTestId('registration-practitioner-residence-distrito')).toBeVisible();
    await page.getByTestId('registration-practitioner-home-address').fill('Av. Banzer #42');
    await page.screenshot({ path: `${RUTA_DE_SALIDA}/5-medico-formulario-lleno-1440.png`, fullPage: true });

    await continuar(page);
    await expect(page.getByRole('heading', { name: '¿Dónde trabaja?' })).toBeVisible();
  });
});
