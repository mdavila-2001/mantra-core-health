/**
 * Prueba visual y funcional de «Superadministración › Observabilidad».
 *
 * Qué comprueba, por cada ancho (390/820/1440) y tema (claro/oscuro):
 *   1. el grupo «Superadministración» aparece en el menú con sus seis secciones;
 *   2. la pantalla pide `GET /admin/ops/traffic` y `/traffic/endpoints` (se espera
 *      la respuesta, nunca `networkidle`: con HMR no llega);
 *   3. el número de solicitudes que se ve es el `measured.requests` de esa
 *      respuesta, y los demás indicadores salen de la misma;
 *   4. las cuatro pestañas se renderizan y se capturan;
 *   5. no hay desborde horizontal del documento, ni errores de consola, ni
 *      respuestas 4xx/5xx inesperadas.
 *
 * Corre contra el backend simulado (`yarn start:demo`, `E2E_MODO=demo`) o contra la
 * API real (`E2E_MODO=real` + `E2E_BASE_URL` + `E2E_IDENTIFICADOR`/`E2E_CLAVE`). Un fallo sale con código 1.
 *
 *   node playwright/superadmin-observabilidad-visual.mjs [carpeta-de-salida]
 *
 * Variables: `E2E_BASE_URL`, `E2E_IDENTIFICADOR`, `E2E_CLAVE`, `E2E_CHROMIUM`,
 * `SOLO_VIEWPORT` (telefono|tableta|escritorio) y `SOLO_TEMA` (light|dark).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'superadmin-observabilidad');
const CREDENCIAL = {
  identificador: process.env.E2E_IDENTIFICADOR ?? 'admin@alovida.mock',
  clave: process.env.E2E_CLAVE ?? 'S3cret-passw0rd',
};
const VIEWPORTS = [
  { nombre: 'telefono', width: 390, height: 844 },
  { nombre: 'tableta', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 900 },
].filter((v) => !process.env.SOLO_VIEWPORT || v.nombre === process.env.SOLO_VIEWPORT);
const TEMAS = process.env.SOLO_TEMA ? [process.env.SOLO_TEMA] : ['light', 'dark'];
const PESTANAS = ['Resumen', 'Endpoints', 'Usuarios activos', 'No medido'];
const SECCIONES = ['Observabilidad', 'Catálogo de datos', 'Catálogo de flujos', 'Orquestación de pruebas', 'Analítica web', 'Operación'];

/**
 * `real` (API viva): se espera la respuesta de red y se compara contra lo que se ve.
 * `demo` (backend simulado): el simulador responde dentro de la aplicación, sin
 * red, así que no hay respuesta que esperar; se comprueba la coherencia interna
 * (el total es la suma de los endpoints) y se declara que no es red.
 */
const MODO = process.env.E2E_MODO ?? 'demo';

const fallos = [];
const falla = (donde, mensaje) => {
  fallos.push(`${donde}: ${mensaje}`);
  console.error(`  ✗ ${donde}: ${mensaje}`);
};

async function esperarApp(page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => document.querySelector('app-root')?.children.length > 0, null, { timeout: 30_000 });
}

async function entrar(page) {
  await page.goto(`${BASE}/auth`);
  await esperarApp(page);
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

/** Navega por el router (sin recargar: la sesión vive en memoria). */
async function irA(page, ruta) {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
}

async function main() {
  await mkdir(SALIDA, { recursive: true });
  // `E2E_CHROMIUM` apunta a un Chromium ya instalado cuando el que espera Playwright no está.
  const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
  const informe = [];

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

      // 1. El menú: el grupo y sus seis secciones. En teléfono el menú está plegado.
      const apertura = page.getByTestId('header-menu');
      const plegado = viewport.width < 1024;
      if (plegado) {
        // Tras el ingreso el encabezado puede tardar en pintarse: se espera, no se supone.
        await apertura.waitFor({ state: 'visible', timeout: 15_000 });
        await apertura.click();
        await page.waitForTimeout(400);
      }
      const grupo = page.getByText('Superadministración', { exact: true }).first();
      if (!(await grupo.isVisible().catch(() => false))) {
        falla(id, 'el grupo «Superadministración» no es visible en el menú');
      } else {
        await grupo.click().catch(() => undefined);
        // El grupo se despliega con una animación: `isVisible` no espera.
        await page.waitForTimeout(700);
        for (const seccion of SECCIONES) {
          const visible = await page.getByTestId('nav-enlace').filter({ hasText: seccion }).first().isVisible().catch(() => false);
          if (!visible) falla(id, `falta «${seccion}» en el grupo «Superadministración»`);
        }
        await page.screenshot({ path: path.join(SALIDA, `menu-${id}.png`) });
        if (plegado) await page.keyboard.press('Escape');
      }

      // 2-3. La pantalla y sus números.
      const trafico =
        MODO === 'real'
          ? page.waitForResponse((r) => new URL(r.url()).pathname === '/admin/ops/traffic' && r.request().method() === 'GET')
          : null;
      const endpoints =
        MODO === 'real' ? page.waitForResponse((r) => new URL(r.url()).pathname === '/admin/ops/traffic/endpoints') : null;
      await irA(page, '/superadmin/observability');
      await page.getByTestId('observability-requests').waitFor({ timeout: 30_000 });
      const entero = (n) => Number(n).toLocaleString('es-BO');
      const verEn = async (testId) => ((await page.getByTestId(testId).textContent().catch(() => '')) ?? '').replace(/\s/g, ' ').trim();

      if (MODO === 'real') {
        const [rt, re] = await Promise.all([trafico, endpoints]);
        if (rt.status() !== 200) falla(id, `traffic respondió ${rt.status()}`);
        if (re.status() !== 200) falla(id, `traffic/endpoints respondió ${re.status()}`);
        const cuerpo = await rt.json().catch(() => null);
        if (cuerpo?.measured) {
          const m = cuerpo.measured;
          const pedido = [
            ['observability-requests', entero(m.requests)],
            ['observability-succeeded', entero(m.succeeded)],
            ['observability-failed', entero(m.failed.client4xx + m.failed.server5xx)],
          ];
          for (const [testId, esperado] of pedido) {
            const visto = await verEn(testId);
            if (!visto.includes(esperado)) falla(id, `${testId}: se ve «${visto}» y la respuesta dice ${esperado}`);
          }
          informe.push({ id, modo: MODO, solicitudes: m.requests, exitosas: m.succeeded, fallidas: m.failed, p95: m.latencyMs.p95 });
        } else {
          falla(id, 'la respuesta de traffic no trae `measured`');
        }
      } else {
        // Coherencia interna: solicitudes = exitosas + fallidas.
        const num = (t) => Number(t.replace(/[^\d]/g, ''));
        const vistas = num(await verEn('observability-requests'));
        const ok = num(await verEn('observability-succeeded'));
        const mal = num((await verEn('observability-failed')).split(' ')[0] ?? '');
        if (vistas !== ok + mal) falla(id, `solicitudes ${vistas} ≠ exitosas ${ok} + fallidas ${mal}`);
        informe.push({ id, modo: MODO, solicitudes: vistas, exitosas: ok, fallidas: mal });
      }

      // 4. Las cuatro pestañas.
      for (const [i, nombre] of PESTANAS.entries()) {
        await page.getByRole('tab', { name: nombre, exact: true }).click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(SALIDA, `observabilidad-${i + 1}-${nombre.toLowerCase().replace(/\s+/g, '-')}-${id}.png`), fullPage: true });
        if (nombre === 'Endpoints') {
          const tabla = (await page.getByTestId('observability-endpoints').textContent().catch(() => '')) ?? '';
          if (!tabla.includes('/')) falla(id, 'la tabla de endpoints no muestra rutas');
          if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(tabla)) falla(id, 'la tabla de endpoints muestra un UUID');
        }
      }

      // 5. Desborde, consola y red.
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (desborde > 1) falla(id, `desborde horizontal de ${desborde}px`);
      if (consola.length) falla(id, `errores de consola: ${consola.join(' | ')}`);
      if (malas.length) falla(id, `respuestas 4xx/5xx: ${malas.join(', ')}`);
      if (MODO === 'demo') console.log('  (modo demo: el simulador responde sin red; no hay respuesta HTTP que contrastar)');
      console.log(`  ${fallos.some((f) => f.startsWith(id)) ? '✗' : '✓'} ${id}`);
      await contexto.close();
    }
  }

  await navegador.close();
  await writeFile(path.join(SALIDA, 'informe.json'), JSON.stringify({ informe, fallos }, null, 2), 'utf8');
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nSin fallos');
  process.exit(fallos.length ? 1 : 0);
}

await main();
