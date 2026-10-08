import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Contabilidad en dos pestañas (30/09/2026): «Resumen» para los tableros y
 * «Registros» para las tablas donde se carga. Antes eran una sola página larga
 * que mezclaba las dos cosas.
 *
 * Comprueba la separación en escritorio y en móvil, que el fondo es blanco y
 * que el contenido ocupa el ancho del área, y deja una foto de cada pestaña.
 */
const SALIDA = join('docs', 'trabajo', '2026-09-30-contabilidad-en-pestanas', 'evidencia');
const DOCTORA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

const VISTAS = [
  { nombre: '1440', ancho: 1440, alto: 900 },
  { nombre: '390', ancho: 390, alto: 844 },
] as const;

/**
 * Una foto de la pantalla entera. Con `fullPage` la barra lateral fija sale
 * cortada a media altura; con la ventana alta, en cambio, todo entra y la
 * barra ocupa lo que ocupa en pantalla.
 */
async function foto(
  page: Page,
  vista: (typeof VISTAS)[number],
  archivo: string,
  alto = 3400,
): Promise<void> {
  await page.setViewportSize({ width: vista.ancho, height: alto });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(SALIDA, archivo) });
  await page.setViewportSize({ width: vista.ancho, height: vista.alto });
}

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

for (const vista of VISTAS) {
  test(`tableros y registros van en pestañas separadas · ${vista.nombre} px`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    await page.setViewportSize({ width: vista.ancho, height: vista.alto });

    await entrar(page, DOCTORA);
    await irA(page, '/administration/accounting');

    const pestanas = page.getByRole('tab');
    await expect(pestanas.filter({ hasText: 'Resumen' })).toBeVisible({ timeout: 30_000 });
    await expect(pestanas.filter({ hasText: 'Registros' })).toBeVisible();

    /* ---- Resumen: tableros, ninguna tabla de carga -------------------- */
    await expect(page.getByTestId('contabilidad-numeros')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '¿Cuánto hizo?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lo que está pendiente' })).toBeVisible();
    await expect(page.getByTestId('contabilidad-registros')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo gasto' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Lo que tiene y lo que debe' })).toBeVisible();
    await foto(page, vista, `resumen-${vista.nombre}.png`);

    /* ---- Registros: tablas, ningún tablero ---------------------------- */
    await page.getByRole('tab', { name: 'Registros', exact: true }).click();
    const registros = page.getByTestId('contabilidad-registros');
    await expect(registros).toBeVisible({ timeout: 30_000 });
    await expect(registros.getByTestId('tabla-EXPENSE')).toContainText('Alquiler de septiembre', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('contabilidad-numeros')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '¿Cuánto hizo?' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Lo que está pendiente' })).toHaveCount(0);
    await foto(page, vista, `registros-${vista.nombre}.png`, 1100);

    /* ---- la regla visual: fondo blanco y ancho del área --------------- */
    const medida = await page.evaluate(() => {
      const principal = document.querySelector('.app-main__inner') ?? document.body;
      const caja = principal.getBoundingClientRect();
      const tarjeta = document
        .querySelector('[data-testid="contabilidad-registros"]')
        ?.getBoundingClientRect();
      // Lo que se sale del ancho del teléfono DENTRO del contenido, sin contar
      // lo que ya vive en una caja que se desplaza sola (la tira de pestañas).
      const vaFuera = Array.from(principal.querySelectorAll('*')).filter((el) => {
        if (el.getBoundingClientRect().right <= document.documentElement.clientWidth + 1) {
          return false;
        }
        for (let p = el.parentElement; p && p !== principal; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false;
        }
        return true;
      });
      return {
        fondo: getComputedStyle(document.body).backgroundColor,
        areaAncho: Math.round(caja.width),
        tarjetaAncho: Math.round(tarjeta?.width ?? 0),
        contenidoFuera: vaFuera.length,
      };
    });
    console.log(`[${vista.nombre}]`, JSON.stringify(medida));
    expect(medida.fondo).toBe('rgb(255, 255, 255)');
    expect(medida.contenidoFuera).toBe(0);
    // Ancho completo del área, descontado su relleno (2 × 40 px como mucho).
    expect(medida.tarjetaAncho).toBeGreaterThanOrEqual(medida.areaAncho - 96);

    expect(errores).toEqual([]);
  });
}
