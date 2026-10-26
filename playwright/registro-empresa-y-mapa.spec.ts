import { expect, test, type Page } from '@playwright/test';
import {
  PASOS_DEL_ALTA,
  completarContacto,
  empezarElAlta,
  elegirLocalidadDeResidencia,
  elegirLocalidadDeTrabajo,
  valorDelSelect,
} from './support/registro-paciente';

/**
 * Los dos cambios del alta pública, comprobados donde se ven.
 *
 * 1. El paso del trabajo pregunta la empresa —con una lupa y con «Otra
 *    empresa» para quien no está en la lista— y, en el mismo paso, dónde
 *    queda, con el mismo mapa que la residencia.
 * 2. La ubicación del domicilio **ya no se muestra como par de coordenadas**:
 *    aparece un mapa con el pin y un botón que dice «Confirmar dirección
 *    actual».
 *
 * ## Por qué es una prueba de navegador y no unitaria
 *
 * Porque lo que se afirma es lo que la persona ve, y las dos cosas dependen de
 * piezas que sólo existen en un navegador real: el permiso de geolocalización
 * —que Playwright concede por contexto— y Leaflet, que se carga en un chunk
 * aparte y monta su lienzo después del primer render. Una unitaria diría «el
 * componente tiene un signal con el punto», que es justo lo que ya se lee en el
 * código y no lo que hay en pantalla.
 */

/** La Plaza 24 de Septiembre, Santa Cruz: un punto real, y de los que se reconocen. */
const PUNTO_DE_PRUEBA = { latitude: -17.7833, longitude: -63.1821 };

/** Del primer paso hasta «Empresa y lugar de trabajo», con lo mínimo obligatorio. */
async function llegarAlTrabajo(page: Page): Promise<void> {
  await empezarElAlta(page);
  await elegirLocalidadDeResidencia(page);
  await page.getByTestId('paginated-form-continuar').click();
  await completarContacto(page);
}

test.describe('alta pública — la empresa y el mapa', () => {
  test.describe.configure({ mode: 'serial' });

  test('el domicilio se confirma sobre un mapa, sin números de latitud ni longitud', async ({
    page,
    context,
  }) => {
    // El permiso va concedido de antemano: el diálogo del navegador bloquearía
    // la prueba, y lo que se comprueba es lo que pasa DESPUÉS de concederlo.
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(PUNTO_DE_PRUEBA);

    await empezarElAlta(page);
    await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.residencia })).toBeVisible();

    // Con el mapa primero, el mapa de Bolivia está desde el comienzo y el
    // formulario todavía no.
    await expect(page.getByTestId('registration-residence-mapa')).toBeVisible();
    await expect(page.getByTestId('registration-residence-formulario')).toHaveCount(0);
    await page.getByTestId('registration-residence-usar-ubicacion').click();

    // El mapa, con su pin. `.leaflet-marker-icon` sólo existe si Leaflet montó.
    const mapa = page.getByTestId('registration-residence-mapa');
    await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });

    // Lo que se reemplazó: el par de coordenadas en pantalla. Ni el texto viejo
    // ni los números sueltos deben aparecer en ningún lado del campo.
    const bloque = page.getByTestId('registration-residence');
    await expect(bloque).not.toContainText('Ubicación guardada');
    await expect(bloque).not.toContainText('-17,7833');
    await expect(bloque).not.toContainText('-17.7833');

    // El formulario sale lleno con lo que el punto dice, y ya no hay un botón
    // de «Confirmar dirección actual»: tocar el mapa es confirmar.
    await expect(page.getByTestId('registration-residence-formulario')).toBeVisible();
    await expect(page.getByTestId('registro-confirmar-direccion')).toHaveCount(0);

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-domicilio-confirmado.png',
      fullPage: true,
    });
  });

  test('el paso del trabajo pregunta la empresa y dónde queda', async ({ page }) => {
    await llegarAlTrabajo(page);

    // Dónde queda: el mismo bloque que la residencia, con el mapa primero; la
    // calle aparece con el formulario.
    await expect(page.getByTestId('registration-work-mapa')).toBeVisible();
    await page.getByTestId('registration-work-a-mano').click();
    await expect(page.getByTestId('registration-work-address')).toBeVisible();

    // La empresa, con su lupa.
    const empresa = page.getByTestId('registro-empresa');
    await expect(empresa).toBeVisible();

    // El catálogo viene del seed `VS_BO_EMPLOYER`: si no estuviera sembrado, la
    // lupa no ofrecería nada y esto fallaría acá, que es donde corresponde.
    await empresa.getByRole('combobox').fill('Entel');
    await expect(page.getByRole('option', { name: /Entel/ }).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-empresa-lupa.png',
      fullPage: true,
    });
  });

  test('«Otra empresa» abre el campo para escribirla', async ({ page }) => {
    await llegarAlTrabajo(page);

    // Mientras no se elija la salida, el campo del nombre a mano no existe: no
    // está escondido con CSS, no está en la página.
    await expect(page.getByTestId('registro-empresa-otra')).toHaveCount(0);

    const empresa = page.getByTestId('registro-empresa');
    await empresa.getByRole('combobox').fill('Otra');
    await page.getByRole('option', { name: /Otra empresa/ }).first().click();

    const aMano = page.getByTestId('registro-empresa-otra');
    await expect(aMano).toBeVisible();
    await aMano.fill('Ferretería San Martín');

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-empresa-otra.png',
      fullPage: true,
    });
  });

  /**
   * FT-03-R07 / AG49-FT03-007: la localidad de TRABAJO se elige con el mismo
   * mapa de Bolivia que la de residencia (departamento + ciudad acotada),
   * simétrico a `elegirLocalidadDeResidencia()`. Va en el mismo paso que la
   * empresa («Empresa y lugar de trabajo»).
   */
  test('el lugar de trabajo se elige con el mismo mapa que la residencia', async ({ page }) => {
    await llegarAlTrabajo(page);

    // Antes de elegir el departamento no hay select de ciudad: igual que en
    // residencia, es un mismo dato con dos formas de llegar a él.
    await expect(page.getByTestId('registration-work-municipio')).toHaveCount(0);

    await elegirLocalidadDeTrabajo(page);

    await expect(valorDelSelect(page, 'registration-work-municipio')).not.toHaveClass(
      /is-placeholder/,
    );

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-lugar-de-trabajo.png',
      fullPage: true,
    });
  });
});
