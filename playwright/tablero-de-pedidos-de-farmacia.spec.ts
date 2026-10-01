/* ============================================================================
    El tablero de «Solicitudes de retiro» de la farmacia, en un navegador.

    Corre contra la **maqueta** (`mockBackend`): entra `farmacia@alovida.mock`
    por la pantalla de ingreso y prueba lo que pidió el propietario:

      · seis columnas, cada una con alto máximo y scroll por dentro;
      · la sede abre en la casa matriz y se puede cambiar;
      · la fecha recorta sólo «Cerrados»: lo pendiente de días atrás sigue ahí;
      · el tablero se desplaza de costado sin estirar la página.

    Con `--workers=1`. Antes de correrlo hay que tener `ng serve` arriba y
    `E2E_BASE_URL` apuntando a él. Las capturas van a
    `docs/trabajo/2026-10-01-tablero-farmacia/evidencia/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import { farmacia } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

const EVIDENCIA = join('docs', 'trabajo', '2026-10-01-tablero-farmacia', 'evidencia');
const RUTA = '/administration/pharmacy-orders';

const SEDE_MATRIZ = 'Sucursal Central (casa matriz)';
const SEDE_CON_COLUMNA_LLENA = 'Sucursal Equipetrol';

/** Las tarjetas de una cola, por el nombre que le da a la sección su `aria-label`. */
function cola(page: Page, nombre: string) {
  return page.locator(`section.bandeja__cola[aria-label="${nombre}"]`);
}

function tarjetas(page: Page, nombre: string) {
  return cola(page, nombre).locator('[data-testid="bandeja-pedido"]');
}

async function abrirBandeja(page: Page): Promise<void> {
  await entrar(page, farmacia());
  await irA(page, RUTA);
  await expect(page.locator('[data-testid="bandeja"]')).toBeVisible({ timeout: 30_000 });
  await estable(page);
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: false });
}

test.describe('Tablero de pedidos de la farmacia', () => {
  test('abre en la casa matriz con las seis colas y los dos recortes', async ({ page }) => {
    await abrirBandeja(page);

    await expect(page.locator('section.bandeja__cola')).toHaveCount(6);
    // `option:checked`, no el texto del `<select>`: éste contiene todas las opciones.
    await expect(page.getByRole('combobox', { name: 'Sede' }).locator('option:checked')).toHaveText(
      SEDE_MATRIZ,
    );
    await expect(page.getByRole('combobox', { name: 'Fechas de los pedidos cerrados' })).toBeVisible();
    await expect(page.locator('[data-testid="bandeja-recorte"]')).toHaveText('Hoy');
  });

  test('cada columna tiene alto máximo y se desplaza por dentro', async ({ page }) => {
    await abrirBandeja(page);
    await page.getByRole('combobox', { name: 'Sede' }).selectOption({ label: SEDE_CON_COLUMNA_LLENA });
    await expect(tarjetas(page, 'En revisión')).toHaveCount(14);

    const medidas = await cola(page, 'En revisión')
      .locator('.bandeja__lista')
      .evaluate((lista) => ({
        overflowY: getComputedStyle(lista).overflowY,
        alto: lista.clientHeight,
        contenido: lista.scrollHeight,
        tope: parseFloat(getComputedStyle(lista).maxHeight),
      }));

    expect(medidas.overflowY).toBe('auto');
    expect(medidas.contenido).toBeGreaterThan(medidas.alto);
    expect(medidas.alto).toBeLessThanOrEqual(medidas.tope + 1);

    // La página no se estiró con la columna: el alto del documento no depende
    // de cuántas tarjetas tenga una cola.
    const documento = await page.evaluate(() => ({
      alto: document.documentElement.scrollHeight,
      ventana: window.innerHeight,
      ancho: document.documentElement.scrollWidth,
      anchoVentana: window.innerWidth,
    }));
    expect(documento.ancho).toBeLessThanOrEqual(documento.anchoVentana);
    expect(documento.alto).toBeLessThan(documento.ventana + 600);
  });

  test('cambiar de sede cambia lo que se ve y queda en la URL', async ({ page }) => {
    await abrirBandeja(page);
    const enCentral = await tarjetas(page, 'En revisión').count();

    await page.getByRole('combobox', { name: 'Sede' }).selectOption({ label: SEDE_CON_COLUMNA_LLENA });
    await expect(tarjetas(page, 'En revisión')).toHaveCount(14);
    expect(14).not.toBe(enCentral);
    await expect(page).toHaveURL(/[?&]site=/);

    await page.getByRole('combobox', { name: 'Sede' }).selectOption({ label: 'Todas las sedes' });
    await expect(page).toHaveURL(/[?&]site=all/);
    await expect(tarjetas(page, 'En revisión')).toHaveCount(enCentral + 14 + 1);
  });

  test('la fecha recorta sólo «Cerrados»: lo pendiente de días atrás sigue en su cola', async ({
    page,
  }) => {
    await abrirBandeja(page);
    const pendientes = await tarjetas(page, 'Esperando al paciente').count();
    expect(pendientes).toBeGreaterThan(0);
    const cerradosHoy = await tarjetas(page, 'Cerrados').count();

    await page
      .getByRole('combobox', { name: 'Fechas de los pedidos cerrados' })
      .selectOption({ label: 'Todos' });
    await expect(page).toHaveURL(/[?&]closed=all/);

    expect(await tarjetas(page, 'Cerrados').count()).toBeGreaterThan(cerradosHoy);
    // Cambiar la fecha de lo cerrado no toca lo pendiente.
    await expect(tarjetas(page, 'Esperando al paciente')).toHaveCount(pendientes);
  });

  test('el tablero se desplaza de costado cuando las seis columnas no entran', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 680 });
    await abrirBandeja(page);

    const tablero = await page.locator('.bandeja__colas').evaluate((nodo) => ({
      overflowX: getComputedStyle(nodo).overflowX,
      ancho: nodo.clientWidth,
      contenido: nodo.scrollWidth,
    }));
    expect(tablero.overflowX).toBe('auto');
    expect(tablero.contenido).toBeGreaterThan(tablero.ancho);

    const pagina = await page.evaluate(() => ({
      ancho: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
    }));
    expect(pagina.ancho).toBeLessThanOrEqual(pagina.ventana);
  });

  test('evidencia visual: teléfono, ventana baja, escritorio, pantalla grande y oscuro', async ({
    page,
  }) => {
    await abrirBandeja(page);
    await page.getByRole('combobox', { name: 'Sede' }).selectOption({ label: SEDE_CON_COLUMNA_LLENA });
    await expect(tarjetas(page, 'En revisión')).toHaveCount(14);

    for (const [nombre, ancho, alto] of [
      ['01-telefono-375', 375, 812],
      ['02-ventana-baja-1280x680', 1280, 680],
      ['03-escritorio-1440', 1440, 900],
      ['04-pantalla-grande-2560', 2560, 1300],
    ] as const) {
      await page.setViewportSize({ width: ancho, height: alto });
      // Se recarga con el tamaño nuevo: el cambio en caliente deja el menú
      // lateral abierto como cajón y la captura no muestra el diseño de verdad.
      await page.reload();
      await expect(page.locator('[data-testid="bandeja"]')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('combobox', { name: 'Sede' }).selectOption({ label: SEDE_CON_COLUMNA_LLENA });
      await expect(tarjetas(page, 'En revisión')).toHaveCount(14);
      await capturar(page, nombre);
    }

    // El tema oscuro se pone como lo hace la app (`data-theme`), no con la
    // preferencia del sistema: varios átomos sólo responden al atributo.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await capturar(page, '05-escritorio-1440-oscuro');
  });
});
