/**
 * Capturas de antes y después del rediseño del paciente (22/10/2026).
 *
 *   node playwright/paciente-redisenio-capturas.mjs --base http://localhost:4301 --out <carpeta>
 *
 * Entra como `paciente@alovida.mock` (la maqueta acepta cualquier contraseña no
 * vacía), recorre las pantallas del paciente y fotografía cada una a 1440 y a
 * 390 px. Oculta el aviso «Modo de demostración», que no es parte del producto.
 * Navega dentro de la SPA después de entrar: un F5 perdería la sesión del
 * simulador. Con `--tema oscuro` fija el tema antes de entrar.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, valor, indice, todos) => {
    if (valor.startsWith('--')) pares.push([valor.slice(2), todos[indice + 1]]);
    return pares;
  }, []),
);
const base = args.base ?? 'http://localhost:4300';
const out = args.out ?? 'artifacts/paciente-redisenio';
const tema = args.tema ?? 'claro';
const solo = args.solo ? args.solo.split(',') : null;
// `--cuenta medica@alovida.mock` sirve para comprobar que otro rol NO cambió.
const cuenta = args.cuenta ?? 'paciente@alovida.mock';

const PANTALLAS = [
  ['inicio', '/dashboard'],
  ['mis-citas', '/my-account/appointments'],
  ['historia', '/my-account/medical-record'],
  ['farmacia', '/my-account/pharmacy'],
  ['mi-perfil', '/my-account'],
  ['directorios', '/directories'],
  ['medicos', '/directory'],
  ['resultados', '/my-account/diagnostic-results'],
  ['tutoriales', '/tutorials'],
  ['chats', '/messaging'],
  ['dependientes', '/my-account/dependents'],
];

// Las del médico (rediseño del 22/10/2026, mismo tratamiento que el paciente).
const PANTALLAS_MEDICO = [
  ['panel', '/dashboard'],
  ['mi-perfil', '/my-account'],
  ['notificaciones', '/notification-center'],
  ['directorios', '/directories'],
  ['consultas', '/schedule'],
  ['archivo-clinico', '/medical-records'],
  ['glosario', '/glossary'],
  ['formularios', '/form-builder'],
  ['mis-servicios', '/my-services'],
  ['cotizaciones', '/my-quotations'],
  ['contabilidad', '/administration/accounting'],
  ['chats', '/messaging'],
  ['tutoriales', '/tutorials'],
];

const ANCHOS = [
  [1440, 900],
  [390, 844],
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [ancho, alto] of ANCHOS) {
    const context = await browser.newContext({ viewport: { width: ancho, height: alto } });
    const page = await context.newPage();
    await page.addInitScript((valor) => {
      try {
        localStorage.setItem('mantra-core-health.theme', valor === 'oscuro' ? 'dark' : 'light');
      } catch {
        /* sin almacenamiento, se queda en el tema del sistema */
      }
    }, tema);
    await page.goto(`${base}/auth`);
    await page.getByTestId('login-identifier').fill(cuenta, { timeout: 60_000 });
    const clave = page.locator('input[type=password]');
    await clave.fill('demo');
    await clave.press('Enter');
    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    await page.addStyleTag({ content: '[aria-label="Modo de demostración"]{display:none!important}' });

    for (const [nombre, ruta] of cuenta.startsWith('medica') ? PANTALLAS_MEDICO : PANTALLAS) {
      if (solo && !solo.includes(nombre)) continue;
      if (!page.url().endsWith(ruta)) {
        // Dentro de la SPA: el router de Angular, no una carga nueva.
        await page.evaluate((destino) => {
          history.pushState({}, '', destino);
          dispatchEvent(new PopStateEvent('popstate'));
        }, ruta);
      }
      await page.waitForTimeout(2500);
      await page.addStyleTag({ content: '[aria-label="Modo de demostración"]{display:none!important}' });
      const prefijo = cuenta.startsWith('paciente') ? '' : `${cuenta.split('@')[0]}-`;
      const archivo = join(out, `${prefijo}${nombre}-${ancho}${tema === 'oscuro' ? '-oscuro' : ''}.png`);
      // Ventana tan alta como la página en vez de `fullPage`: con `fullPage` el
      // menú lateral fijo se dibuja una sola vez arriba y tapa el contenido.
      const altoDePagina = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: ancho, height: Math.min(Math.max(altoDePagina, alto), 6000) });
      await page.waitForTimeout(400);
      await page.screenshot({ path: archivo });
      await page.setViewportSize({ width: ancho, height: alto });
      console.log(archivo);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
