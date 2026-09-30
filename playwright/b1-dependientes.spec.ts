import { expect, test, type Page } from '@playwright/test';

/**
 * B.1 · registrar un dependiente por CI, en el navegador.
 *
 * ## Por qué contra el backend simulado
 *
 * Porque la solicitud de vínculo todavía no existe en la API: la atiende el
 * simulador de `mockup`. La prueba no es sobre la API sino sobre lo que ven y
 * hacen las dos personas.
 *
 * ## Qué fija
 *
 * 1. El modal pide **sólo el CI**.
 * 2. Un CI sin cuenta se dice junto al campo.
 * 3. Un CI con cuenta le manda una notificación a esa cuenta.
 * 4. Esa cuenta acepta desde Dependientes y el titular la ve en su lista.
 * 5. El modal entra en teléfono, tableta y escritorio.
 */

/** La titular: la cuenta de paciente de la maqueta. */
const TITULAR = { documento: '7654321', nombre: 'Ana Lucía Pérez Quiroga' };
/** Un paciente del padrón con cuenta (índice 1 de `personas.ts`). */
const DEPENDIENTE = { documento: '5009871', nombre: 'Jorge Luis Mamani Choque' };

/**
 * Entra con un CI. Borra la sesión anterior primero: el refresh token vive en
 * `localStorage`, y el simulador guarda lo suyo en `sessionStorage`, que
 * sobrevive a la recarga — así la solicitud sigue ahí para la otra cuenta.
 */
async function entrar(page: Page, documento: string): Promise<void> {
  await page.goto('/auth');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento no hay sesión que borrar */
    }
  });
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(documento);
  await page.getByTestId('login-password').fill('demo');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

async function abrirModal(page: Page): Promise<void> {
  await page.goto('/my-account/dependents');
  await page.getByTestId('dependents-nuevo').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function enviarCi(page: Page, documento: string): Promise<void> {
  const campo = page.getByRole('dialog').getByRole('textbox');
  await campo.fill(documento);
  await page.getByTestId('dependent-submit').click();
}

test.describe('B.1 · dependientes por CI', () => {
  test('pedir por CI, aceptar desde la otra cuenta y verla en la lista', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() !== 'error') return;
      // La política de contenido rechaza los scripts que inyecta el servidor de
      // desarrollo. Es anterior a esta pantalla.
      if (mensaje.text().includes('Content Security Policy')) return;
      // El 404 de «no hay cuenta» es una respuesta esperada del recorrido.
      if (mensaje.text().includes('404')) return;
      errores.push(mensaje.text());
    });

    await entrar(page, TITULAR.documento);
    await abrirModal(page);

    // 1 · un solo campo.
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByRole('textbox')).toHaveCount(1);
    await expect(dialogo.getByRole('combobox')).toHaveCount(0);
    await expect(dialogo).not.toContainText('Fecha de nacimiento');

    // 2 · sin cuenta, se dice junto al campo y el modal sigue abierto.
    await enviarCi(page, '999999999');
    await expect(dialogo).toContainText('No hay ninguna cuenta registrada con ese CI.');

    // 3 · con cuenta, se envía la solicitud.
    await enviarCi(page, DEPENDIENTE.documento);
    await expect(dialogo).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(/Enviamos la solicitud a la cuenta con CI 5009871/)).toBeVisible();

    // …y a esa cuenta le llega la notificación.
    await entrar(page, DEPENDIENTE.documento);
    await page.goto('/notification-center');
    await expect(page.getByText('Te quieren registrar como dependiente').first()).toBeVisible();

    // 4 · acepta desde Dependientes.
    await page.goto('/my-account/dependents');
    const solicitudes = page.getByTestId('dependents-solicitudes');
    await expect(solicitudes).toContainText(TITULAR.nombre);
    await page.getByRole('button', { name: `Aceptar la solicitud de ${TITULAR.nombre}` }).click();
    await expect(solicitudes).toHaveCount(0);

    // Y la titular la ve en su lista.
    await entrar(page, TITULAR.documento);
    await page.goto('/my-account/dependents');
    await expect(page.getByTestId('dependents-lista')).toContainText(DEPENDIENTE.nombre);

    expect(errores).toEqual([]);
  });

  /**
   * Los tres anchos, cada uno en su propia ventana: el armazón decide al
   * montarse si el menú es columna o cajón, así que no se redimensiona.
   */
  for (const [nombre, ancho, alto] of [
    ['telefono', 390, 844],
    ['tableta', 820, 1180],
    ['escritorio', 1440, 900],
  ] as const) {
    test(`el modal entra en ${nombre}`, async ({ browser }) => {
      const contexto = await browser.newContext({
        viewport: { width: ancho, height: alto },
        locale: 'es-BO',
      });
      const page = await contexto.newPage();
      try {
        await entrar(page, TITULAR.documento);
        await abrirModal(page);
        await enviarCi(page, '999999999');
        await expect(page.getByRole('dialog')).toContainText(
          'No hay ninguna cuenta registrada con ese CI.',
        );

        // Se mide el modal, no el documento: en teléfono la cabecera compartida
        // ya desborda 13 px en todas las pantallas (botón de cuenta), y eso no
        // es de esta prueba.
        for (const [que, caja] of [
          ['modal', await page.getByRole('dialog').boundingBox()],
          ['campo', await page.getByRole('dialog').getByRole('textbox').boundingBox()],
          ['botón', await page.getByTestId('dependent-submit').boundingBox()],
        ] as const) {
          expect(caja, `${que} sin caja en ${nombre}`).not.toBeNull();
          expect(caja!.x, `${que} cortado a la izquierda en ${nombre}`).toBeGreaterThanOrEqual(0);
          expect(caja!.x + caja!.width, `${que} cortado a la derecha en ${nombre}`).toBeLessThanOrEqual(
            ancho,
          );
        }

        await page.screenshot({
          path: `artifacts/playwright/b1-dependientes-${nombre}.png`,
          fullPage: true,
        });
      } finally {
        await contexto.close();
      }
    });
  }
});
