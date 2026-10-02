import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Evidencia de navegador de la integración mockup → dev del 02/10/2026.
 *
 * Cubre lo que esa integración trae de visible:
 *  - #832 · «Frecuencia de facturación al seguro» en «Configurar tu perfil»,
 *    pestaña Facturación: UI → guardar → recarga → ficha (el simulador contesta en el navegador:
 *    no hay petición de red que observar en demo).
 *  - #828 · «Quincenal» entero en el formulario de cotización a 375 px.
 *
 * Corre contra `dev` en modo demo (`ng serve --configuration development,demo`),
 * donde el simulador contesta. Nunca esperar `networkidle` (CLAUDE.md §5).
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const FOTOS = join('docs', 'progress', 'evidence', 'sync-mockup-dev-2026-10-02');

test.beforeAll(() => mkdirSync(FOTOS, { recursive: true }));

test('#832 · la frecuencia de facturación se elige, se guarda, sobrevive a la recarga y sale en la ficha', async ({
  page,
}) => {
  // Errores de la propia aplicación: excepciones de página y respuestas >= 400
  // de su mismo origen. Los hosts externos (mapas, tipografías) no cuentan.
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    // `/glossary-data/` lo genera `yarn mock:glossary:shards` y está en .gitignore:
    // en un checkout limpio no existe, y no es de lo que se mide acá.
    if (r.status() >= 400 && r.url().startsWith(BASE) && !r.url().includes('/glossary-data/')) {
      errores.push(`${r.status()} ${r.url()}`);
    }
  });
  await entrarAlSimulador(page, 'medica', BASE);
  await page.goto(`${BASE}/my-account/edit`);
  await esperarAQueSeAsiente(page);

  await page.getByRole('tab', { name: /Facturaci/i }).click();
  const selector = page.getByTestId('edicion-frecuencia-facturacion-seguro');
  await expect(selector).toBeVisible();
  await expect(page.getByText('Frecuencia de facturación al seguro')).toBeVisible();
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'editar-facturacion-1440.png'), fullPage: true });

  // Las tres opciones, y sólo esas.
  const nativo = selector.locator('select');
  if ((await nativo.count()) > 0) {
    await expect(nativo.locator('option:not([value=""])')).toHaveText(['Semanal', 'Quincenal', 'Mensual']);
    await nativo.selectOption({ label: 'Quincenal' });
  } else {
    await selector.getByRole('combobox').click();
    await expect(page.getByRole('option')).toHaveText(['Semanal', 'Quincenal', 'Mensual']);
    await page.getByRole('option', { name: 'Quincenal' }).click();
  }

  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  // En demo el simulador contesta dentro del navegador: no hay petición de red
  // que observar. La prueba de que se guardó es la recarga de abajo.
  await esperarAQueSeAsiente(page);

  // Recarga completa: lo que se ve ahora viene de la persistencia, no del estado en memoria.
  await page.goto(`${BASE}/my-account/edit`);
  await esperarAQueSeAsiente(page);
  await page.getByRole('tab', { name: /Facturaci/i }).click();
  await expect(selector).toContainText('Quincenal');

  // La ficha.
  await page.goto(`${BASE}/my-account`);
  await esperarAQueSeAsiente(page);
  await page.getByRole('tab', { name: /Facturaci/i }).click();
  const ficha = page.getByTestId('perfil-factura-frecuencia-seguro');
  await expect(ficha).toContainText('Quincenal');
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'ficha-facturacion-1440.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'ficha-facturacion-375.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  expect(errores).toEqual([]);
});

test('#828 · «Quincenal» no se corta en el formulario de cotización a 375 px', async ({ page }) => {
  await entrarAlSimulador(page, 'medica', BASE);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/my-quotations/new`);
  await esperarAQueSeAsiente(page);

  const frecuencia = page.locator('.cotizacion__frecuencia');
  await expect(frecuencia).toBeVisible();
  await frecuencia.scrollIntoViewIfNeeded();
  await expect(frecuencia.getByText('Quincenal', { exact: false }).first()).toBeVisible();

  // Ningún rótulo del control queda cortado: el texto cabe en su caja.
  const cortados = await frecuencia.evaluate((raiz) =>
    Array.from(raiz.querySelectorAll<HTMLElement>('*'))
      .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent?.trim()),
  );
  expect(cortados).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(FOTOS, 'cotizacion-frecuencia-375.png'), fullPage: true });
});
