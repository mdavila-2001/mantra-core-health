/* ============================================================================
    Los botones de las vistas portadas desde la bóveda, en un navegador de
    verdad.

    `scripts/port-vistas-alovida.mjs` reescribe cada `<a href>` de la maqueta a
    `routerLink`, pero a los `<button>` no los toca: allá su comportamiento lo
    ponía `_assets/alovida.js`, que no se porta. Lo que quedó pintado y mudo lo
    mueve ahora `AlovidaRuntimeService.controlesDeMaqueta()`.

    El spec de ese servicio ya fija el comportamiento contra marcado de
    laboratorio; esto lo fija contra el marcado real de las 126 pantallas, que
    es donde se rompe: un selector que no engancha porque el generador emitió
    otra clase no se ve en jsdom, se ve acá.

    No necesita sesión ni API: las rutas portadas cuelgan de la raíz y no pasan
    por `authGuard`.
    ========================================================================== */

import { test, expect, type Page } from '@playwright/test';

const LISTADO = '/accesos/accesos-clinicos-listado';
const FORMULARIO = '/accesos/accesos-clinicos-del-paciente-formulario';
const REPETIDOR = '/terminologia/conjuntos-de-valor-formulario';
const PROPIEDADES = '/terminologia/propiedades-listado';

/**
 * `networkidle` no llega nunca contra `ng serve` —el canal de recarga en
 * caliente queda abierto— y esperarlo da verdes falsos por tiempo agotado. Se
 * espera al marco de la maqueta, que es lo que de verdad indica que la
 * pantalla se pintó.
 */
async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-alovida-maqueta]', { timeout: 30_000 });
}

test.describe('controles de las vistas portadas', () => {
  test('el chip de un filtro se quita al pulsarlo', async ({ page }) => {
    await abrir(page, LISTADO);
    const chips = page.locator('.app-chip');
    const antes = await chips.count();
    expect(antes).toBeGreaterThan(0);

    await page.locator('.app-chip button').first().click();

    await expect(chips).toHaveCount(antes - 1);
  });

  test('elegir en el combo de referencia escribe el rótulo y recoge la lista', async ({ page }) => {
    await abrir(page, FORMULARIO);
    const lista = page.locator("[role='listbox']").first();
    const opcion = lista.locator("[role='option'][aria-selected='false']").first();
    const rotulo = (await opcion.innerText()).split('\n')[0].trim();
    const campo = page.locator(`input[aria-controls='${await lista.getAttribute('id')}']`);

    await opcion.click();

    await expect(campo).toHaveValue(rotulo);
    await expect(campo).toHaveAttribute('aria-expanded', 'false');
    await expect(lista).toBeHidden();
  });

  test('la paginación no promete una página que no existe', async ({ page }) => {
    // Seis filas y una nota que dice «25 filas por página»: no hay siguiente.
    // La maqueta dibujaba «Siguientes» habilitado igual.
    await abrir(page, LISTADO);
    const paginacion = page.locator('.app-pagination');

    await expect(paginacion.getByText('Siguientes')).toHaveAttribute('aria-disabled', 'true');
    await expect(paginacion.getByText('Anteriores')).toHaveAttribute('aria-disabled', 'true');
  });

  test('la acción final del formulario vuelve al listado del que salió', async ({ page }) => {
    await abrir(page, `${FORMULARIO}?estado=paso3`);

    await page.locator("[data-estado='paso3'] .app-form-actions button").click();

    await expect(page).toHaveURL(/\/accesos\/accesos-clinicos-del-paciente-listado$/);
  });

  test('«Reintentar» saca a la pantalla del estado de error', async ({ page }) => {
    await abrir(page, `${LISTADO}?estado=error`);
    await expect(page.locator("[data-estado='error']")).toBeVisible();

    await page.getByRole('button', { name: 'Reintentar' }).click();

    await expect(page).not.toHaveURL(/estado=error/);
    await expect(page.locator("[data-estado='datos']")).toBeVisible();
  });

  test('el repetidor de reglas agrega y saca filas', async ({ page }) => {
    await abrir(page, REPETIDOR);
    const seccion = page.locator('[app-form-section]').filter({ hasText: 'Agregar otra regla' });
    const filas = seccion.locator('.app-card--inset');
    const antes = await filas.count();

    await seccion.getByRole('button', { name: 'Agregar otra regla' }).click();
    await expect(filas).toHaveCount(antes + 1);

    await filas.last().locator('.app-card__cabecera button').click();
    await expect(filas).toHaveCount(antes);
  });

  test('«Ver el JSON» baja a la página lo que el title sólo enseña al pasar', async ({ page }) => {
    await abrir(page, PROPIEDADES);
    const boton = page.getByRole('button', { name: 'Ver el JSON' }).first();
    const panel = boton.locator('xpath=ancestor::*[contains(@class,"app-tooltip-panel")][1]');
    const esperado = await panel.getAttribute('title');

    await boton.click();

    await expect(panel.locator('.app-titulo-revelado')).toHaveText(esperado ?? '');
  });

  test('los dos botones del header abren su desplegable', async ({ page }) => {
    // Están en las 111 pantallas de sesión: eran los controles muertos más
    // vistos de la rama.
    await abrir(page, LISTADO);
    const organizaciones = page.locator('#menu-organizacion');
    const avisos = page.locator('#menu-avisos');

    await page.locator('.app-tenant-switcher').click();
    await expect(organizaciones).toBeVisible();

    await page.locator('.app-header__campana').click();
    await expect(organizaciones).toBeHidden();
    await expect(avisos).toBeVisible();

    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await expect(avisos).toBeHidden();
  });

  test('un control anunciado como deshabilitado no navega', async ({ page }) => {
    // Los `data-sin-destino` son enlaces que la bóveda declara sin destino: el
    // generador los deja `aria-disabled`, y pulsarlos no puede llevar a un 404.
    await abrir(page, LISTADO);
    const url = page.url();

    await page.locator('a[data-sin-destino]').first().click();

    expect(page.url()).toBe(url);
  });
});
