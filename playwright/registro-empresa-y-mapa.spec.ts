import { expect, test } from '@playwright/test';
import {
  empezarElAlta,
  avanzarHasta,
  elegirLocalidadDeResidencia,
  elegirLocalidadDeTrabajo,
} from './support/registro-paciente';

/**
 * Los dos cambios del alta pública, comprobados donde se ven.
 *
 * 1. La página del trabajo **ya no pregunta dónde queda**: pregunta la empresa,
 *    con una lupa y con «Otra empresa» para quien no está en la lista.
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
    await avanzarHasta(page, '¿Dónde vivís?');

    // Antes de pedirla no hay mapa: sólo la invitación.
    await expect(page.getByTestId('registro-mapa-domicilio')).toHaveCount(0);
    await page.getByTestId('registro-usar-ubicacion').click();

    // El mapa, con su pin. `.mapa__lienzo` es el elemento que monta Leaflet:
    // si estuviera visible pero sin montar, el pin no existiría.
    const mapa = page.getByTestId('registro-mapa-domicilio');
    await expect(mapa).toBeVisible();
    await expect(mapa.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 15_000 });

    // Lo que se reemplazó: el par de coordenadas en pantalla. Ni el texto viejo
    // ni los números sueltos deben aparecer en ningún lado del campo.
    const bloque = page.locator('.registro__ubicacion');
    await expect(bloque).not.toContainText('Ubicación guardada');
    await expect(bloque).not.toContainText('-17,7833');
    await expect(bloque).not.toContainText('-17.7833');

    // Y el botón que pidió el cliente, con ese nombre.
    const confirmar = page.getByTestId('registro-confirmar-direccion');
    await expect(confirmar).toBeVisible();
    await expect(confirmar).toHaveText(/Confirmar dirección actual/);

    await confirmar.click();
    await expect(page.getByTestId('registro-direccion-confirmada')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-domicilio-confirmado.png',
      fullPage: true,
    });
  });

  test('la página del trabajo pregunta la empresa, no dónde queda', async ({ page }) => {
    await empezarElAlta(page);
    await elegirLocalidadDeResidencia(page);
    await avanzarHasta(page, '¿Dónde trabajás?');

    // Lo que ya no se pregunta: ni el municipio del trabajo ni su calle.
    await expect(page.getByTestId('registro-municipio-trabajo')).toHaveCount(0);
    await expect(page.getByTestId('registro-trabajo-calle')).toHaveCount(0);

    // Lo que sí: la empresa, con su lupa.
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
    await empezarElAlta(page);
    await elegirLocalidadDeResidencia(page);
    await avanzarHasta(page, '¿Dónde trabajás?');

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
   * simétrico a `elegirLocalidadDeResidencia()`. Es su propia página («El
   * lugar donde trabajás»), separada de la empresa.
   */
  test('el lugar de trabajo se elige con el mismo mapa que la residencia', async ({ page }) => {
    await empezarElAlta(page);
    await elegirLocalidadDeResidencia(page);
    await avanzarHasta(page, 'El lugar donde trabajás');

    // Antes de elegir el departamento no hay select de ciudad: igual que en
    // residencia, es un mismo dato con dos formas de llegar a él.
    await expect(page.getByTestId('registration-work-municipio')).toHaveCount(0);

    await elegirLocalidadDeTrabajo(page);

    const municipio = page.getByTestId('registration-work-municipio').locator('select');
    await expect(municipio).not.toHaveValue('');

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-lugar-de-trabajo.png',
      fullPage: true,
    });
  });
});
