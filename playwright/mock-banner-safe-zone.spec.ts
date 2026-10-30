import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const axeSource = readFileSync(join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

async function revisarZona(page: Page, ruta: string, ancho: number, tema: 'light' | 'dark') {
  await page.setViewportSize({ width: ancho, height: ancho === 1440 ? 1000 : 844 });
  await page.goto(ruta);
  await esperarAQueSeAsiente(page);
  await expect(page.locator('main h1').first()).toBeVisible();

  const solapamientos = await page.evaluate(() => {
    const banner = document.querySelector<HTMLElement>('app-mock-banner .mock');
    if (!banner) throw new Error('No se encontró el aviso demo');
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const aviso = rect(banner);
    const contenido = [
      ...document.querySelectorAll(
        'main h1, main h2, main h3, main p, main button, main a, main input, main textarea, main label',
      ),
    ].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.height > 1 && getComputedStyle(element).visibility !== 'hidden';
    });
    const fijos = [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);
      return (
        !banner.contains(element) &&
        ['fixed', 'sticky'].includes(style.position) &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0.05 &&
        style.pointerEvents !== 'none'
      );
    });
    return {
      contenido: contenido.filter((element) => overlap(aviso, rect(element)) > 0).map((element) => element.outerHTML.slice(0, 180)),
      elementosFijos: fijos.filter((element) => overlap(aviso, rect(element)) > 0).map((element) => element.outerHTML.slice(0, 180)),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });

  expect(solapamientos, `${ruta}, ${ancho}px, ${tema}`).toEqual({
    contenido: [],
    elementosFijos: [],
    overflow: false,
  });

  await page.addScriptTag({ content: axeSource });
  const resultadoAxe = await page.evaluate(async () => {
    // @ts-expect-error -- axe se inyecta como script global para esta verificación.
    const { violations } = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    });
    return violations.map((violation: { id: string; impact: string; nodes: unknown[] }) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    }));
  });
  expect(resultadoAxe, `${ruta}, ${ancho}px, ${tema}: axe`).toEqual([]);
}

test('el aviso demo queda en zona libre en dashboard y mi cuenta', async ({ page }) => {
  // Arranca en claro, pero sólo la primera vez: el script corre en cada carga, y
  // si pisara el tema siempre, cada `goto` deshacía lo que el interruptor acaba
  // de cambiar y la vuelta a claro de abajo no podía cumplirse nunca.
  await page.addInitScript(() => {
    if (localStorage.getItem('mantra-core-health.theme') === null) {
      localStorage.setItem('mantra-core-health.theme', 'light');
    }
  });
  await entrarAlSimulador(page, 'paciente', '');
  const avisoHorario = page.locator('app-toast').filter({ hasText: 'Se liberó un horario' });
  if (await avisoHorario.count()) {
    await avisoHorario.getByTestId('toast-cerrar').click();
    await expect(avisoHorario).toBeHidden();
  }

  await revisarZona(page, '/dashboard', 1440, 'light');
  await revisarZona(page, '/my-account', 1440, 'light');
  await page.getByTestId('header-theme-toggle').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('dark');

  await revisarZona(page, '/dashboard', 1440, 'dark');
  await revisarZona(page, '/my-account', 1440, 'dark');
  await revisarZona(page, '/dashboard', 390, 'dark');
  await revisarZona(page, '/my-account', 390, 'dark');
  await page.getByTestId('header-theme-toggle').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('light');
  await revisarZona(page, '/dashboard', 390, 'light');
  await revisarZona(page, '/my-account', 390, 'light');

  const toggle = page.locator('app-mock-banner .mock__boton').first();
  await toggle.focus();
  await toggle.press('Space');
  await expect(toggle).toHaveAccessibleName('Ocultar');
  await expect(toggle).toBeFocused();
});
