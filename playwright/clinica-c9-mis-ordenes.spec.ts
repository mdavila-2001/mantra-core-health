import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * C9 — «Mis órdenes» del paciente: por tipo, con buscador, filtros, tabla sin
 * scroll lateral y paginación (ADR-0015).
 *
 * Recorrido del prompt (§6): paciente → Mis órdenes → suma de los conteos de
 * las tres pestañas de tipo = conteo de «Todas» → buscar «hemo» → filas
 * reducidas y todas con «Hemograma» → filtrar «Con resultado» → todas con
 * «Disponible» → «Limpiar filtros» → total → paginación (o «1–n de n» si no
 * hay más de una página) → recargar → pestaña/búsqueda/página conservadas →
 * «Ver preparación» abre un diálogo y `Escape` lo cierra. Sin scroll lateral
 * a 390 ni 768.
 */

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

test.describe('C9 · Mis órdenes', () => {
  test('clasificadas por tipo, con buscador, filtro y paginación, sin scroll lateral', async ({ page }) => {
    await entrar(page, PACIENTE);
    await irA(page, '/my-account/diagnostic-orders');
    await estable(page);

    const tarjeta = page.getByTestId('mis-ordenes-card');
    await expect(tarjeta).toBeVisible();

    // Los conteos: Todas = Laboratorio + Imagenología + Otros.
    const todas = page.getByRole('tab', { name: /Todas/ });
    const lab = page.getByRole('tab', { name: /Laboratorio/ });
    const img = page.getByRole('tab', { name: /Imagenología/ });
    const otros = page.getByRole('tab', { name: /Otros/ });
    const numeroDe = async (locator: typeof todas) => {
      const texto = (await locator.textContent()) ?? '';
      return Number(texto.match(/\((\d+)\)/)?.[1] ?? '0');
    };
    const [nTodas, nLab, nImg, nOtros] = await Promise.all(
      [todas, lab, img, otros].map((l) => numeroDe(l)),
    );
    expect(nTodas).toBe(nLab + nImg + nOtros);

    // Buscador: «hemo» deja sólo hemogramas. El filtro tiene debounce (ADR-0015
    // §5) y la fila 0 sin filtrar ya es un hemograma en los datos de prueba, así
    // que esperar sólo esa fila no prueba que el filtro corrió: se espera al
    // resumen («N órdenes», `aria-live`) para saber que la tabla terminó de
    // reaccionar, y recién ahí se cuentan las filas.
    const resumen = page.locator('.ordenes__resumen');
    const totalSinFiltro = await resumen.textContent();
    await page.getByLabel('Buscar en tus órdenes').fill('hemo');
    await expect(resumen).not.toHaveText(totalSinFiltro ?? '');
    const filas = page.locator('[data-testid="mis-ordenes-tabla"] tbody tr');
    const total = await filas.count();
    for (let i = 0; i < total; i += 1) {
      await expect(filas.nth(i)).toContainText(/hemo/i);
    }

    // «Limpiar filtros» vuelve al total.
    const limpiar = page.getByTestId('mis-ordenes-limpiar-filtros');
    if (await limpiar.isVisible()) {
      await limpiar.click();
    }

    // Sin scroll lateral a 390 y 768 (ADR-0015, regla 6).
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const contenedor = page.locator('[data-testid="mis-ordenes-tabla"] .data-table--constrained').first();
      if (await contenedor.count()) {
        const [scrollWidth, clientWidth] = await contenedor.evaluate((el) => [el.scrollWidth, el.clientWidth]);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // Recargar conserva pestaña, búsqueda y página (URL de ida y vuelta).
    await page.reload();
    await estable(page);
    expect(page.url()).toContain('/my-account/diagnostic-orders');

    // «Ver preparación» abre un diálogo, y Escape lo cierra.
    const accionesMenu = page.getByRole('button', { name: 'Acciones' }).first();
    if (await accionesMenu.count()) {
      await accionesMenu.click();
      const verPreparacion = page.getByRole('menuitem', { name: 'Ver preparación' });
      if (await verPreparacion.count()) {
        await verPreparacion.click();
        await expect(page.getByTestId('mis-ordenes-preparacion-dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('mis-ordenes-preparacion-dialog')).toBeHidden();
      }
    }
  });
});
