import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

const SALIDA = join(
  'docs',
  'trabajo',
  '2026-09-23-cierre-local-reserva-cotizaciones',
  'evidencia',
  'capturas',
);

const VISTAS = [
  { nombre: '390', width: 390, height: 844 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

test.describe('Cierre local · reserva y Cotizaciones', () => {
  test('guarda Cotizaciones en tres anchos y dos temas', async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, PACIENTE);
    await irA(page, '/my-account/cotizaciones');
    await estable(page);
    await expect(page.getByRole('heading', { name: 'Cotizaciones' })).toBeVisible();

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const vista of VISTAS) {
        await page.setViewportSize(vista);
        if (vista.width <= 900) {
          await expect
            .poll(() =>
              page.locator('.app-side-nav').evaluate((elemento) => elemento.getBoundingClientRect().right),
            )
            .toBeLessThanOrEqual(0);
        }
        await expect(page.locator('main.cotizaciones')).toBeVisible();
        await page.screenshot({
          path: join(SALIDA, `cotizaciones-${vista.nombre}-${colorScheme}.png`),
          fullPage: true,
        });
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('el paciente navega Directorio y controla Cotizaciones con teclado', async ({ page }) => {
    test.setTimeout(180_000);

    await entrar(page, PACIENTE);
    await irA(page, '/directory');
    await estable(page);
    await expect(page.getByRole('heading', { name: 'Directorio de médicos' })).toBeVisible();

    const primeraEspecialidad = page.locator('.rejilla__tarjeta').first();
    await primeraEspecialidad.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/directory\?especialidad=/);

    await irA(page, '/my-account/cotizaciones');
    await estable(page);
    const busqueda = page.getByTestId('cotizaciones-busqueda');
    await busqueda.focus();
    await page.keyboard.type('tomografia');
    await expect(page.getByTestId('cotizaciones-resultados')).toContainText('Tomografía');
    await expect(page.getByTestId('cotizaciones-resultados')).not.toContainText('Paracetamol');

    const vertical = page.getByLabel('Vertical');
    await vertical.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(vertical).toHaveValue('MEDICAMENTOS');
  });

  test('cuatro toques sobre una especialidad abren una sola lista', async ({ page }) => {
    test.setTimeout(180_000);
    await entrar(page, PACIENTE);
    await irA(page, '/directory');
    await estable(page);
    const especialidad = page.locator('[data-testid="portada-especialidades"] .rejilla__tarjeta').first();
    const destino = await especialidad.getAttribute('href');
    expect(destino).toContain('?especialidad=');

    await page.evaluate(() => {
      const original = window.history.pushState.bind(window.history);
      let llamadas = 0;
      window.history.pushState = ((...argumentos: Parameters<History['pushState']>) => {
        llamadas += 1;
        window.sessionStorage.setItem('especialidad-push-state', String(llamadas));
        return original(...argumentos);
      }) as History['pushState'];
    });
    await especialidad.evaluate((elemento) => {
      for (let indice = 0; indice < 4; indice += 1) {
        elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });

    await expect(page).toHaveURL(new RegExp(`${destino!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('especialidad-push-state'))).toBe('1');
    mkdirSync(SALIDA, { recursive: true });
    await page.screenshot({ path: join(SALIDA, 'directorio-especialidad-navegacion-unica.png'), fullPage: true });
  });

  test('cuatro activaciones rápidas de un resultado navegan una sola vez', async ({ page }) => {
    test.setTimeout(180_000);
    const recursos: string[] = [];
    page.on('request', (solicitud) => recursos.push(new URL(solicitud.url()).pathname));

    await entrar(page, PACIENTE);
    await irA(page, '/directory');
    await estable(page);
    await page.locator('[data-testid="portada-especialidades"] .rejilla__tarjeta').first().click();

    const enlace = page.locator('.tarjeta-resultado__titulo a').first();
    await expect(enlace).toBeVisible();
    const destino = await enlace.getAttribute('href');
    expect(destino).not.toBeNull();
    recursos.length = 0;

    await page.evaluate(() => {
      const original = window.history.pushState.bind(window.history);
      let llamadas = 0;
      window.history.pushState = ((...argumentos: Parameters<History['pushState']>) => {
        llamadas += 1;
        window.sessionStorage.setItem('cierre-cotizaciones-push-state', String(llamadas));
        return original(...argumentos);
      }) as History['pushState'];
      window.sessionStorage.setItem('cierre-cotizaciones-push-state', String(llamadas));
    });

    const inicio = performance.now();
    await enlace.evaluate((elemento) => {
      for (let indice = 0; indice < 4; indice += 1) {
        elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    await expect(page).toHaveURL(new RegExp(`${destino!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));

    const medicion = await page.evaluate(() => ({
      pushState: Number(window.sessionStorage.getItem('cierre-cotizaciones-push-state')),
      url: `${window.location.pathname}${window.location.search}`,
    }));
    console.info(JSON.stringify({
      activaciones: 4,
      ms: Math.round(performance.now() - inicio),
      recursos: [...new Set(recursos)].sort(),
      ...medicion,
    }));
    expect(medicion.pushState).toBe(1);
  });

  test('mide las rutas actuales de Directorio y Cotizaciones', async ({ page }) => {
    test.setTimeout(180_000);
    await entrar(page, PACIENTE);

    const medir = async (ruta: string, titulo: string): Promise<number> => {
      const inicio = performance.now();
      await irA(page, ruta);
      await estable(page);
      await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
      return Math.round(performance.now() - inicio);
    };

    const directorioMs = await medir('/directory', 'Directorio de médicos');
    const cotizacionesMs = await medir('/my-account/cotizaciones', 'Cotizaciones');
    console.info(JSON.stringify({ directorioMs, cotizacionesMs }));
  });
});
