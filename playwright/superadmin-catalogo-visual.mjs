/**
 * Prueba visual y funcional de «Superadministración › Catálogo de datos».
 *
 * Por cada ancho (390/820/1440) y tema (claro/oscuro), con sesión de superadmin:
 *   1. pestaña «Esquemas»: lista los schemas con su módulo; elegir uno muestra su
 *      negocio, su sistema y la nota de origen;
 *   2. la ficha de una tabla importada de la bóveda: badge de origen, aviso de
 *      plantilla, bloques Negocio / Por qué existe / Sistema, «Nota de la bóveda»
 *      de una clave foránea y la pestaña «Relaciones»;
 *   3. sin desborde horizontal, sin errores de consola, sin 4xx/5xx inesperadas.
 *
 * Contra la API real (`E2E_MODO=real`) se importó antes `iam` con
 * `yarn catalog:import-vault --apply --schema iam`; contra el simulador (demo) la
 * tabla importada es `clinical.conditions`.
 *
 *   node playwright/superadmin-catalogo-visual.mjs [carpeta-de-salida]
 *
 * Variables: `E2E_BASE_URL`, `E2E_MODO` (real|demo), `E2E_IDENTIFICADOR`, `E2E_CLAVE`,
 * `E2E_CHROMIUM`, `E2E_TABLA` (schema.tabla), `E2E_SCHEMA`, `SOLO_VIEWPORT`, `SOLO_TEMA`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const MODO = process.env.E2E_MODO ?? 'demo';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'superadmin-catalogo');
const CREDENCIAL = {
  identificador: process.env.E2E_IDENTIFICADOR ?? 'admin@alovida.mock',
  clave: process.env.E2E_CLAVE ?? 'S3cret-passw0rd',
};
const [SCHEMA_TABLA, NOMBRE_TABLA] = (process.env.E2E_TABLA ?? (MODO === 'real' ? 'iam.sessions' : 'clinical.conditions')).split('.');
const SCHEMA_VISTA = process.env.E2E_SCHEMA ?? SCHEMA_TABLA;
const VIEWPORTS = [
  { nombre: 'telefono', width: 390, height: 844 },
  { nombre: 'tableta', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 900 },
].filter((v) => !process.env.SOLO_VIEWPORT || v.nombre === process.env.SOLO_VIEWPORT);
const TEMAS = process.env.SOLO_TEMA ? [process.env.SOLO_TEMA] : ['light', 'dark'];

const fallos = [];
const falla = (donde, mensaje) => {
  fallos.push(`${donde}: ${mensaje}`);
  console.error(`  ✗ ${donde}: ${mensaje}`);
};

async function entrar(page) {
  await page.goto(`${BASE}/auth`);
  await page.waitForFunction(() => document.querySelector('app-root')?.children.length > 0, null, { timeout: 30_000 });
  await page.getByTestId('login-identifier').fill(CREDENCIAL.identificador);
  await page.getByTestId('login-password').fill(CREDENCIAL.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/**
 * Captura la página entera. Con la barra lateral fija, `fullPage` une pedazos y la
 * repite a mitad de la imagen; agrandar el viewport al alto del documento evita el
 * artefacto y muestra lo que de verdad se ve.
 */
async function captura(page, archivo, viewport) {
  const alto = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  await page.setViewportSize({ width: viewport.width, height: Math.min(Math.max(alto, viewport.height), 7000) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: archivo });
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
}

async function irA(page, ruta) {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

async function main() {
  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});

  for (const viewport of VIEWPORTS) {
    for (const tema of TEMAS) {
      const id = `${viewport.nombre}-${tema}`;
      console.log(`\n== ${id}`);
      const contexto = await navegador.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
        colorScheme: tema === 'dark' ? 'dark' : 'light',
      });
      await contexto.addInitScript(([k, v]) => {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          /* modo privado */
        }
      }, ['mantra-core-health.theme', tema]);
      const page = await contexto.newPage();
      const consola = [];
      const malas = [];
      page.on('console', (m) => m.type() === 'error' && consola.push(m.text().slice(0, 200)));
      page.on('pageerror', (e) => consola.push(`pageerror: ${String(e).slice(0, 200)}`));
      page.on('response', (r) => {
        if (r.status() >= 400 && /\/admin\//.test(r.url())) malas.push(`${r.status()} ${new URL(r.url()).pathname}`);
      });

      await entrar(page);

      // 1. Esquemas
      await irA(page, '/superadmin/data-catalog');
      await page.getByRole('tab', { name: 'Esquemas', exact: true }).click();
      await page.getByTestId('catalog-schemas').waitFor({ timeout: 20_000 });
      const filas = (await page.getByTestId('catalog-schemas').textContent()) ?? '';
      if (!filas.includes(SCHEMA_VISTA)) falla(id, `la tabla de esquemas no lista «${SCHEMA_VISTA}»`);
      if (!/M\d{2} · /.test(filas)) falla(id, 'ningún schema muestra su módulo de la bóveda');
      await captura(page, path.join(SALIDA, `esquemas-lista-${id}.png`), viewport);
      await page.getByTestId('catalog-schemas').getByText(SCHEMA_VISTA, { exact: true }).first().click();
      await page.getByTestId('catalog-schema-detail').waitFor({ timeout: 10_000 });
      const panel = (await page.getByTestId('catalog-schema-detail').textContent()) ?? '';
      if (!panel.includes('Negocio') || !panel.includes('Sistema') || !panel.includes('SALUD/Módulos/')) {
        falla(id, 'el panel del esquema no muestra negocio, sistema y fuente');
      }
      await captura(page, path.join(SALIDA, `esquemas-detalle-${id}.png`), viewport);

      // 2. Ficha de una tabla importada
      await page.getByTestId('catalog-schema-tables').click();
      await page.getByRole('tab', { name: 'Inventario', exact: true }).waitFor();
      await page.getByRole('link', { name: new RegExp(`${NOMBRE_TABLA}$`) }).first().click({ timeout: 20_000 });
      await page.getByTestId('object-tabs').waitFor({ timeout: 20_000 });
      await page.waitForTimeout(600);
      if (!(await page.getByTestId('object-origin').isVisible().catch(() => false))) falla(id, 'la ficha no muestra el origen «Importado de la bóveda»');
      if (!(await page.getByTestId('object-template-warning').isVisible().catch(() => false))) falla(id, 'la ficha no avisa que el texto es de plantilla');
      if (await page.getByTestId('object-approve').isVisible().catch(() => false)) falla(id, 'una ficha importada en borrador no debe poder aprobarse');
      const ficha = (await page.getByTestId('object-tabs').textContent()) ?? '';
      for (const bloque of ['Negocio', 'Por qué existe', 'Sistema']) if (!ficha.includes(bloque)) falla(id, `falta el bloque «${bloque}»`);
      await captura(page, path.join(SALIDA, `ficha-importada-${id}.png`), viewport);

      await page.getByRole('tab', { name: 'Columnas', exact: true }).click();
      const nota = page.getByTestId('object-fk-note').first();
      if (await nota.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await nota.click();
        await page.getByTestId('object-fk-note-text').first().waitFor({ timeout: 10_000 }).catch(() => falla(id, 'la nota de la FK no apareció'));
        const t = (await page.getByTestId('object-fk-note-text').first().textContent().catch(() => '')) ?? '';
        if (!/Apunta a →|no tiene una nota/.test(t)) falla(id, `texto inesperado en la nota de FK: «${t}»`);
      } else {
        falla(id, 'la tabla no tiene ninguna clave foránea para probar la nota');
      }
      await captura(page, path.join(SALIDA, `ficha-columnas-${id}.png`), viewport);

      await page.getByRole('tab', { name: 'Relaciones', exact: true }).click();
      await page.waitForTimeout(400);
      await captura(page, path.join(SALIDA, `ficha-relaciones-${id}.png`), viewport);

      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (desborde > 1) falla(id, `desborde horizontal de ${desborde}px`);
      if (consola.length) falla(id, `errores de consola: ${consola.join(' | ')}`);
      if (malas.length) falla(id, `respuestas 4xx/5xx: ${malas.join(', ')}`);
      console.log(`  ${fallos.some((f) => f.startsWith(id)) ? '✗' : '✓'} ${id}`);
      await contexto.close();
    }
  }

  await navegador.close();
  await writeFile(path.join(SALIDA, 'informe.json'), JSON.stringify({ modo: MODO, fallos }, null, 2), 'utf8');
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nSin fallos');
  process.exit(fallos.length ? 1 : 0);
}

await main();
