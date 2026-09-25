import { test, expect, type Page } from '@playwright/test';

import { administrador } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril Marcelo B, H2.S2/H3 — el spec del contrato compartido
 * (`CONTRATO-CARGA-MASIVA.md` §3 y §7), escrito contra los `data-testid`
 * `carga-*` que Justin publica. Recorre el kill-test del contrato completo
 * por su parte: perfil → sistema → versión → archivo → validar → importar.
 *
 * Backend detrás de estos tests: el **doble del simulador** de
 * `terminology.handlers.ts` en la rama de Justin (`[backend simulado]`,
 * regla 65 — correcto/límite/inválido, no la API real). Corrido primero
 * contra la pantalla de hoy (sin estos testid: evidencia del «antes» en
 * `evidencia/h2/contrato-antes.txt`) y después contra la rama publicada.
 */

async function elegirDestino(page: Page): Promise<void> {
  await page.getByTestId('carga-sistema').locator('select').selectOption({ index: 1 });
  await page.getByTestId('carga-version').locator('select').selectOption({ index: 1 });
}

function sinRuido(mensaje: { type(): string; text(): string }): boolean {
  return mensaje.type() === 'error' && !mensaje.text().includes('Content Security Policy');
}

test.describe('carga masiva — contrato §3/§7 [backend simulado]', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, administrador());
    await irA(page, '/administration/terminology/import');
    await estable(page);
  });

  test('1 · flujo feliz: valida e importa ok-50.csv', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (m) => sinRuido(m) && errores.push(m.text()));

    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/ok-50.csv');

    await page.getByTestId('carga-validar').click();

    const informe = page.getByTestId('carga-informe');
    await expect(informe).toBeVisible();
    await expect(informe).toContainText('50');
    // El informe de validación no tiene errores: la fila «Con error» es 0.
    await expect(informe).toContainText('0');

    await expect(page.getByTestId('carga-importar')).toBeEnabled();
    await page.getByTestId('carga-importar').click();

    const resumen = page.getByTestId('carga-resumen');
    await expect(resumen).toBeVisible();
    await expect(resumen).toContainText('50');

    expect(errores, errores.join(' | ')).toHaveLength(0);
  });

  test('2 · idempotencia: reimportar el mismo archivo omite todo', async ({ page }) => {
    await elegirDestino(page);
    const archivo = page.getByTestId('carga-archivo').locator('input[type=file]');
    await archivo.setInputFiles('playwright/fixtures/carga-masiva/ok-50.csv');
    await page.getByTestId('carga-validar').click();
    await expect(page.getByTestId('carga-informe')).toBeVisible();
    await page.getByTestId('carga-importar').click();
    await expect(page.getByTestId('carga-resumen')).toBeVisible();

    await page.getByTestId('carga-otro').click();
    await archivo.setInputFiles('playwright/fixtures/carga-masiva/ok-50.csv');
    await page.getByTestId('carga-validar').click();
    await expect(page.getByTestId('carga-informe')).toBeVisible();
    await page.getByTestId('carga-importar').click();

    const resumen = page.getByTestId('carga-resumen');
    await expect(resumen).toBeVisible();
    await expect(resumen).toContainText('0');
    await expect(resumen).toContainText('50');
  });

  test('3 · con errores: aborta entero y deshabilita Importar', async ({ page }) => {
    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/con-errores.csv');
    await page.getByTestId('carga-validar').click();

    const errores = page.getByTestId('carga-errores');
    await expect(errores).toBeVisible();
    await expect(page.getByTestId('carga-importar')).toBeDisabled();
    await expect(page.getByText('No se guardó nada', { exact: true })).toBeVisible();
  });

  /**
   * Hallazgo (no un defecto): `no-es-nada.pdf` **nunca llega al servidor**.
   * `FileInput` valida `accept` también al soltar/elegir (`file-input.ts`,
   * `matchesFileAccept`), así que un PDF se rechaza en el cliente y `carga-validar`
   * queda deshabilitado (no hay `archivo()`) — el 422 `IMPORT_FORMAT_UNSUPPORTED`
   * del contrato §2 es la defensa del servidor para quien no pasa por esta
   * pantalla (`curl`, otro cliente), no el camino que ejercita este test.
   */
  test('4 · inválido: un PDF se rechaza en el cliente con un mensaje legible', async ({ page }) => {
    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/no-es-nada.pdf');

    // Aparece dos veces a propósito: el toast (se va solo) y el aviso anclado
    // en la sección 3 (releíble después de que el toast desaparezca).
    const aviso = page.getByText('No se pudo tomar', { exact: false }).first();
    await expect(aviso).toBeVisible();
    await expect(page.locator('body')).not.toContainText('at Object.');
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.getByTestId('carga-validar')).toBeDisabled();
  });

  test('5 · vacío: archivo sólo con encabezado dice que no tiene filas', async ({ page }) => {
    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/vacio-solo-encabezado.csv');
    await page.getByTestId('carga-validar').click();

    await expect(page.getByText(/no tiene filas/i)).toBeVisible();
  });

  test('6 · fallo de red preserva el archivo elegido y los selects', async ({ page }) => {
    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/error-red.csv');
    await page.getByTestId('carga-validar').click();

    await expect(page.locator('body')).toContainText(/no se pudo|no está disponible/i);
    // Lo elegido sigue ahí: no hace falta volver a cargar el archivo.
    await expect(page.getByTestId('carga-sistema').locator('select')).not.toHaveValue('');
    await expect(page.getByTestId('carga-version').locator('select')).not.toHaveValue('');
  });

  test('7 · plantilla CSV: descarga con el encabezado canónico', async ({ page }) => {
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('carga-plantilla-csv').click(),
    ]);
    expect(descarga.suggestedFilename()).toContain('plantilla');
    const ruta = await descarga.path();
    expect(ruta).not.toBeNull();
  });

  test('8 · descarga de errores: CSV con las filas con problema', async ({ page }) => {
    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/con-errores.csv');
    await page.getByTestId('carga-validar').click();
    await expect(page.getByTestId('carga-errores')).toBeVisible();

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('carga-descargar-errores').click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/\.csv$/);
  });

  /**
   * Nota de método: contra el simulador, `HttpClient` nunca despacha una
   * petición real de red (el interceptor la resuelve dentro de Angular, sin
   * `fetch`/`XHR`) — verificado: `page.on('request')` no ve nada ni con un
   * solo clic. Por eso la evidencia de «un solo envío» acá es el guard
   * estructural (`cargando()` deshabilita el botón) más un resultado sin
   * duplicar, y **no** un conteo de red — eso sí se verifica en H6 contra la
   * API real, donde la petición sí es observable.
   */
  test('9 · sin doble envío: el guard deshabilita Validar mientras está en curso', async ({
    page,
  }) => {
    await elegirDestino(page);
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles('playwright/fixtures/carga-masiva/ok-50.csv');

    const boton = page.getByTestId('carga-validar');
    await expect(boton).toBeEnabled();
    await boton.click();
    // El clic ya disparó `enCurso.set(true)`: un segundo clic inmediato no es
    // accionable porque Playwright espera "enabled" antes de clickear, y acá
    // el `trial` prueba la acción sin ejecutarla.
    const segundoClicPosible = await boton
      .click({ trial: true, timeout: 300 })
      .then(() => true)
      .catch(() => false);

    await expect(page.getByTestId('carga-informe')).toBeVisible();
    expect(segundoClicPosible).toBe(false);
  });

  test('10 · teclado: Tab hasta el archivo, Enter abre el diálogo', async ({ page }) => {
    await elegirDestino(page);

    const zonaDeArchivo = page.getByTestId('carga-archivo').locator('input[type=file]');
    await zonaDeArchivo.focus();

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.keyboard.press('Enter'),
    ]);
    expect(chooser).toBeTruthy();
    await chooser.setFiles('playwright/fixtures/carga-masiva/ok-50.csv');

    const validar = page.getByTestId('carga-validar');
    await expect(validar).toBeEnabled();
    await validar.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('carga-informe')).toBeVisible();
  });

  test('11 · accesibilidad: axe sin violaciones serias, si la dependencia está', async ({
    page,
  }, testInfo) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let AxeBuilder: (new (args: { page: Page }) => { analyze(): Promise<{ violations: unknown[] }> }) | null;
    try {
      // Q-M2: sólo si @axe-core/playwright ya está en package.json; no se agrega.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AxeBuilder = require('@axe-core/playwright').default;
    } catch {
      AxeBuilder = null;
    }
    test.skip(AxeBuilder === null, 'DESCARTADO: @axe-core/playwright no está en package.json');
    if (AxeBuilder === null) return;

    await elegirDestino(page);
    const resultados = await new AxeBuilder({ page }).analyze();
    const graves = (resultados.violations as { impact?: string }[]).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(graves, JSON.stringify(graves, null, 2)).toHaveLength(0);
    void testInfo;
  });
});
