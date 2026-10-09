import { expect, test, type Page } from '@playwright/test';

import { pdfDePrueba } from './helpers/documentos-legales';
import { avanzarHasta, elegirLocalidadDeResidencia, empezarElAlta } from './support/registro-paciente';

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

/** Nombre desglosado (`app-name-fields`): las dos partes obligatorias. */
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

test.describe('altas públicas sin cobertura previa: paciente, laboratorio, imagenología', () => {
  /**
   * Regresión del 03/10/2026: con el campo vacío, la plantilla `DD/MM/AAAA`
   * ocupa sólo la izquierda del input y un clic en cualquier otro punto dejaba
   * el cursor en el año. Tecleado `01011990`, el campo quedaba en
   * `DD/MM/0101`, inválido, y el alta no pasaba del paso 3.
   */
  test('paciente: la fecha de nacimiento se escribe tecleando, sin abrir el calendario', async ({ page }) => {
    await page.goto('/auth/register/patient');
    await page.getByTestId('registro-nombre').fill('Ana');
    await page.getByTestId('registro-apellido-paterno').fill('Paz');
    await continuar(page);
    await page.getByTestId('registro-documento').fill('9876543');
    await page.getByTestId('registro-departamento-ci').locator('select').selectOption({ index: 1 });
    await continuar(page);
    await enLaPagina(page, 'Cuéntenos un poco sobre usted');

    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    await fecha.click();
    await page.keyboard.type('01011990', { delay: 150 });
    await expect(fecha).toHaveValue('01/01/1990');
  });

  test('paciente: lo obligatorio alcanza para crear la cuenta', async ({ page }) => {
    await empezarElAlta(page, `CI-ALTA-${Date.now()}`);

    await avanzarHasta(page, '¿Dónde vive?');
    await elegirLocalidadDeResidencia(page);
    await continuarHasta(page, 'Su acceso');

    await page.getByTestId('registro-correo').fill(`paciente-${Date.now()}@alovida.test`);
    await page.getByTestId('registro-password').fill('Alta-Paciente1!');
    await continuarHasta(page, 'Datos de facturación');

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
    await page.getByLabel('Tipo de sociedad').selectOption({ label: 'S.R.L.' });
    await page.getByTestId('registro-lab-nit').fill('1023456789');
    await continuar(page);

    await continuarHasta(page, 'Dónde está la central');
    await page.getByTestId('registro-lab-direccion').fill('Av. Cañoto esq. Ballivián 234');
    await continuarHasta(page, 'Representante legal');

    await escribirNombre(page, 'registro-lab-representante', 'Mariana', 'Siles');
    await page.getByTestId('registro-lab-representante-correo').fill(`legal-${Date.now()}@lab-andino.test`);
    await continuarHasta(page, 'Su acceso');

    await page.getByTestId('registro-lab-password').fill('secreto12');
    await continuar(page);

    await expect(page.getByTestId('registro-lab-exito')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('registro-lab-error')).toHaveCount(0);
    await page.getByTestId('registro-lab-ir-login').click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('imagenología: modalidades y los tres papeles obligatorios alcanzan para terminar el alta', async ({
    page,
  }) => {
    await page.goto('/auth/register/imaging-center', { waitUntil: 'domcontentloaded' });
    await enLaPagina(page, 'La empresa');

    await page.getByTestId('registro-imagen-razon-social').fill('Imagen Oriente S.R.L.');
    await page.getByLabel('Tipo de sociedad').selectOption({ label: 'S.R.L.' });
    await page.getByTestId('registro-imagen-nit').fill('1023456789');
    await continuar(page);

    await enLaPagina(page, 'Qué estudios hace');
    // Se hace clic en el rótulo, como una persona: el `<input>` nativo va oculto
    // bajo el dibujo propio del checkbox.
    await page.getByTestId('registro-imagen-modalidades').getByText('Ecografía', { exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Ecografía' })).toBeChecked();
    await continuar(page);

    await enLaPagina(page, 'Los papeles de la empresa');
    for (const clave of ['seprecFile', 'licenciaFile', 'sedesFile']) {
      await subir(page, `registro-imagen-adjunto-${clave}`, clave);
      await expect(page.getByTestId(`registro-imagen-quitar-${clave}`)).toBeVisible({ timeout: 15_000 });
    }
    await continuarHasta(page, 'Dónde está la central');

    await page.getByTestId('registro-imagen-direccion').fill('Calle Sucre 120');
    await continuarHasta(page, 'Representante legal');

    await escribirNombre(page, 'registro-imagen-representante', 'Rodrigo', 'Vaca');
    await page
      .getByTestId('registro-imagen-representante-correo')
      .fill(`legal-${Date.now()}@imagen-oriente.test`);
    await continuarHasta(page, 'Su acceso');

    await page.getByTestId('registro-imagen-password').fill('secreto12');
    await continuar(page);

    await expect(page.getByTestId('registro-imagen-exito')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('registro-imagen-ir-login').click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});
