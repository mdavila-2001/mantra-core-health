/**
 * Prueba visual y funcional de «Superadministración › Catálogo de flujos».
 *
 * Por cada ancho (390/820/1440) y tema (claro/oscuro), con sesión de superadmin:
 *   1. la lista de flujos: contrato, casos sembrados y última corrida de cada uno;
 *   2. el detalle del flujo 2.7: el árbol con la decisión «con / sin seguro», cada
 *      llamada con su método y ruta y si el contrato la declara, los pasos sin
 *      endpoint, y cada rama con su caso y su veredicto;
 *   3. las pestañas Endpoints, Casos QA y Fuente;
 *   4. sin desborde horizontal de la página, sin errores de consola, sin 4xx/5xx
 *      inesperadas en `/admin/`.
 *
 * Contra el simulador (`E2E_MODO=demo`) además se mira el flujo 1.3, que trae un
 * endpoint ausente del contrato y una rama que pasó y otra que falló. Contra la API
 * real (`E2E_MODO=real`) las suites `FLOW-*` ya deben estar sembradas
 * (`SEED_QA_FLOWS=true yarn seed:boot`) y el contrato sale de las rutas montadas.
 *
 *   node playwright/superadmin-flujos-visual.mjs [carpeta-de-salida]
 *
 * Variables: `E2E_BASE_URL`, `E2E_MODO` (real|demo), `E2E_IDENTIFICADOR`, `E2E_CLAVE`,
 * `E2E_CHROMIUM`, `SOLO_VIEWPORT`, `SOLO_TEMA`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const MODO = process.env.E2E_MODO ?? 'demo';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'superadmin-flujos');
const CREDENCIAL = {
  identificador: process.env.E2E_IDENTIFICADOR ?? 'admin@alovida.mock',
  clave: process.env.E2E_CLAVE ?? 'S3cret-passw0rd',
};
/** Los flujos que la pantalla debe listar según el modo. */
const FLUJOS = MODO === 'real' ? ['1.3', '2.6', '2.7'] : ['1.3', '2.7'];
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
  // El administrador con los dos accesos pasa por el selector de portal: tres destinos legítimos.
  await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
  if (page.url().includes('/portal-selector')) {
    await page.getByRole('link', { name: /Portal de administración/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Agranda el viewport al alto del documento: con la barra lateral fija, `fullPage` repite pedazos. */
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

      // 1. Lista. (En el simulador no hay red que esperar: se espera la tabla.)
      await irA(page, '/superadmin/flows');
      await page.getByTestId('flows-table').waitFor({ timeout: 20_000 });
      await page.getByText(/^Flujo \d+\.\d+ · /).first().waitFor({ timeout: 20_000 });
      const tabla = (await page.getByTestId('flows-table').textContent()) ?? '';
      for (const flujo of FLUJOS) {
        if (!tabla.includes(`Flujo ${flujo}`)) falla(id, `la lista no muestra el flujo ${flujo}`);
      }
      if (!tabla.includes('en el contrato')) falla(id, 'la lista no dice cuántos endpoints están en el contrato');
      await captura(page, path.join(SALIDA, `lista-${id}.png`), viewport);

      // Filtrar por cobertura vuelve a pedir y cambia las filas
      if (MODO === 'demo') {
          await page.getByRole('combobox', { name: 'Cobertura' }).click();
        await page.getByRole('option', { name: 'Sin sembrar' }).click();
        await page.waitForTimeout(300);
        const soloSinSembrar = (await page.getByTestId('flows-table').textContent()) ?? '';
        if (soloSinSembrar.includes('Flujo 1.3')) falla(id, 'tras filtrar «Sin sembrar» sigue apareciendo el flujo 1.3, que está sembrado');
        await captura(page, path.join(SALIDA, `lista-filtrada-${id}.png`), viewport);
      }

      // 2. Detalle del 2.7: árbol
      await irA(page, '/superadmin/flows/2.7');
      await page.getByTestId('flow-summary').waitFor({ timeout: 20_000 });
      await page.getByTestId('flow-tree').waitFor({ timeout: 10_000 });
      const arbol = (await page.getByTestId('flow-tree').textContent()) ?? '';
      if (!arbol.includes('¿El paciente tiene seguro?')) falla(id, 'el árbol no muestra la decisión con / sin seguro');
      if (!/no tiene seguro/i.test(arbol) || !/tiene seguro \(simulación 2\)/i.test(arbol)) falla(id, 'el árbol no muestra las dos simulaciones');
      const endpoints27 = await page.locator('[data-testid^="flow-endpoint-"]').all();
      if (endpoints27.length === 0) falla(id, 'el 2.7 no muestra ninguna llamada con método y ruta');
      for (const ep of endpoints27) {
        const texto = ((await ep.textContent()) ?? '').trim();
        if (!/^(GET|POST|PUT|PATCH|DELETE) \//.test(texto)) falla(id, `un endpoint no muestra método y ruta: «${texto}»`);
        const nodo = (await ep.getAttribute('data-testid')).replace('flow-endpoint-', '');
        const contrato = ((await page.getByTestId(`flow-contract-${nodo}`).textContent()) ?? '').trim();
        if (!/^(En el contrato|No existe en el contrato)$/.test(contrato)) falla(id, `el nodo ${nodo} no dice si el contrato lo declara: «${contrato}»`);
        if (MODO === 'real' && contrato !== 'En el contrato') falla(id, `contra la API real el nodo ${nodo} debía estar en el contrato`);
      }
      const gaps27 = await page.locator('[data-testid^="flow-gap-"]').count();
      if (gaps27 === 0) falla(id, 'el 2.7 debía marcar al menos un paso sin endpoint (el QR por monto)');
      if (MODO === 'demo' && !(await page.getByTestId('flow-not-seeded').isVisible().catch(() => false))) {
        falla(id, 'el 2.7 de la maqueta no está sembrado y la pantalla no lo avisa');
      }
      await captura(page, path.join(SALIDA, `detalle-arbol-${id}.png`), viewport);

      // Plegar un nodo: aria-expanded cambia y su nombre pasa de «Contraer» a «Expandir»
      const plegar = page.locator('.arbol__plegar[aria-expanded="true"]').first();
      const nombre = (await plegar.getAttribute('aria-label')) ?? '';
      if (!nombre.startsWith('Contraer ')) falla(id, `el control de plegado no tiene nombre accesible: «${nombre}»`);
      await plegar.click();
      const plegado = page.getByRole('button', { name: nombre.replace('Contraer ', 'Expandir ') });
      if ((await plegado.first().getAttribute('aria-expanded')) !== 'false') falla(id, 'plegar un nodo no dejó aria-expanded="false"');
      await page.getByTestId('flow-tree-expand').click();

      // 3. Pestañas
      await page.getByRole('tab', { name: 'Endpoints', exact: true }).click();
      await page.getByTestId('flow-endpoints').waitFor({ timeout: 10_000 });
      const endpoints = (await page.getByTestId('flow-endpoints').textContent()) ?? '';
      if (!endpoints.includes('Sin endpoint')) falla(id, 'la pestaña Endpoints no marca los pasos sin endpoint');
      await captura(page, path.join(SALIDA, `detalle-endpoints-${id}.png`), viewport);

      await page.getByRole('tab', { name: 'Casos QA', exact: true }).click();
      await page.getByTestId('flow-cases').waitFor({ timeout: 10_000 });
      const casos = (await page.getByTestId('flow-cases').textContent()) ?? '';
      if (!casos.includes('FLOW-2.7-')) falla(id, 'la pestaña Casos QA no lista los casos del flujo');
      if (!(await page.getByTestId('flow-no-case').isVisible().catch(() => false))) falla(id, 'no se listan las ramas sin caso con su razón');
      await captura(page, path.join(SALIDA, `detalle-casos-${id}.png`), viewport);

      await page.getByRole('tab', { name: 'Fuente', exact: true }).click();
      await page.getByTestId('flow-source').waitFor({ timeout: 10_000 });
      if (!((await page.getByTestId('flow-source').textContent()) ?? '').includes('Registro de procesos')) falla(id, 'la pestaña Fuente no cita el Registro de procesos');
      await captura(page, path.join(SALIDA, `detalle-fuente-${id}.png`), viewport);

      // 4. Flujo 1.3 (en demo trae contrato ausente y veredictos)
      if (MODO === 'demo') {
        await irA(page, '/superadmin/flows/1.3');
        await page.getByTestId('flow-tree').waitFor({ timeout: 20_000 });
        const t13 = (await page.getByTestId('flow-tree').textContent()) ?? '';
        if (!t13.includes('No existe en el contrato')) falla(id, 'el 1.3 debía mostrar un endpoint ausente del contrato');
        if (!t13.includes('Falló · devolvió 200') || !t13.includes('Pasó · devolvió 200')) falla(id, 'el 1.3 debía mostrar una rama que falló y otra que pasó');
        await captura(page, path.join(SALIDA, `detalle-1-3-${id}.png`), viewport);
      }

      // 5. Un flujo que no existe: estado de error legible, sin datos
      await irA(page, '/superadmin/flows/9.9');
      await page.waitForTimeout(800);
      if (await page.getByTestId('flow-summary').isVisible().catch(() => false)) falla(id, 'un flujo inexistente mostró un resumen');
      await captura(page, path.join(SALIDA, `detalle-inexistente-${id}.png`), viewport);

      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (desborde > 1) falla(id, `desborde horizontal de ${desborde}px`);
      // El 404 del flujo inexistente es esperado: es lo que se está probando.
      const inesperadas = malas.filter((m) => !m.includes('/admin/qa/flows/9.9'));
      const consolaInesperada = consola.filter((c) => !/404|Not Found/.test(c));
      if (consolaInesperada.length) falla(id, `errores de consola: ${consolaInesperada.join(' | ')}`);
      if (inesperadas.length) falla(id, `respuestas 4xx/5xx: ${inesperadas.join(', ')}`);
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
