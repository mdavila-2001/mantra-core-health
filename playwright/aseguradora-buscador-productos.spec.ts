import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Buscador y filtros de «Productos y planes» en la ficha de una aseguradora
 * (30/09/2026), con la disciplina de tablas del ADR-0015:
 *
 * - regla 5: buscador multicampo y filtros por value set arriba;
 * - regla 6: la tabla de cláusulas no abre scroll lateral;
 * - el filtro vive en la URL: recargar reproduce la búsqueda.
 */
const SALIDA = join('docs', 'trabajo', '2026-09-30-aseguradora-buscador-productos', 'evidencia');
const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};
const FICHA = '/insurers-directory/seguros-andina';

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

/**
 * Regla 6: ni la sección ni la tabla de cláusulas se desplazan a lo ancho.
 *
 * Se mide la sección y no el documento: a 390 px la cabecera global de la app
 * (promociones, carrito, ajustes y cuenta) ya desborda en todas las pantallas,
 * y eso es de otra pieza.
 */
async function sinScrollLateral(page: Page): Promise<void> {
  const desbordes = await page.evaluate(() =>
    [
      document.querySelector('section[aria-label="Productos y planes"]'),
      ...document.querySelectorAll(
        '[data-testid="aseguradora-clausulas"] .data-table__scroll, [data-testid="aseguradora-clausulas"]',
      ),
    ]
      .filter((el): el is Element => el !== null)
      .map((el) => el.scrollWidth - el.clientWidth),
  );
  expect(desbordes.length).toBeGreaterThan(0);
  for (const desborde of desbordes) expect(desborde).toBeLessThanOrEqual(1);
}

for (const ancho of [1440, 390]) {
  test(`buscador y filtros acotan los planes a ${ancho} px`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    await page.setViewportSize({ width: ancho, height: ancho > 800 ? 1000 : 844 });

    await entrar(page, PACIENTE);
    await irA(page, FICHA);

    const planes = page.getByTestId('aseguradora-planes');
    await expect(planes).toBeVisible({ timeout: 30_000 });
    const filtros = page.getByTestId('aseguradora-filtros');
    await expect(filtros).toBeVisible();
    const buscador = filtros.getByRole('textbox', { name: 'Buscar un plan o una cobertura' });
    await expect(buscador).toBeVisible();
    const total = await page.getByTestId('aseguradora-oferta').count();
    expect(total).toBeGreaterThan(1);
    await filtros.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SALIDA, `${ancho}-1-barra.png`), animations: 'disabled' });
    await sinScrollLateral(page);

    // Un término que no está en nada: lo dice y ofrece volver.
    await buscador.fill('veterinaria');
    await expect(page.getByTestId('aseguradora-sin-coincidencias')).toBeVisible();
    await page.screenshot({
      path: join(SALIDA, `${ancho}-2-sin-coincidencias.png`),
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Ver todos los planes' }).click();
    await expect(page.getByTestId('aseguradora-oferta')).toHaveCount(total);

    // El filtro «Que cubra» acota las cláusulas y queda en la URL.
    const cobertura = filtros.getByRole('combobox', { name: 'Que cubra' });
    const opciones = await cobertura.locator('option').allTextContents();
    const elegida = opciones
      .map((o) => o.trim())
      .find((o) => o !== '' && o !== 'Cualquier cobertura');
    expect(elegida).toBeTruthy();
    await cobertura.selectOption({ label: elegida! });
    await expect(page).toHaveURL(/cobertura=/);
    await expect(page.getByTestId('aseguradora-cuantos')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('aseguradora-cuantos')).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole('tab')
      .nth(1)
      .click()
      .catch(() => page.getByRole('tab').first().click());
    const tabla = page.getByTestId('aseguradora-clausulas').first();
    await expect(tabla).toContainText(elegida!);
    await tabla.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(SALIDA, `${ancho}-3-filtro-cobertura.png`),
      animations: 'disabled',
    });
    await sinScrollLateral(page);

    expect(errores).toEqual([]);
  });
}
