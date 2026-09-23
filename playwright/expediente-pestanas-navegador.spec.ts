import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * El expediente clínico, después de separar la lectura de la escritura.
 *
 * Tres cosas que sólo se ven en un navegador y que ninguna prueba unitaria
 * puede afirmar:
 *
 * 1. **Las pestañas de la historia son un marco de ventana.** Ocho secciones no
 *    entran en una línea; antes desbordaban con la barra de scroll del sistema
 *    y la primera pestaña aparecía cortada por la mitad, que se lee como un
 *    error de dibujo. Ahora hay marco y flechas.
 * 2. **La página no scrollea de costado.** El desborde es de la tira, no del
 *    documento.
 * 3. **Lo que se escribe ya no está acá.** El encuentro y «Qué vas a registrar»
 *    se mudaron a la pantalla de Atención, que se abre con el botón «Atender».
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'expediente-pestanas');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

/** Cuánto se sale el documento del ancho de la ventana, en px. */
async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

test.describe('Expediente · pestañas con marco de ventana', () => {
  test('la historia se lee en un marco y la escritura vive en Atención', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, MEDICA);
    await irA(page, '/medical-records');
    await estable(page);

    // Se entra por la lista, como una persona: el identificador del paciente es
    // del banco de datos simulado y fijarlo acá ataría la prueba a la semilla.
    // El archivo no lista a nadie hasta que se busca: Enter dispara la búsqueda
    // sin esperar la demora del tipeo.
    const buscador = page.getByRole('textbox', { name: 'Buscar por nombre o código' });
    await buscador.fill('Ana');
    await buscador.press('Enter');
    await page.getByRole('link', { name: 'Ver expediente' }).first().click();
    await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
    await estable(page);

    /* ---- 1. el marco existe y la tira no la dibuja el sistema ------------- */

    const tabs = page.locator('app-tabs.tabs--browser').first();
    await expect(tabs).toBeVisible();

    const tira = tabs.locator('.tabs__list');
    // La barra del navegador está oculta: el desplazamiento lo ofrecen las
    // flechas. Sin esto la tira reserva alto para una barra que además dejaba
    // la primera pestaña cortada.
    expect(
      await tira.evaluate((el) => getComputedStyle(el).scrollbarWidth),
    ).toBe('none');

    // Y la primera pestaña empieza donde empieza la tira: no arranca recortada.
    expect(await tira.evaluate((el) => el.scrollLeft)).toBe(0);

    /* ---- 2. la página no scrollea de costado ------------------------------ */

    expect(await desbordeHorizontal(page)).toBe(0);

    await page.screenshot({
      path: join(SALIDA, 'expediente-1440.png'),
      fullPage: false,
    });

    /* ---- 3. lo que se escribe no está acá --------------------------------- */

    await expect(page.getByRole('heading', { name: 'Qué vas a registrar' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Encuentro', exact: true })).toHaveCount(0);

    /* ---- angosto: el marco aguanta y sigue sin desbordar ------------------ */

    await page.setViewportSize({ width: 390, height: 844 });
    await estable(page);
    expect(await desbordeHorizontal(page)).toBe(0);
    await page.screenshot({ path: join(SALIDA, 'expediente-390.png'), fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await estable(page);

    /* ---- 4. el expediente ya no es un origen de la atención --------------- */

    /* Atender nace sólo de «Mis citas»: el expediente es lectura y perdió su
       botón «Atender». Se comprueba que no está y se llega a la pantalla de
       escritura por su URL, que es lo que esta prueba mira de acá en más. */
    await expect(page.getByTestId('expediente-abrir-atencion')).toHaveCount(0);

    const urlExpediente = page.url();
    await page.goto(`${urlExpediente}/consultation`, { waitUntil: 'commit' });
    await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
    await estable(page);

    await expect(page.getByTestId('consulta-encuentro')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qué vas a registrar' })).toBeVisible();
    await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(9);
    expect(await desbordeHorizontal(page)).toBe(0);

    await page.screenshot({ path: join(SALIDA, 'consulta-1440.png'), fullPage: false });

    /* ---- 5. y se vuelve al expediente sin volver a elegir a nadie --------- */

    await page.getByTestId('consulta-ver-expediente').click();
    await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
    await estable(page);
    await expect(page.locator('app-tabs.tabs--browser').first()).toBeVisible();
  });
});
