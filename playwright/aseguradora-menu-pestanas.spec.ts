import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * La cuenta aseguradora (01/10/2026), cuatro pedidos del propietario:
 *
 * 1. «Administración» deja de ser un desplegable: sus opciones van a nivel 0;
 * 2. el catálogo muestra un producto seguro por página, con número de página
 *    elegible;
 * 3. el tablero de siniestralidad se organiza en pestañas, con rejilla;
 * 4. una pestaña «Por persona» genera el informe de siniestralidad y lo exporta.
 *
 * Corre contra la maqueta de `mockup` (sin backend): `E2E_BASE_URL` apunta al
 * `ng serve`.
 */
const SALIDA = join('docs', 'trabajo', '2026-10-01-aseguradora-menu-pestanas', 'evidencia');
const ASEGURADORA: Actor = {
  rol: 'administrador',
  identificador: 'aseguradora@alovida.mock',
  clave: 'mock',
  nombre: 'Aseguradora',
};

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

async function sinScrollLateral(page: Page, selector: string): Promise<void> {
  const desborde = await page.evaluate(
    (sel) => {
      const el = document.querySelector(sel);
      return el === null ? null : el.scrollWidth - el.clientWidth;
    },
    selector,
  );
  expect(desborde, `no existe ${selector}`).not.toBeNull();
  expect(desborde!).toBeLessThanOrEqual(1);
}

for (const ancho of [1440, 390]) {
  test(`la cuenta aseguradora a ${ancho} px`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    await page.setViewportSize({ width: ancho, height: ancho > 800 ? 900 : 844 });

    await entrar(page, ASEGURADORA);

    // 1 · La barra: ningún desplegable, las cinco opciones a nivel 0.
    if (ancho > 800) {
      await expect(page.locator('.app-side-nav__group')).toHaveCount(0);
      const rutas = await page
        .locator('[data-testid="nav-enlace"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('data-route')));
      expect(rutas).toEqual([
        '/my-account',
        '/notification-center',
        '/administration/insurance',
        '/administration/insurance-analytics',
        '/administration/received-claims',
        '/administration/insurance-patients',
        '/administration/insurance-campaigns',
        '/administration/my-organization',
      ]);
      await page.screenshot({ path: join(SALIDA, `${ancho}-1-barra-plana.png`), animations: 'disabled' });
    }

    // 2 · El catálogo: un producto seguro por página.
    await irA(page, '/administration/insurance');
    await expect(page.locator('.catalog__plan-title')).toHaveCount(1, { timeout: 30_000 });
    const primero = (await page.locator('.catalog__plan-title').first().innerText()).trim();
    const paginador = page.getByRole('navigation', { name: 'Paginación' });
    await expect(paginador).toBeVisible();
    await expect(page.getByRole('button', { name: 'Página 2' })).toBeVisible();
    await expect(page.getByLabel('Ir a la página')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, `${ancho}-2-catalogo-pagina-1.png`), animations: 'disabled' });

    await page.getByRole('button', { name: 'Página 2' }).click();
    await expect(page.locator('.catalog__plan-title')).toHaveCount(1);
    // Con reintento: el título se repinta un instante después del clic.
    await expect(page.locator('.catalog__plan-title').first()).not.toHaveText(primero);
    await expect(page.locator('.pagination__range')).toContainText('2–2 de');
    await page.screenshot({ path: join(SALIDA, `${ancho}-3-catalogo-pagina-2.png`), animations: 'disabled' });
    await sinScrollLateral(page, '.catalog');

    // 3 · El tablero: pestañas y rejilla.
    await irA(page, '/administration/insurance-analytics');
    const pestanas = page.getByRole('tab');
    await expect(pestanas).toHaveText(['Resumen', 'Gasto y farmacia', 'Población', 'Por persona'], {
      timeout: 30_000,
    });
    await expect(page.getByTestId('kpi-loss-ratio')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, `${ancho}-4-tablero-resumen.png`), animations: 'disabled' });

    await pestanas.nth(1).click();
    await expect(page).toHaveURL(/tab=spend/);
    await expect(page.getByTestId('table-top-medications')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, `${ancho}-5-tablero-gasto.png`), animations: 'disabled' });

    await pestanas.nth(2).click();
    await expect(page.getByTestId('section-immunization')).toBeVisible();
    const paneles = page.locator('.analytics__panel');
    await expect(paneles).toHaveCount(3);
    if (ancho > 800) {
      // Rejilla: las dos primeras tarjetas comparten fila, a la misma altura de borde.
      const cajas = await paneles.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), height: Math.round(r.height) };
        }),
      );
      expect(Math.abs(cajas[0]!.top - cajas[1]!.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(cajas[0]!.height - cajas[1]!.height)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: join(SALIDA, `${ancho}-6-tablero-poblacion.png`), animations: 'disabled' });
    await sinScrollLateral(page, '.analytics');

    // 4 · El informe por persona: se genera, se lee y se exporta.
    await pestanas.nth(3).click();
    await expect(page).toHaveURL(/tab=by-person/);
    await expect(page.getByText('Todavía no generaste el informe')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, `${ancho}-7-por-persona-vacio.png`), animations: 'disabled' });

    await page.getByTestId('btn-generate-person-report').click();
    const tabla = page.getByTestId('table-person-loss');
    await expect(tabla).toBeVisible({ timeout: 30_000 });
    expect(await tabla.locator('tbody tr').count()).toBeGreaterThan(1);
    await page.screenshot({ path: join(SALIDA, `${ancho}-8-por-persona-informe.png`), animations: 'disabled' });

    const descarga = page.waitForEvent('download');
    await page.getByTestId('btn-export-person-report').click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^siniestralidad-por-persona-.*\.csv$/);
    const ruta = join(SALIDA, `${ancho}-informe-por-persona.csv`);
    await archivo.saveAs(ruta);
    const cabecera = readFileSync(ruta, 'utf8').split(/\r?\n/)[0]!;
    expect(cabecera).toContain('Persona');
    expect(cabecera).toContain('Siniestralidad %');

    // El informe sobrevive al cambio de pestaña.
    await pestanas.nth(0).click();
    await pestanas.nth(3).click();
    await expect(tabla).toBeVisible();

    // Cambiar el período marca el informe como del filtro anterior.
    await page.getByTestId('segmentado-90d').click();
    await expect(page.getByTestId('person-report-stale')).toBeVisible({ timeout: 30_000 });
    await sinScrollLateral(page, '.analytics');

    expect(errores).toEqual([]);
  });
}
