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

/**
 * Segunda tanda de la integración mockup → dev: #837 y #841.
 * (Los otros cuatro cambios ya traen sus propios specs: horarios-otros-servicios
 * y registro-doctor-universidad-y-profesiones.)
 */

test('#841 · los idiomas se eligen en el editor, se guardan, sobreviven a la recarga y salen en la ficha', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE) && !r.url().includes('/glossary-data/')) {
      errores.push(`${r.status()} ${r.url()}`);
    }
  });

  await entrarAlSimulador(page, 'medica', BASE);
  await page.goto(`${BASE}/my-account/edit`);
  await esperarAQueSeAsiente(page);
  await page.getByRole('tab', { name: /Credenciales/i }).click();

  const bloque = page.getByTestId('edicion-idiomas');
  await expect(bloque).toBeVisible();
  await expect(bloque.getByText('Idiomas en los que atiende')).toBeVisible();
  await bloque.scrollIntoViewIfNeeded();
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'idiomas-editor-antes-1440.png'), fullPage: true });

  // Agrega una fila y elige un idioma que la médica no tenga todavía.
  const filasAntes = await bloque.locator('[data-testid^="idioma-select-"]').count();
  await page.getByTestId('agregar-idioma').click();
  const nuevo = page.getByTestId(`idioma-select-${filasAntes}`).locator('select');
  const candidatos = await nuevo.locator('option:not([value=""])').allTextContents();
  const elegido = candidatos.find((t) => /guaran|quechua|aymara|portugu|franc/i.test(t)) ?? candidatos[0]!;
  await nuevo.selectOption({ label: elegido });
  await page.screenshot({ path: join(FOTOS, 'idiomas-editor-elegido-1440.png'), fullPage: true });

  await expect(page.getByRole('button', { name: 'Guardar idiomas' })).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar idiomas' }).click();
  await esperarAQueSeAsiente(page);

  // Recarga completa: lo que se ve viene de la persistencia, no de la memoria.
  await page.goto(`${BASE}/my-account/edit`);
  await esperarAQueSeAsiente(page);
  await page.getByRole('tab', { name: /Credenciales/i }).click();
  await expect(page.getByTestId(`idioma-select-${filasAntes}`).locator('select option:checked')).toHaveText(elegido);

  // La ficha lo muestra.
  await page.goto(`${BASE}/my-account`);
  await esperarAQueSeAsiente(page);
  await page.getByRole('tab', { name: /Credenciales/i }).click();
  await expect(page.getByText(elegido, { exact: false }).first()).toBeVisible();
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'idiomas-ficha-1440.png'), fullPage: true });

  expect(errores).toEqual([]);
});

test('#837 · el mapa del directorio de laboratorios va debajo de los resultados', async ({ page }) => {
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(`${BASE}/laboratory-directory`);
  await esperarAQueSeAsiente(page);

  // `testId` de `app-department-map` y `data-testid` caen en elementos distintos
  // (CLAUDE.md §5): se apunta a la sección que lo envuelve.
  const mapa = page.locator('section.mapa-directorio');
  await expect(mapa).toBeVisible();
  await expect(mapa).toHaveAttribute('aria-label', 'Filtrar por departamento');

  // Orden vertical: las tarjetas de centros empiezan antes que el mapa.
  const tarjeta = page.getByText('Laboratorio clínico', { exact: true }).first();
  await expect(tarjeta).toBeVisible();
  const yTarjeta = (await tarjeta.boundingBox())!.y;
  const yMapa = (await mapa.boundingBox())!.y;
  expect(yTarjeta, 'las tarjetas deben quedar arriba del mapa').toBeLessThan(yMapa);

  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'laboratorios-mapa-al-final-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await esperarAQueSeAsiente(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(FOTOS, 'laboratorios-mapa-al-final-375.png'), fullPage: true });
});
