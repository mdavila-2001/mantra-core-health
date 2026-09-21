import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { subirLosCincoDocumentos } from './helpers/documentos-legales';
import { centroDelPin, tocar } from './helpers/mapa';
import { completarCuentaDelOwner } from './helpers/owner';
import { completarGerencias, completarRepresentanteLegal } from './helpers/representante-legal';

/**
 * Subtarea 1.3 · casa matriz georreferenciada del autorregistro de
 * aseguradora (`/auth/register/organization`).
 *
 * ## Qué demuestra y qué no
 *
 * Comportamiento en el navegador contra el backend simulado
 * (`mock-backend.interceptor`): las dos puertas del selector de ubicación
 * (GPS del navegador y marcado manual sobre Leaflet), que el pin se puede
 * confirmar y quitar, y que la casa matriz es opcional — el alta se completa
 * igual sin ella. El mock corre dentro de Angular, sin red observable, así
 * que no prueba que la API real acepte `payer.latitude`; eso lo cubre
 * `organization-headquarters-location.int-spec.ts` contra Neon. La forma
 * exacta del cuerpo la fija `register-organization.spec.ts`
 * (`HttpTestingController`).
 */

const RUTA = '/auth/register/organization';
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'registro-aseguradora-gps');

/** La Plaza 24 de Septiembre, Santa Cruz: un punto real, y de los que se reconocen. */
const PUNTO_DE_PRUEBA = { latitude: -17.7833, longitude: -63.1821 };

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

/** Completa el primer paso (subtarea 1.1 + códigos desde la sigla) y llega a «Datos de la aseguradora». */
async function llegarADatosDeAseguradora(page: Page): Promise<void> {
  await page.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
  await page.getByTestId('registro-organizacion-sigla').fill('ANDINA');
  await page
    .getByLabel('Tipo societario')
    .selectOption({ label: 'S.R.L. · Sociedad de Responsabilidad Limitada' });
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toHaveText('Datos de la aseguradora');
}

/** Completa NIT y dirección: lo mínimo para poder avanzar de «Datos de la aseguradora». */
async function completarDatosObligatorios(page: Page): Promise<void> {
  await page.getByTestId('registro-organizacion-nit').fill('NIT-123456');
  await page.getByTestId('registro-organizacion-direccion').fill('Av. Siempre Viva 123');
}

test.describe('alta pública de aseguradora — casa matriz georreferenciada (subtarea 1.3)', () => {
  test.describe.configure({ mode: 'serial' });

  test('la sección trae las dos puertas del selector, sin mapa todavía', async ({ page }) => {
    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);

    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-use'),
    ).toBeVisible();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-pick'),
    ).toBeVisible();
    await expect(page.getByTestId('registro-organizacion-casa-matriz-map')).toHaveCount(0);

    await capturar(page, 'dos-puertas');
  });

  test('con el GPS concedido, el pin aparece y se puede confirmar', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(PUNTO_DE_PRUEBA);

    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);

    await page.getByTestId('registro-organizacion-casa-matriz-location-use').click();

    const mapa = page.getByTestId('registro-organizacion-casa-matriz-map');
    await expect(mapa).toBeVisible();
    await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-unconfirmed'),
    ).toBeVisible();
    await capturar(page, 'gps-pin-sin-confirmar');

    await page.getByTestId('registro-organizacion-casa-matriz-location-confirm').click();

    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-confirmed'),
    ).toBeVisible();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-geocoding-notice'),
    ).toBeVisible();
    await capturar(page, 'gps-confirmado');
  });

  test('marcado manual: tocar el mapa pone el pin, y un segundo toque lo corre sin duplicarlo', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);

    await page.getByTestId('registro-organizacion-casa-matriz-location-pick').click();

    const mapa = page.getByTestId('registro-organizacion-casa-matriz-map');
    await expect(mapa).toBeVisible();
    await expect(mapa.locator('.leaflet-marker-icon')).toHaveCount(0);
    await expect(mapa.locator('.mapa--seleccionable')).toHaveCount(1);
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-pick-indicacion'),
    ).toBeVisible();
    await capturar(page, 'marcado-manual-mapa-vacio');

    await tocar(page, mapa, -40, -20);
    const primerPin = await centroDelPin(mapa);
    await expect(mapa.locator('.leaflet-marker-icon')).toHaveCount(1);
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-unconfirmed'),
    ).toBeVisible();
    await capturar(page, 'marcado-manual-pin-puesto');

    // El mapa recentra en zoom 17 sobre el primer pin: un segundo toque
    // desplazado lo corre, sin sumar un segundo marcador.
    await tocar(page, mapa, 90, 40);
    await expect(mapa.locator('.leaflet-marker-icon')).toHaveCount(1);
    await expect
      .poll(async () => (await centroDelPin(mapa)).x, { timeout: 10_000 })
      .not.toBe(primerPin.x);

    await page.getByTestId('registro-organizacion-casa-matriz-location-confirm').click();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-confirmed'),
    ).toBeVisible();
    await capturar(page, 'marcado-manual-confirmado');
  });

  test('quitar la ubicación vuelve al estado inicial', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(PUNTO_DE_PRUEBA);

    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);

    await page.getByTestId('registro-organizacion-casa-matriz-location-use').click();
    await page.getByTestId('registro-organizacion-casa-matriz-location-confirm').click();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-confirmed'),
    ).toBeVisible();

    await page.getByTestId('registro-organizacion-casa-matriz-location-remove').click();

    await expect(page.getByTestId('registro-organizacion-casa-matriz-map')).toHaveCount(0);
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-use'),
    ).toBeVisible();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-pick'),
    ).toBeVisible();
  });

  test('la casa matriz es opcional: el alta se completa igual sin confirmarla', async ({
    page,
  }) => {
    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);
    await completarDatosObligatorios(page);
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Documentación legal obligatoria (PDF)',
    );
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
    await completarCuentaDelOwner(page, { email: 'sin-casa-matriz@andina.test' });

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
  });

  test('con la casa matriz confirmada, el alta llega igual a la confirmación', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(PUNTO_DE_PRUEBA);

    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);
    await completarDatosObligatorios(page);

    await page.getByTestId('registro-organizacion-casa-matriz-location-use').click();
    const mapa = page.getByTestId('registro-organizacion-casa-matriz-map');
    await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('registro-organizacion-casa-matriz-location-confirm').click();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-confirmed'),
    ).toBeVisible();

    await page.getByTestId('paginated-form-continuar').click();
    await expect(page.locator('.paginated-form__titulo')).toContainText(
      'Documentación legal obligatoria (PDF)',
    );
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
    await completarCuentaDelOwner(page, { email: 'con-casa-matriz@andina.test' });

    await expect(page.getByTestId('registro-organizacion-exito')).toBeVisible({ timeout: 20_000 });
    await capturar(page, 'exito-con-casa-matriz');
  });

  test('el mapa confirmado no se desborda en teléfono ni en tablet', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(PUNTO_DE_PRUEBA);

    await abrirElAlta(page);
    await llegarADatosDeAseguradora(page);
    await page.getByTestId('registro-organizacion-casa-matriz-location-use').click();
    const mapa = page.getByTestId('registro-organizacion-casa-matriz-map');
    await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('registro-organizacion-casa-matriz-location-confirm').click();
    await expect(
      page.getByTestId('registro-organizacion-casa-matriz-location-confirmed'),
    ).toBeVisible();

    for (const [nombre, tamano] of [
      ['movil-390x844', { width: 390, height: 844 }],
      ['tablet-768x1024', { width: 768, height: 1024 }],
      ['escritorio-1440x900', { width: 1440, height: 900 }],
    ] as const) {
      await page.setViewportSize(tamano);
      await expect(
        page.getByTestId('registro-organizacion-casa-matriz-location-confirmed'),
      ).toBeVisible();

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, `responsive-${nombre}`);
    }
  });
});
