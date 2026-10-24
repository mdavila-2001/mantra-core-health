import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

const SALIDA = join('docs', 'refactor-profesional', 'trabajo', 'capturas', 'despues');
const MEDICA: Actor = {
  rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica',
};
const PACIENTE: Actor = {
  rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente',
};

async function sinDesborde(page: Page): Promise<void> {
  const { ancho, contenido, salientes } = await page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    const contenido = document.documentElement.scrollWidth;
    const salientes = [...document.querySelectorAll<HTMLElement>('body *')]
      .map((nodo) => ({
        selector: `${nodo.tagName.toLowerCase()}${nodo.className && typeof nodo.className === 'string' ? `.${nodo.className.trim().replaceAll(/\s+/g, '.')}` : ''}`,
        derecha: Math.round(nodo.getBoundingClientRect().right),
        ancho: Math.round(nodo.getBoundingClientRect().width),
      }))
      .filter((nodo) => nodo.derecha > ancho + 1)
      .sort((a, b) => b.derecha - a.derecha)
      .slice(0, 8);
    return { ancho, contenido, salientes };
  });
  expect(contenido, `desborde horizontal a ${ancho} px: ${JSON.stringify(salientes)}`).toBeLessThanOrEqual(ancho + 1);
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.evaluate(async () => {
    const finitas = document.getAnimations().filter((animacion) =>
      animacion.playState === 'running' &&
      animacion.effect?.getComputedTiming().endTime !== Infinity,
    );
    await Promise.race([
      Promise.all(finitas.map((animacion) => animacion.finished.catch(() => undefined))),
      new Promise<void>((resolver) => setTimeout(resolver, 900)),
    ]);
  });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: join(SALIDA, nombre), fullPage: true });
}

function luminancia(color: string): number {
  const canales = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  expect(canales).toHaveLength(3);
  const lineales = canales.map((valor) => {
    const canal = valor / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lineales[0]! + 0.7152 * lineales[1]! + 0.0722 * lineales[2]!;
}

async function contrasteMatriz(page: Page): Promise<void> {
  const celdas = await page.locator('.consultas-resumen__tabla td[data-intensidad]').evaluateAll(
    (nodos) => nodos.filter((nodo) => Number(nodo.getAttribute('data-intensidad')) > 0)
      .map((nodo) => ({
        nivel: nodo.getAttribute('data-intensidad'),
        fondo: getComputedStyle(nodo).backgroundColor,
        texto: getComputedStyle(nodo).color,
      })),
  );
  expect(celdas.length, 'la matriz debe contener datos').toBeGreaterThan(0);
  for (const celda of celdas) {
    const fondo = luminancia(celda.fondo);
    const texto = luminancia(celda.texto);
    const contraste = (Math.max(fondo, texto) + 0.05) / (Math.min(fondo, texto) + 0.05);
    expect(contraste, `contraste AA de intensidad ${celda.nivel}`).toBeGreaterThanOrEqual(4.5);
  }
}

test('panel de trabajo: teclado, contraste, ancho local de la matriz y movimiento reducido', async ({ page }) => {
  mkdirSync(SALIDA, { recursive: true });
  await entrar(page, MEDICA);
  await irA(page, '/dashboard');
  await estable(page);
  await expect(page.getByTestId('panel-consultas-resumen').locator('td[data-intensidad="4"]').first()).toBeVisible();

  await contrasteMatriz(page);
  const zona = page.getByTestId('panel-zona').first();
  const id = await zona.getAttribute('data-zona');
  await zona.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('panel-zona-volver')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator(`[data-zona="${id}"]`)).toBeFocused();

  await page.keyboard.press('Enter');
  await page.getByTestId('panel-zona-salto').first().click();
  await expect(page.getByTestId('panel-zona-volver')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('panel-zona-abierta')).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 700 });
  await sinDesborde(page);
  const scroll = page.locator('.consultas-resumen__tabla-scroll');
  await expect(scroll).toBeVisible();
  expect(await scroll.evaluate((nodo) => nodo.scrollWidth > nodo.clientWidth)).toBe(true);
  await capturar(page, 'panel-personal-320.png');

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await sinDesborde(page);
  await contrasteMatriz(page);
  expect(await page.getByTestId('panel-zona').first().evaluate((nodo) => getComputedStyle(nodo).animationName)).toBe('none');
  const marca = page.locator('.cinta__ahora');
  if (await marca.count()) {
    expect(await marca.evaluate((nodo) => getComputedStyle(nodo, '::after').animationName)).toBe('none');
  }
  await capturar(page, 'panel-personal-movil-oscuro.png');

  await page.setViewportSize({ width: 1440, height: 900 });
  await sinDesborde(page);
  await capturar(page, 'panel-personal-escritorio-oscuro.png');
});

test('panel de paciente: cita y referencias legibles en móvil y tema oscuro', async ({ page }) => {
  mkdirSync(SALIDA, { recursive: true });
  await entrar(page, PACIENTE);
  await irA(page, '/dashboard');
  await estable(page);
  await expect(page.getByTestId('mi-salud')).toBeVisible();
  await expect(page.getByTestId('mi-salud-sintomas')).toBeVisible();
  await expect(page.getByTestId('mi-salud-proxima-cita')).toBeVisible();

  for (const ancho of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width: ancho, height: ancho <= 390 ? 844 : 900 });
    await sinDesborde(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await capturar(page, 'panel-paciente-movil.png');

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await sinDesborde(page);
  await capturar(page, 'panel-paciente-movil-oscuro.png');
  await page.setViewportSize({ width: 1440, height: 900 });
  await capturar(page, 'panel-paciente-escritorio-oscuro.png');
});
