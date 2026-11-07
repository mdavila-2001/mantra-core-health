import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * 06/11/2026 — Crear una orden en laboratorio e imagenología (tres vías).
 * Servir con `corepack yarn start:demo` y correr con Chromium, un solo worker:
 * corepack yarn exec playwright test playwright/crear-orden-laboratorio.spec.ts --project=chromium --workers=1
 *
 * Camino de punta a punta contra el SIMULADOR (la API real no tiene estas rutas):
 *   paciente muestra su QR → el laboratorio lo carga → la orden queda en «Borrador»
 *   y sobrevive a una recarga. La orden propia del laboratorio ya la cubre el diálogo de la lista.
 * La derivación del médico va en el segundo test.
 */

const EVIDENCIA = 'docs/trabajo/2026-11-06-crear-orden-laboratorio-imagenologia/evidencia';
const VIEWPORTS = [
  { nombre: '390', width: 390, height: 844 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

async function entrarDemo(page: Page, email: string): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mock');
  await expect(page.getByTestId('login-password')).toHaveValue('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|administration|auth\/organization|portal-selector)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
  if (page.url().includes('/portal-selector')) {
    await page.getByRole('link', { name: /Portal de administración/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await esperarAplicacionLista(page);
}

async function salir(page: Page): Promise<void> {
  await page.locator('[aria-label^="Cuenta de"]').first().click();
  await page.getByTestId('header-cerrar-sesion').click();
  await page.waitForURL(/\/auth/, { timeout: 30_000 });
}

/**
 * Errores de consola de la prueba. Se ignora `AbortError: Transition was skipped`: lo
 * lanza el navegador cuando dos navegaciones del login se pisan (`withViewTransitions`)
 * y aparece en `/my-account/diagnostic-orders` recién entrado el paciente, antes de
 * tocar nada de lo nuevo. Cualquier otro error de consola hace fallar la prueba.
 */
function erroresDeConsola(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text() + ' @ ' + page.url());
  });
  page.on('pageerror', (e) => errores.push(e.message + ' @ ' + page.url()));
  return errores;
}

/**
 * Captura con la pantalla quieta. El router anima el cambio de ruta con
 * `withViewTransitions` y una captura a mitad de camino muestra la pantalla
 * anterior: las pruebas piden movimiento reducido (la aplicación lo respeta,
 * regla 95.5) y esperan dos cuadros pintados.
 */
async function capturar(page: Page, ruta: string): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo()))),
  );
  await page.screenshot({ path: ruta });
}

async function abrirAcciones(page: Page, fila: ReturnType<Page['locator']>): Promise<void> {
  await fila.getByRole('button', { name: /Acciones de/ }).click();
}

test.describe('Crear una orden en el laboratorio', () => {
  test.beforeEach(async ({ page }) => {
    await mkdir(EVIDENCIA, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('QR del paciente → laboratorio → Borrador, y persiste tras recargar', async ({ page }) => {
    const errores = erroresDeConsola(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1) El paciente muestra el QR de una orden de laboratorio.
    await entrarDemo(page, 'paciente@alovida.mock');
    await page.goto('/my-account/diagnostic-orders');
    await esperarAplicacionLista(page);
    const filas = page.locator('tbody tr');
    await expect(filas.first()).toBeVisible();
    // Sólo una orden abierta ofrece el QR: la sembrada pendiente es la de imagenología.
    const fila = filas.filter({ hasText: 'Imagenología' }).first();
    await abrirAcciones(page, fila);
    await page.getByRole('menuitem', { name: 'Mostrar QR para el laboratorio' }).click();
    const codigo = page.getByTestId('mis-ordenes-qr-codigo');
    await expect(codigo).toContainText('ALOVIDA-ORDEN:v1:');
    await expect(page.getByTestId('mis-ordenes-qr-lienzo')).toBeVisible();
    const texto = (await codigo.textContent())!.trim();
    await capturar(page, `${EVIDENCIA}/01-paciente-qr-1440.png`);
    await page.keyboard.press('Escape');
    await salir(page);

    // 2) El laboratorio crea la orden con ese código.
    await entrarDemo(page, 'laboratorio@alovida.mock');
    await page.goto('/administration/laboratory-orders');
    await esperarAplicacionLista(page);
    await page.getByTestId('lab-orders-new-qr').click();
    await expect(page.getByRole('dialog', { name: 'Orden con el QR del paciente' })).toBeVisible();
    await page.getByTestId('lab-new-order-code').fill(texto);
    await page.getByTestId('lab-new-order-code-submit').click();
    await page.waitForURL(/estado=draft/);
    await expect(page.getByTestId('lab-orders-card')).toBeVisible();
    // La maqueta siembra UNA orden en borrador; la del QR es la segunda.
    const filasEnBorrador = page.locator('tbody tr', { hasText: 'Borrador' });
    await expect(filasEnBorrador).toHaveCount(2);
    await capturar(page, `${EVIDENCIA}/07-qr-creada-borrador-1440.png`);
    const antes = 2;

    // 3) Sobrevive a una recarga y leer el mismo código otra vez no duplica.
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.locator('tbody tr')).toHaveCount(antes);
    await page.getByTestId('lab-orders-new-qr').click();
    await page.getByTestId('lab-new-order-code').fill(texto);
    await page.getByTestId('lab-new-order-code-submit').click();
    await expect(page.getByTestId('lab-qr-order-dialog')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(antes);

    expect(errores.filter((e) => !/favicon|Failed to load resource.*(401|404)|Transition was skipped|patients\/lookup → 404/.test(e))).toEqual([]);
  });

  test('pantalla del laboratorio: identidad, entrada por QR y vía manual, en tres viewports y tema oscuro', async ({ page }) => {
    const errores = erroresDeConsola(page);
    await entrarDemo(page, 'laboratorio@alovida.mock');

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/administration/laboratory-orders');
      await esperarAplicacionLista(page);
      await expect(page.getByTestId('lab-orders-new')).toBeVisible();
      await expect(page.getByTestId('lab-orders-new-qr')).toBeVisible();
      await expect(page.getByRole('tab', { name: /^Todas \(\d+\)/ })).not.toHaveText('Todas (0)');
      await capturar(page, `${EVIDENCIA}/02-ordenes-botones-${vp.nombre}.png`);

      await page.getByTestId('lab-orders-new-qr').click();
      await expect(page.getByTestId('lab-new-order-opciones')).toBeVisible();
      await capturar(page, `${EVIDENCIA}/03-nueva-orden-qr-${vp.nombre}.png`);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('lab-qr-order-dialog')).toHaveCount(0);
    }

    // Dark theme (`:root[data-theme='dark']`, the one the theme switcher sets): the dialog and its three options.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.getByTestId('lab-orders-new-qr').click();
    await expect(page.getByTestId('lab-new-order-opciones')).toBeVisible();
    await capturar(page, `${EVIDENCIA}/13-nueva-orden-qr-oscuro-390.png`);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.keyboard.press('Escape');

    // Way 3 is the list's own «Nueva orden» dialog (the real API contract): it must still open.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId('lab-orders-new').click();
    await expect(page.getByRole('dialog', { name: 'Nueva orden' })).toBeVisible();
    await capturar(page, `${EVIDENCIA}/04-nueva-orden-propia-1440.png`);

    expect(errores.filter((e) => !/favicon|Failed to load resource.*(401|404)|Transition was skipped|patients\/lookup → 404/.test(e))).toEqual([]);
  });

  test('el médico deriva, el paciente acepta, y recién entonces la ve el laboratorio', async ({ page }) => {
    const errores = erroresDeConsola(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1) La médica deriva una orden de laboratorio de la paciente a «Laboratorio Central».
    await entrarDemo(page, 'medica@alovida.mock');
    // The patient (Ana Lucía Pérez Quiroga) is the demo patient the doctor already follows.
    await page.goto('/medical-records/c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0/consultation');
    await page.waitForURL(/\/consultation$/, { timeout: 60_000 });
    await esperarAplicacionLista(page);
    const abrirEncuentro = page.getByTestId('consulta-abrir-encuentro');
    if ((await abrirEncuentro.count()) > 0) await abrirEncuentro.click();
    await page.getByTestId('consulta-casilla-ordenes').click();
    const lista = page.getByTestId('estudios-lista');
    await expect(lista).toBeVisible();
    const derivar = lista.getByTestId('study-refer').first();
    await expect(derivar).toBeVisible();
    await derivar.click();
    await expect(page.getByRole('dialog', { name: 'Derivar a un centro' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Derivar a un centro' }).getByRole('textbox', { name: 'Buscar un centro' }).fill('Laboratorio Central');
    // El radio nativo es invisible (pieza de la casa): se elige por su rótulo, como una persona.
    await page.getByRole('dialog', { name: 'Derivar a un centro' }).getByText('Laboratorio Central', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Laboratorio Central' })).toBeChecked();
    await expect(page.getByTestId('derivar-enviar')).toHaveAttribute('aria-disabled', 'false');
    await capturar(page, `${EVIDENCIA}/08-medico-derivar-1440.png`);
    await page.getByTestId('derivar-enviar').click();
    await expect(lista.getByTestId('estudios-derivacion').first()).toContainText(
      'espera la aceptación del paciente',
    );
    await capturar(page, `${EVIDENCIA}/09-medico-derivada-pendiente-1440.png`);
    await page.keyboard.press('Escape'); // cierra la casilla de órdenes
    await expect(page.getByTestId('content-dialog')).toHaveCount(0);
    await salir(page);

    // 2) Antes de aceptar, el laboratorio no ve nada nuevo.
    await entrarDemo(page, 'laboratorio@alovida.mock');
    await page.goto('/administration/laboratory-orders?estado=draft');
    await esperarAplicacionLista(page);
    await expect(page.locator('tbody tr')).toHaveCount(1); // sólo la borrador sembrada
    await salir(page);

    // 3) La paciente ve la derivación pendiente y la acepta.
    await entrarDemo(page, 'paciente@alovida.mock');
    await page.goto('/my-account/diagnostic-orders');
    await esperarAplicacionLista(page);
    const pendiente = page.getByTestId('mis-ordenes-derivacion').first();
    await expect(pendiente).toContainText('Espera su aceptación');
    const fila = page.locator('tbody tr', { has: pendiente });
    await fila.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await capturar(page, `${EVIDENCIA}/10-paciente-derivacion-pendiente-1440.png`);
    await abrirAcciones(page, fila);
    await page.getByRole('menuitem', { name: 'Aceptar la derivación' }).click();
    await expect(page.getByTestId('mis-ordenes-derivacion').first()).toContainText('Derivada a');
    await page.getByTestId('mis-ordenes-derivacion').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(page.getByText(/Aceptó la derivación/)).toHaveCount(0, { timeout: 20_000 }); // el aviso ya se fue
    await capturar(page, `${EVIDENCIA}/11-paciente-derivacion-aceptada-1440.png`);
    await salir(page);

    // 4) Ahora el laboratorio la ve en «Borrador», con su origen, y sobrevive a la recarga.
    await entrarDemo(page, 'laboratorio@alovida.mock');
    await page.goto('/administration/laboratory-orders?estado=draft');
    await esperarAplicacionLista(page);
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByTestId('lab-order-origin').filter({ hasText: 'aceptada por el paciente' })).toHaveCount(1);
    await capturar(page, `${EVIDENCIA}/12-laboratorio-derivada-borrador-1440.png`);
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.locator('tbody tr')).toHaveCount(2);

    expect(errores.filter((e) => !/favicon|Failed to load resource.*(401|404)|Transition was skipped|patients\/lookup → 404/.test(e))).toEqual([]);
  });
});
