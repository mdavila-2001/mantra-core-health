import { expect, test, type Page } from '@playwright/test';

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

/**
 * Completa la primera página —lo único obligatorio del alta— y avanza.
 *
 * El motor valida de a una página, así que sin esto el «Siguiente» no mueve
 * nada y la prueba fallaría lejos de lo que quiere comprobar.
 */
async function empezarElAlta(page: Page): Promise<void> {
  await page.goto('/auth/register/patient');
  await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

  // Las dos primeras paginas son las unicas obligatorias del alta. El motor
  // valida de a una, asi que sin completarlas el «Siguiente» no mueve nada y la
  // prueba fallaria lejos de lo que quiere comprobar.
  await page.getByTestId('registro-documento').fill('9876543');
  await page.getByTestId('paginated-form-continuar').click();

  await page.getByTestId('registro-nombre').fill('Ana');
  await page.getByTestId('registro-apellido-paterno').fill('Paz');
  await page.getByTestId('paginated-form-continuar').click();
}

/** Avanza hasta la página cuyo titular se pasa, sin pasarse de largo. */
async function avanzarHasta(page: Page, titulo: string): Promise<void> {
  const encabezado = page.getByRole('heading', { name: titulo });
  for (let paso = 0; paso < 8; paso += 1) {
    if (await encabezado.isVisible().catch(() => false)) return;
    await page.getByTestId('paginated-form-continuar').click();
    await page.waitForTimeout(150);
  }
  await expect(encabezado).toBeVisible();
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

  });

  test('la página del trabajo pregunta la empresa, no dónde queda', async ({ page }) => {
    await empezarElAlta(page);
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

  });

  test('«Otra empresa» abre el campo para escribirla', async ({ page }) => {
    await empezarElAlta(page);
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

  });
});
