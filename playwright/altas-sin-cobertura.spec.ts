import { expect, test, type Page } from '@playwright/test';

import { chooseOption } from './helpers/combobox';
import { pdfDePrueba } from './helpers/documentos-legales';
import { centroDelPin } from './helpers/mapa';
import {
  PASOS_DEL_ALTA,
  completarContacto,
  elegirLocalidadDeResidencia,
  marcarYConfirmarCasa,
  empezarElAlta,
} from './support/registro-paciente';

/**
 * Las tres altas públicas que no tenían ninguna prueba de punta a punta:
 * **paciente**, **laboratorio** e **imagenología** (03/10/2026).
 *
 * Médico, aseguradora y farmacia ya se recorren enteras en sus propios specs
 * (`registro-doctor-universidad-y-profesiones`, `carril-registro-aseguradora-*`,
 * `registro-farmacia`). Acá se completa cada una de las tres restantes con lo
 * obligatorio y se exige la pantalla de éxito: si un paso deja de avanzar, el
 * título esperado no llega y la prueba falla en ese paso, no al final.
 *
 * Corre contra la maqueta en memoria (`environment.mockBackend`): el envío lo
 * atiende el interceptor de Angular, no hay HTTP real que observar. Lo que el
 * cuerpo del `POST` lleva lo fijan las unitarias de cada componente.
 */

const TITULO = '.paginated-form__titulo';

/** Espera que el motor muestre una página cuyo título contenga `titulo`. */
async function enLaPagina(page: Page, titulo: string): Promise<void> {
  await expect(page.locator(TITULO)).toContainText(titulo, { timeout: 20_000 });
}

/** Un clic en «Continuar» con el botón ya habilitado. */
async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar');
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

/**
 * Pasa de largo páginas opcionales hasta llegar a `titulo`. Tope de seis
 * clics: si una página obligatoria no deja avanzar, el título nunca llega y
 * la prueba falla acá, nombrando la página a la que no se pudo llegar.
 */
async function continuarHasta(page: Page, titulo: string): Promise<void> {
  for (let intento = 0; intento < 6; intento++) {
    const actual = (await page.locator(TITULO).textContent())?.trim() ?? '';
    if (actual.includes(titulo)) return;
    await continuar(page);
    // Igualdad exacta, no subcadena: «Los papeles (2 de 2)» contiene «Los papeles».
    await expect(page.locator(TITULO)).not.toHaveText(actual, { timeout: 20_000 });
  }
  await enLaPagina(page, titulo);
}

/** Nombre desglosado (`app-inline-name-fields`): las dos partes obligatorias. */
async function escribirNombre(page: Page, prefijo: string, nombre: string, apellido: string): Promise<void> {
  await page.getByTestId(`${prefijo}-nombre`).fill(nombre);
  await page.getByTestId(`${prefijo}-apellido-paterno`).fill(apellido);
}

/** Sube un PDF al selector de archivos cuyo `testId` cae en el host o en el `<input>`. */
async function subir(page: Page, testId: string, nombre: string): Promise<void> {
  const destino = page.locator(
    `input[type="file"][data-testid="${testId}"], [data-testid="${testId}"] input[type="file"]`,
  );
  await destino.first().setInputFiles(pdfDePrueba(nombre));
}

/**
 * Places and confirms the HQ pin from the context's geolocation: the pin is
 * required and the street is derived from it (no address field since 26/10/2026).
 */
async function confirmarCentral(page: Page, prefijo: string): Promise<void> {
  await page.getByTestId(`${prefijo}-central-location-use`).click();
  await centroDelPin(page.getByTestId(`${prefijo}-central-map`));
  await page.getByTestId(`${prefijo}-central-location-confirm`).click();
  await expect(page.getByTestId(`${prefijo}-central-location-confirmed`)).toBeAttached();
}

test.describe('dónde se elige el tipo de alta', () => {
  test('«Crear cuenta» ofrece sólo paciente y médico', async ({ page }) => {
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('tipo-paciente')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('tipo-profesional')).toBeVisible();
    for (const id of ['tipo-aseguradora', 'tipo-laboratorio', 'tipo-imagenologia', 'tipo-farmacia']) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
  });

  test('«Registre su organización» del acceso lleva a las cuatro altas de organización', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-registro-organizacion').click();
    await expect(page).toHaveURL(/\/auth\/register\/organization-type$/);
    for (const [id, ruta] of [
      ['tipo-aseguradora', '/auth/register/organization'],
      ['tipo-laboratorio', '/auth/register/laboratory'],
      ['tipo-imagenologia', '/auth/register/imaging-center'],
      ['tipo-farmacia', '/auth/register/pharmacy'],
    ] as const) {
      await expect(page.getByTestId(id)).toHaveAttribute('href', ruta);
    }
    await expect(page.getByTestId('tipo-paciente')).toHaveCount(0);
  });
});

test.describe('altas públicas sin cobertura previa: paciente, laboratorio, imagenología', () => {
  test.use({ geolocation: { latitude: -17.7833, longitude: -63.1821 }, permissions: ['geolocation'] });
  /**
   * Regresión del 03/10/2026: con el campo vacío, la plantilla `DD/MM/AAAA`
   * ocupa sólo la izquierda del input y un clic en cualquier otro punto dejaba
   * el cursor en el año. Tecleado `01011990`, el campo quedaba en
   * `DD/MM/0101`, inválido, y el alta no pasaba del paso 3.
   */
  test('paciente: la fecha de nacimiento se escribe tecleando, sin abrir el calendario', async ({ page }) => {
    await page.goto('/auth/register/patient');
    // La fecha va en el primer paso, junto al nombre y el documento.
    await enLaPagina(page, PASOS_DEL_ALTA.identidad);

    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    await fecha.click();
    await page.keyboard.type('01011990', { delay: 150 });
    await expect(fecha).toHaveValue('01/01/1990');
  });

  test('paciente: lo obligatorio alcanza para crear la cuenta', async ({ page }) => {
    await empezarElAlta(page, `CI-ALTA-${Date.now()}`);

    await elegirLocalidadDeResidencia(page);

    await marcarYConfirmarCasa(page);
    await continuar(page);
    await completarContacto(page);
    await continuarHasta(page, PASOS_DEL_ALTA.resto);

    await page.getByTestId('registro-correo').fill(`paciente-${Date.now()}@alovida.test`);
    await page.getByTestId('registro-password').fill('Alta-Paciente1!');
    await page.getByTestId('registro-password-confirm').fill('Alta-Paciente1!');

    const enviar = page.getByTestId('paginated-form-continuar');
    await expect(enviar).toHaveText(/Crear cuenta/);
    await continuar(page);

    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('registro-error')).toHaveCount(0);
  });

  test('laboratorio: lo obligatorio alcanza para terminar el alta', async ({ page }) => {
    await page.goto('/auth/register/laboratory', { waitUntil: 'domcontentloaded' });
    await enLaPagina(page, 'La empresa');

    await page.getByTestId('registro-lab-razon-social').fill('Laboratorio Andino S.R.L.');
    await chooseOption(page.getByLabel('Tipo de sociedad'), 'S.R.L.');
    await page.getByTestId('registro-lab-nit').fill('1023456789');
    await continuar(page);

    await continuarHasta(page, 'Dónde está la central');
    await confirmarCentral(page, 'registro-lab');
    await continuarHasta(page, 'Representante legal');

    await escribirNombre(page, 'registro-lab-representante', 'Mariana', 'Siles');
    await page.getByTestId('registro-lab-representante-documento').fill('4567890');
    // The notarised power is required for every organisation (owner, 05/11/2026).
    await subir(page, 'registro-lab-doc-powerOfAttorneyFileId', 'powerOfAttorneyFileId');
    await expect(page.getByTestId('registro-lab-doc-powerOfAttorneyFileId-quitar')).toBeVisible({
      timeout: 15_000,
    });
    await continuarHasta(page, 'Su acceso');

    await page.getByTestId('registro-lab-representante-correo').fill(`legal-${Date.now()}@lab-andino.test`);

    await page.getByTestId('registro-lab-password').fill('secreto12');
    await page.getByTestId('registro-lab-password-confirm').fill('secreto12');
    await continuar(page);

    await expect(page.getByTestId('registro-lab-exito')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('registro-lab-error')).toHaveCount(0);
    await page.getByTestId('registro-lab-ir-login').click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('imagenología: modalidades y los papeles obligatorios alcanzan para terminar el alta', async ({
    page,
  }) => {
    await page.goto('/auth/register/imaging-center', { waitUntil: 'domcontentloaded' });
    await enLaPagina(page, 'La empresa');

    await page.getByTestId('registro-imagen-razon-social').fill('Imagen Oriente S.R.L.');
    await chooseOption(page.getByLabel('Tipo de sociedad'), 'S.R.L.');
    await page.getByTestId('registro-imagen-nit').fill('1023456789');
    await continuar(page);

    await enLaPagina(page, 'Qué estudios hace');
    // Se hace clic en el rótulo, como una persona: el `<input>` nativo va oculto
    // bajo el dibujo propio del checkbox.
    await page.getByTestId('registro-imagen-modalidades').getByText('Ecografía', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Ecografía' })).toBeChecked();
    await continuar(page);

    await enLaPagina(page, 'Los papeles de la empresa');
    for (const clave of ['seprecFile', 'licenciaFile', 'sedesFile', 'nitFile']) {
      await subir(page, `registro-imagen-adjunto-${clave}`, clave);
      await expect(page.getByTestId(`registro-imagen-quitar-${clave}`)).toBeVisible({ timeout: 15_000 });
    }
    await continuar(page);

    // An S.R.L. must attach its constitution (only a sole proprietorship has none).
    await enLaPagina(page, 'Constitución de la empresa');
    await subir(page, 'registro-imagen-adjunto-constitucionFile', 'constitucionFile');
    await expect(page.getByTestId('registro-imagen-quitar-constitucionFile')).toBeVisible({ timeout: 15_000 });
    await continuarHasta(page, 'Dónde está la central');

    await confirmarCentral(page, 'registro-imagen');
    await continuarHasta(page, 'Representante legal');

    await escribirNombre(page, 'registro-imagen-representante', 'Rodrigo', 'Vaca');
    await page.getByTestId('registro-imagen-representante-documento').fill('4567890');
    await subir(page, 'registro-imagen-adjunto-poderFile', 'poderFile');
    await expect(page.getByTestId('registro-imagen-quitar-poderFile')).toBeVisible({ timeout: 15_000 });
    await continuarHasta(page, 'Su acceso');

    await page
      .getByTestId('registro-imagen-representante-correo')
      .fill(`legal-${Date.now()}@imagen-oriente.test`);

    await page.getByTestId('registro-imagen-password').fill('secreto12');
    await page.getByTestId('registro-imagen-password-confirm').fill('secreto12');
    await continuar(page);

    await expect(page.getByTestId('registro-imagen-exito')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('registro-imagen-ir-login').click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});
