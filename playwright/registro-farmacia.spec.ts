import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { pdfDePrueba } from './helpers/documentos-legales';
import { centroDelPin, tocar } from './helpers/mapa';

/**
 * Carril A · registro público de farmacia (`/auth/register/pharmacy`),
 * Módulo Farmacia §1 del registro de procesos — 2026-09-29.
 *
 * ## Qué demuestra y qué no
 *
 * Comportamiento en el navegador contra el backend simulado
 * (`mock-backend.interceptor`, `environment.mockBackend`): la tarjeta
 * «Farmacia» en `/auth/register`, que lo obligatorio de D2 (razón social,
 * tipo de sociedad, NIT, dirección de la central, nombre y correo del
 * representante, correo de acceso y contraseña) alcanza para terminar el
 * alta, que los seis papeles/el mapa/las sucursales/las tres gerencias son
 * opcionales, y que el `POST` a `/iam/auth/register-organization` con
 * `tenantType: 'PHARMACY'` responde 201 → pantalla «¡Bienvenido a AloVida!».
 *
 * El mock corre dentro de la cadena de interceptores de Angular: no hay una
 * petición HTTP real que Playwright pueda observar. Que el cuerpo exacto
 * lleva `tenantType: 'PHARMACY'`, sin claves opcionales vacías, lo fija
 * `register-pharmacy.spec.ts` (con `HttpTestingController`) — misma
 * convención que el resto de esta suite (ver `carril-registro-aseguradora.spec.ts`).
 */

/** Las organizaciones se eligen aparte de las cuentas de persona (03/10/2026). */
const RUTA_TIPOS = '/auth/register/organization-type';
const RUTA = '/auth/register/pharmacy';
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'registro-farmacia');

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled' });
}

async function abrirElAlta(page: Page): Promise<void> {
  await page.goto(RUTA, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.getByLabel('Tipo de sociedad')).toBeVisible({ timeout: 20_000 });
}

/** Página 1 «La empresa»: lo único que frena de verdad (razón social, tipo, NIT). */
async function completarLaEmpresa(page: Page, razonSocial = 'Farmacia San Martín S.R.L.'): Promise<void> {
  await page.getByTestId('registro-farmacia-razon-social').fill(razonSocial);
  await page.getByLabel('Tipo de sociedad').selectOption({ label: 'S.R.L.' });
  await page.getByTestId('registro-farmacia-nit').fill('1023456789');
  await page.getByTestId('paginated-form-continuar').click();
}

/** Salta los seis papeles (opcionales): dos páginas, «Continuar» sin adjuntar nada. */
async function saltarLosPapeles(page: Page): Promise<void> {
  await expect(page.locator('.paginated-form__titulo')).toContainText('Los papeles de la farmacia');
  await page.getByTestId('paginated-form-continuar').click();
  await expect(page.locator('.paginated-form__titulo')).toContainText('(2 de 2)');
  await page.getByTestId('paginated-form-continuar').click();
}

/** Página «Dónde está la central»: sólo la dirección, sin marcar el mapa. */
async function completarCentralSinMapa(page: Page): Promise<void> {
  await expect(page.locator('.paginated-form__titulo')).toContainText('Dónde está la central');
  await page.getByTestId('registro-farmacia-direccion').fill('Av. Cañoto esq. Ballivián 234');
  await page.getByTestId('paginated-form-continuar').click();
}

/** Página «Tus sucursales»: seguir de largo sin agregar ninguna. */
async function saltarSucursales(page: Page): Promise<void> {
  await expect(page.locator('.paginated-form__titulo')).toContainText('Tus sucursales');
  await page.getByTestId('paginated-form-continuar').click();
}

/**
 * Escribe un nombre desglosado (`app-campos-de-nombre`): primer nombre y
 * apellido paterno, que son las dos partes obligatorias desde e1acc37a.
 */
async function escribirNombre(page: Page, prefijo: string, nombre: string, apellido: string): Promise<void> {
  await page.getByTestId(`${prefijo}-nombre`).fill(nombre);
  await page.getByTestId(`${prefijo}-apellido-paterno`).fill(apellido);
}

/** Página «Representante legal»: nombre y correo, los dos obligatorios. */
async function completarRepresentante(
  page: Page,
  correo = 'legal@farmacia-sanmartin.test',
): Promise<void> {
  await expect(page.locator('.paginated-form__titulo')).toContainText('Representante legal');
  await escribirNombre(page, 'registro-farmacia-representante', 'Mariana', 'Siles');
  await page.getByTestId('registro-farmacia-representante-correo').fill(correo);
  await page.getByTestId('paginated-form-continuar').click();
}

/** Las tres páginas de gerencias (todas opcionales): seguir de largo. */
async function saltarGerencias(page: Page): Promise<void> {
  for (const titulo of ['Gerencia general', 'Gerencia comercial', 'Gerencia de marketing']) {
    await expect(page.locator('.paginated-form__titulo')).toContainText(titulo);
    await page.getByTestId('paginated-form-continuar').click();
  }
}

/** Página «Tu acceso»: la contraseña y el envío. */
async function completarAccesoYEnviar(page: Page): Promise<void> {
  await expect(page.locator('.paginated-form__titulo')).toContainText('Tu acceso');
  await page.getByTestId('registro-farmacia-password').fill('secreto12');
  await page.getByTestId('paginated-form-continuar').click();
}

test.describe('alta pública de farmacia (Módulo Farmacia §1)', () => {
  test.describe.configure({ mode: 'serial' });

  test('la tarjeta «Farmacia» está en «Registrá tu organización», junto a las otras tres', async ({ page }) => {
    await page.goto(RUTA_TIPOS, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });

    const tarjeta = page.getByTestId('tipo-farmacia');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText('Farmacia');
    await capturar(page, 'tipos-de-cuenta');

    await tarjeta.click();
    await expect(page).toHaveURL(new RegExp(`${RUTA}$`));
    await expect(page.getByLabel('Tipo de sociedad')).toBeVisible({ timeout: 20_000 });
  });

  test('ofrece las 8 figuras bolivianas del registro de procesos', async ({ page }) => {
    await abrirElAlta(page);

    const opciones = await page
      .getByLabel('Tipo de sociedad')
      .locator('option:not([hidden])')
      .allTextContents();

    expect(opciones.map((texto) => texto.trim())).toEqual([
      'Unipersonal',
      'S.R.L.',
      'Ltda.',
      'S.A.',
      'Sociedad colectiva',
      'Sociedad en comandita simple',
      'Sociedad en comandita por acciones',
      'Sucursal de sociedad extranjera',
    ]);
    await capturar(page, 'paso-1-empresa');
  });

  test('sin razón social ni tipo de sociedad, el paso no avanza y explica por qué', async ({ page }) => {
    await abrirElAlta(page);
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByText('Escribí el nombre o la razón social de la farmacia.')).toBeVisible();
    await expect(page.locator('.paginated-form__titulo')).toHaveText('La empresa');
  });

  test('kill-test mínimo: sólo lo obligatorio de D2 alcanza para terminar el alta', async ({ page }) => {
    await abrirElAlta(page);
    await completarLaEmpresa(page, 'Farmacia Mínima S.R.L.');
    await saltarLosPapeles(page);
    await completarCentralSinMapa(page);
    await saltarSucursales(page);
    await completarRepresentante(page, 'legal@farmacia-minima.test');
    await saltarGerencias(page);
    await completarAccesoYEnviar(page);

    await expect(page.getByTestId('registro-farmacia-exito')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Ya podés conectarte con el correo del representante legal')).toBeVisible();
    await capturar(page, 'exito-minimo');

    await page.getByTestId('registro-farmacia-ir-login').click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('un correo ya usado en la plataforma se muestra en pantalla, no en consola', async ({ page }) => {
    await abrirElAlta(page);
    await completarLaEmpresa(page, 'Farmacia Correo Repetido S.R.L.');
    await saltarLosPapeles(page);
    await completarCentralSinMapa(page);
    await saltarSucursales(page);
    // La cuenta de demostración del paciente ya existe en el simulador.
    await completarRepresentante(page, 'paciente@alovida.mock');
    await saltarGerencias(page);
    await completarAccesoYEnviar(page);

    await expect(page.getByTestId('registro-farmacia-error')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('registro-farmacia-error')).toContainText('correo');
    await expect(page.getByTestId('registro-farmacia-exito')).toHaveCount(0);
    await capturar(page, 'error-correo-repetido');
  });

  test('kill-test completo: los seis papeles, el mapa de la central, una sucursal y las tres gerencias viajan juntos', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -17.7833, longitude: -63.1821 });

    await abrirElAlta(page);
    await completarLaEmpresa(page, 'Farmacia Completa S.R.L.');

    // Los seis papeles, en dos páginas de 4 y 2.
    await expect(page.locator('.paginated-form__titulo')).toContainText('Los papeles de la farmacia');
    for (const clave of [
      'constitutionFileId',
      'taxIdentifierFileId',
      'commerceRegistryFileId',
      'operatingLicenseFileId',
    ] as const) {
      await page.getByTestId(`registro-farmacia-doc-${clave}`).setInputFiles(pdfDePrueba(clave));
      await expect(page.getByTestId(`registro-farmacia-doc-${clave}-quitar`)).toBeVisible({
        timeout: 15_000,
      });
    }
    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.locator('.paginated-form__titulo')).toContainText('(2 de 2)');
    // El poder ya no va acá: viaja con quien lo firma, en «Representante legal».
    await page
      .getByTestId('registro-farmacia-doc-healthAuthorityCertificateFileId')
      .setInputFiles(pdfDePrueba('healthAuthorityCertificateFileId'));
    await expect(
      page.getByTestId('registro-farmacia-doc-healthAuthorityCertificateFileId-quitar'),
    ).toBeVisible({ timeout: 15_000 });
    await capturar(page, 'papeles-completos');
    await page.getByTestId('paginated-form-continuar').click();

    // La central, con GPS.
    await expect(page.locator('.paginated-form__titulo')).toContainText('Dónde está la central');
    await page.getByTestId('registro-farmacia-direccion').fill('Av. Cañoto esq. Ballivián 234');
    await page.getByTestId('registro-farmacia-central-location-use').click();
    const mapaCentral = page.getByTestId('registro-farmacia-central-map');
    await expect(mapaCentral.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('registro-farmacia-central-location-confirm').click();
    await expect(page.getByTestId('registro-farmacia-central-location-confirmed')).toBeVisible();
    await capturar(page, 'central-confirmada');
    await page.getByTestId('paginated-form-continuar').click();

    // Una sucursal, con su propio mapa.
    await expect(page.locator('.paginated-form__titulo')).toContainText('Tus sucursales');
    await page.getByTestId('registro-farmacia-agregar-sucursal').click();
    await page.getByTestId('registro-farmacia-sucursal-1-nombre').fill('Sucursal Equipetrol');
    await page.getByTestId('registro-farmacia-sucursal-1-direccion').fill('Av. San Martín 456');
    const mapaSucursal = page.getByTestId('registro-farmacia-sucursal-1-map');
    await page.getByTestId('registro-farmacia-sucursal-1-location-pick').click();
    await expect(mapaSucursal).toBeVisible();
    await tocar(page, mapaSucursal, -30, -10);
    await centroDelPin(mapaSucursal);
    await page.getByTestId('registro-farmacia-sucursal-1-location-confirm').click();
    await expect(page.getByTestId('registro-farmacia-sucursal-1-location-confirmed')).toBeVisible();
    await capturar(page, 'sucursal-agregada');
    await page.getByTestId('paginated-form-continuar').click();

    // El representante, con su poder notarial: el sexto papel.
    await expect(page.locator('.paginated-form__titulo')).toContainText('Representante legal');
    await escribirNombre(page, 'registro-farmacia-representante', 'Mariana', 'Siles');
    await page.getByTestId('registro-farmacia-representante-correo').fill('legal@farmacia-completa.test');
    await page
      .getByTestId('registro-farmacia-doc-powerOfAttorneyFileId')
      .setInputFiles(pdfDePrueba('powerOfAttorneyFileId'));
    await expect(page.getByTestId('registro-farmacia-doc-powerOfAttorneyFileId-quitar')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('paginated-form-continuar').click();

    // Las tres gerencias, completas.
    for (const [titulo, prefijo] of [
      ['Gerencia general', 'registro-farmacia-gerente-general'],
      ['Gerencia comercial', 'registro-farmacia-gerente-comercial'],
      ['Gerencia de marketing', 'registro-farmacia-gerente-marketing'],
    ] as const) {
      await expect(page.locator('.paginated-form__titulo')).toContainText(titulo);
      await escribirNombre(page, prefijo, titulo, 'de prueba');
      await page.getByTestId(`${prefijo}-celular`).fill('70012345');
      await page.getByTestId(`${prefijo}-correo`).fill(`${prefijo}@farmacia-completa.test`);
      await page.getByTestId('paginated-form-continuar').click();
    }

    await completarAccesoYEnviar(page);

    await expect(page.getByTestId('registro-farmacia-exito')).toBeVisible({ timeout: 20_000 });
    await capturar(page, 'exito-completo');
  });

  test('el primer paso no se desborda en teléfono, tablet ni escritorio', async ({ page }) => {
    await abrirElAlta(page);
    await completarLaEmpresa(page, 'Farmacia Responsive S.R.L.');
    await saltarLosPapeles(page);

    for (const [nombre, tamano] of [
      ['movil-375x812', { width: 375, height: 812 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
    ] as const) {
      await page.setViewportSize(tamano);
      await expect(page.locator('.paginated-form__titulo')).toContainText('Dónde está la central');

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, `responsive-central-${nombre}`);
    }
  });

  test('la pantalla se ve completa en modo oscuro, sin desborde', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirElAlta(page);

    await expect(page.locator('html[data-theme="dark"], html:not([data-theme="light"])')).toBeVisible();
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborde).toBe(false);
    await capturar(page, 'paso-1-oscuro-1440');

    await completarLaEmpresa(page, 'Farmacia Oscura S.R.L.');
    await saltarLosPapeles(page);
    await completarCentralSinMapa(page);
    await saltarSucursales(page);
    await completarRepresentante(page, 'legal@farmacia-oscura.test');
    await saltarGerencias(page);
    await completarAccesoYEnviar(page);

    await expect(page.getByTestId('registro-farmacia-exito')).toBeVisible({ timeout: 20_000 });
    await capturar(page, 'exito-oscuro-1440');
  });
});
