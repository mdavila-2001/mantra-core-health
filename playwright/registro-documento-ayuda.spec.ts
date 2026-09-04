import { expect, test, type Page } from '@playwright/test';

/**
 * El alta pública, en lo que se ve: el carnet con su expedición en un solo
 * renglón, y la columna que explica por qué se pide cada cosa.
 *
 * ## Por qué es una prueba de navegador y no unitaria
 *
 * Porque lo que se afirma es **geometría**. Que dos campos compartan renglón no
 * se puede comprobar leyendo la declaración del formulario: depende de la
 * rejilla, del corte por ancho y de que la clase llegue al elemento correcto.
 * Una unitaria diría «el campo declara `ancho: 'mitad'`», que es exactamente lo
 * que ya se ve en el código y no lo que la persona ve en pantalla.
 *
 * Las dos altas —paciente y profesional— comparten la afirmación, así que
 * comparten el cuerpo de la prueba: el número de documento y su departamento de
 * emisión, arriba a la misma altura y uno al lado del otro.
 */

/** Misma altura de la caja: la tolerancia absorbe el redondeo del navegador. */
const TOLERANCIA_PX = 4;

/**
 * El renglón del documento, comprobado sobre las cajas reales.
 *
 * `top` igual y `x` distinto es exactamente «en la misma línea, uno al lado del
 * otro», y es lo que se rompería si alguien quitara el `ancho: 'mitad'` o
 * cambiara la rejilla del motor.
 */
async function documentoYExpedicionEnLaMismaLinea(
  page: Page,
  documento: string,
  expedicion: string,
): Promise<void> {
  // La caja que se compara es la del CAMPO entero —rótulo, control y pista—,
  // no la del `<input>`: el número de documento es un input nativo y la
  // expedición un desplegable propio, y sus cajas internas están recortadas de
  // maneras distintas. Lo que tiene que compartir renglón es el campo.
  const campo = (testId: string) => page.locator(`app-form-field:has([data-testid="${testId}"])`);

  const cajaDocumento = await campo(documento).boundingBox();
  const cajaExpedicion = await campo(expedicion).boundingBox();

  expect(cajaDocumento, 'el campo del documento tiene que estar en pantalla').not.toBeNull();
  expect(cajaExpedicion, 'el departamento de emisión tiene que estar en pantalla').not.toBeNull();

  expect(Math.abs(cajaDocumento!.y - cajaExpedicion!.y)).toBeLessThanOrEqual(TOLERANCIA_PX);
  expect(cajaExpedicion!.x).toBeGreaterThan(cajaDocumento!.x + cajaDocumento!.width - 1);
}

test.describe('alta pública — el documento y su expedición', () => {
  test('paciente: el carnet y su departamento de emisión comparten renglón', async ({ page }) => {
    await page.goto('/auth/register/patient');
    await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

    // La cédula del paciente está en la segunda página («Tu documento de
    // identidad»): la primera es el nombre, y hay que contestarla para llegar.
    await page.getByTestId('registro-nombre').fill('Ana');
    await page.getByTestId('registro-apellido-paterno').fill('Paz');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-documento')).toBeVisible();
    await documentoYExpedicionEnLaMismaLinea(
      page,
      'registro-documento',
      'registro-departamento-ci',
    );

    await page.screenshot({
      path: 'artifacts/playwright/registro-paciente-documento.png',
      fullPage: true,
    });
  });

  test('profesional: el carnet y su departamento de emisión comparten renglón', async ({
    page,
  }) => {
    await page.goto('/auth/register/practitioner');
    await expect(page.getByTestId('registro-form-profesional')).toBeVisible();

    // La cédula del profesional está en la segunda página («Tus datos»): la
    // primera es el nombre, y hay que contestarla para llegar.
    await page.getByTestId('registro-pro-nombre').fill('Ana');
    await page.getByTestId('registro-pro-apellido-paterno').fill('Rojas');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-pro-documento')).toBeVisible();
    await documentoYExpedicionEnLaMismaLinea(
      page,
      'registro-pro-documento',
      'registro-pro-departamento-ci',
    );

    await page.screenshot({
      path: 'artifacts/playwright/registro-profesional-documento.png',
      fullPage: true,
    });
  });
});

test.describe('alta pública — por qué te pedimos esto', () => {
  test('la columna acompaña al paso y el sello de privacidad no se va nunca', async ({ page }) => {
    await page.goto('/auth/register/patient');
    await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

    const ayuda = page.getByRole('complementary', {
      name: /Por qué te pedimos estos datos/i,
    });
    await expect(ayuda).toBeVisible();

    // Paso 1: el nombre. La explicación habla del nombre.
    await expect(ayuda.getByText('Tu nombre, como figura en tu documento')).toBeVisible();
    await expect(ayuda.getByText('Tus datos están a salvo')).toBeVisible();

    // Paso 2: el documento. La explicación cambió con la pregunta.
    await page.getByTestId('registro-nombre').fill('Ana');
    await page.getByTestId('registro-apellido-paterno').fill('Paz');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(ayuda.getByText('Con tu documento vas a entrar')).toBeVisible();
    await expect(ayuda.getByText('Tu nombre, como figura en tu documento')).toHaveCount(0);
    // El sello sigue: la promesa no depende de qué se esté contestando.
    await expect(ayuda.getByText('Tus datos están a salvo')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/playwright/registro-ayuda-lateral.png',
      fullPage: true,
    });
  });

  test('en teléfono la ayuda sigue estando, debajo del formulario', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auth/register/patient');
    await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

    const ayuda = page.getByRole('complementary', {
      name: /Por qué te pedimos estos datos/i,
    });
    const cajaAyuda = await ayuda.boundingBox();
    const cajaFormulario = await page.getByTestId('registro-form-paciente').boundingBox();

    expect(cajaAyuda).not.toBeNull();
    expect(cajaFormulario).not.toBeNull();
    // Debajo, no encima: quien abre la pantalla viene a registrarse.
    expect(cajaAyuda!.y).toBeGreaterThan(cajaFormulario!.y);

    await page.screenshot({
      path: 'artifacts/playwright/registro-ayuda-telefono.png',
      fullPage: true,
    });
  });
});
