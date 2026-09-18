import { test, expect, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Refactor UX profesional (kit `docs/refactor-profesional/`, fases 06–10).
 *
 * Comprueba en la aplicación corriendo —rama `mockup`, backend simulado— lo que
 * el refactor promete, no el DOM de una prueba unitaria:
 *
 * - Piloto «Mis citas» (R-01…R-03 del mapa UX): la acción principal y la
 *   próxima cita dentro de la primera pantalla, próximas antes que anteriores,
 *   filtros plegables en teléfono y el foco al pedir una cita.
 * - H-01: el cajón del menú a 390 px no vuelve a lanzar `NotFoundError`.
 * - H-09: la tabla de Consultas no esconde acciones a 1440 px y ninguna fila
 *   se nombra por su uuid.
 *
 * `E2E_BASE_URL=http://localhost:4310 yarn pw playwright/refac-ux-profesional.spec.ts --workers=1`
 */

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

const VIEWPORTS = [
  { nombre: 'movil', ancho: 375, alto: 812 },
  { nombre: 'tablet', ancho: 768, alto: 1024 },
  { nombre: 'escritorio', ancho: 1440, alto: 900 },
] as const;

const EVIDENCIA = 'docs/refactor-profesional/trabajo/capturas/e2e';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * El único error preexistente conocido: bajo `ng serve` la CSP con hash bloquea
 * un script en línea que inyecta el servidor de desarrollo. Aparece en la
 * primera carga de cualquier ruta, y este refactor no toca `index.html`,
 * `angular.json` ni el servidor SSR, que son quienes lo producen (hallazgo
 * H-14). Se excluye ESTE mensaje y ningún otro.
 */
const CSP_DEL_SERVIDOR_DE_DESARROLLO =
  /Executing inline script violates the following Content Security Policy/;

/** Errores de consola de la página, para afirmar que no hubo ninguno. */
function juntarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    if (CSP_DEL_SERVIDOR_DE_DESARROLLO.test(mensaje.text())) return;
    errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));
  return errores;
}

async function abrirMisCitas(page: Page): Promise<void> {
  await irA(page, '/my-account/appointments');
  await expect(page.getByTestId('turnos-lista-upcoming')).toBeVisible({ timeout: 20_000 });
}

async function desbordaHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe('refactor UX · piloto «Mis citas»', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.nombre}: la acción y la próxima cita, en la primera pantalla`, async ({ page }) => {
      const errores = juntarErrores(page);
      await page.setViewportSize({ width: vp.ancho, height: vp.alto });
      await entrar(page, PACIENTE);
      await abrirMisCitas(page);

      const pedir = page.getByTestId('turnos-pedir');
      await expect(pedir).toBeVisible();
      await expect(pedir).toHaveText('Pedir una cita');
      const cajaBoton = await pedir.boundingBox();
      expect(cajaBoton, 'el botón tiene caja').not.toBeNull();
      expect((cajaBoton?.y ?? 0) + (cajaBoton?.height ?? 0)).toBeLessThanOrEqual(vp.alto);

      const primera = page.getByTestId('turnos-lista-upcoming').locator('li').first();
      const cajaCita = await primera.boundingBox();
      expect(cajaCita?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(vp.alto);

      // Próximas antes que Anteriores, en el orden del documento.
      const titulos = page.locator('.turnos__grupo-titulo');
      await expect(titulos.first()).toContainText('Próximas');
      if ((await titulos.count()) > 1) {
        await expect(titulos.nth(1)).toContainText('Anteriores');
      }

      expect(await desbordaHorizontal(page)).toBe(false);
      await page.screenshot({ path: `${EVIDENCIA}/mis-citas-${vp.ancho}.png`, fullPage: true });
      expect(errores).toEqual([]);
    });
  }

  test('teclado: «Pedir una cita» deja el foco en «Agendar una cita»', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, PACIENTE);
    await abrirMisCitas(page);

    await page.getByTestId('turnos-pedir').focus();
    await page.keyboard.press('Enter');

    const destino = page.getByRole('heading', { name: 'Agendar una cita' });
    await expect(destino).toBeFocused();
    await expect(destino).toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('turnos-tipo-profesional')).toBeFocused();
  });

  test('teléfono: «Más filtros» pliega y despliega estado y fechas', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, PACIENTE);
    await abrirMisCitas(page);

    const mas = page.getByTestId('turnos-mas-filtros');
    await expect(mas).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('turnos-filtro-estado')).toBeHidden();

    await mas.focus();
    await page.keyboard.press('Enter');

    await expect(mas).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('turnos-filtro-estado')).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}/mis-citas-375-filtros.png` });
  });

  test('escritorio: los filtros no recortan su contenido', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, PACIENTE);
    await abrirMisCitas(page);

    await expect(page.getByTestId('turnos-mas-filtros')).toBeHidden();
    const recortados = await page
      .getByTestId('turnos-filtros')
      .locator('input, button')
      .evaluateAll(
        (nodos) =>
          nodos.filter(
            (nodo) =>
              (nodo as HTMLElement).offsetParent !== null &&
              nodo.scrollWidth > nodo.clientWidth + 1,
          ).length,
      );
    expect(recortados).toBe(0);
  });

  test('H-15: filas parejas de filtros — 2 × 2 a 768 y una sola fila a 1280', async ({ page }) => {
    await entrar(page, PACIENTE);
    /** Cuántas filas distintas ocupan buscador, estado, desde y hasta. */
    const filas = async (): Promise<number> =>
      page.getByTestId('turnos-filtros').evaluate((barra) => {
        const campos = [
          barra.querySelector('.turnos__buscador'),
          ...barra.querySelectorAll('.turnos__filtro-campo'),
        ];
        // Por el borde inferior: el buscador no tiene rótulo visible y su tope
        // cae más abajo que el de los campos rotulados de la misma fila.
        return new Set(
          campos.map((campo) => Math.round(campo?.getBoundingClientRect().bottom ?? 0)),
        ).size;
      });

    await page.setViewportSize({ width: 768, height: 1024 });
    await abrirMisCitas(page);
    expect(await filas()).toBe(2);

    await page.setViewportSize({ width: 1280, height: 800 });
    await abrirMisCitas(page);
    expect(await filas()).toBe(1);
  });

  test('oscuro: la vista se pinta con el tema del sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, PACIENTE);
    await abrirMisCitas(page);
    await page.screenshot({ path: `${EVIDENCIA}/mis-citas-1440-oscuro.png` });
  });

  test('Mis órdenes → «Reservar hora» abre Mis citas en modo laboratorio', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, PACIENTE);
    await irA(page, '/my-account/diagnostic-orders');

    const reservar = page.getByTestId('orden-reservar').first();
    await expect(reservar).toBeVisible({ timeout: 20_000 });
    await expect(reservar).toHaveAttribute('aria-label', /^Reservar hora en un laboratorio: .+/);
    await reservar.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/my-account\/appointments\?resource=lab/);
    await expect(page.getByTestId('turnos-tipo-laboratorio')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Agendar una cita' })).toBeFocused();
    await expect(
      page.getByText('Elegí un laboratorio para ver los horarios libres.'),
    ).toBeVisible();
  });
});

test.describe('refactor UX · regresiones corregidas', () => {
  test('H-01: el cajón a 390 px no lanza NotFoundError y aloja el selector', async ({ page }) => {
    const errores = juntarErrores(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page, MEDICA);
    for (const ruta of ['/dashboard', '/schedule', '/my-account']) {
      await irA(page, ruta);
      await estable(page);
    }
    await expect(page.locator('.app-side-nav .app-tenant-switcher')).toHaveCount(1);
    expect(errores.filter((texto) => texto.includes('insertBefore'))).toEqual([]);
  });

  test('H-09: Consultas no esconde columnas a 1440 y nombra las filas sin uuid', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, MEDICA);
    await irA(page, '/schedule');
    const scroll = page.locator('.data-table__scroll').first();
    await expect(scroll).toBeVisible({ timeout: 20_000 });

    const ocultos = await scroll.evaluate((caja) => caja.scrollWidth - caja.clientWidth);
    expect(ocultos).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${EVIDENCIA}/consultas-1440.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    const nombres = await page
      .locator('.data-table__detail-toggle')
      .evaluateAll((botones) => botones.map((boton) => boton.getAttribute('aria-label') ?? ''));
    expect(nombres.length).toBeGreaterThan(0);
    for (const nombre of nombres) {
      expect(nombre).not.toMatch(UUID);
    }
  });
});
