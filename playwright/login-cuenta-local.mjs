/**
 * Prueba del recuadro «Cuenta de administración local» del login (sólo desarrollo).
 *
 * Por cada ancho (390/820/1440) y tema (claro/oscuro): el recuadro muestra el correo
 * y la contraseña escritos, sin desborde horizontal ni errores de consola. En
 * escritorio claro además: «Usar estas credenciales» rellena el formulario SIN enviar,
 * «Entrar» inicia sesión de verdad (API real) y se llega al panel.
 *
 *   node playwright/login-cuenta-local.mjs [carpeta-de-salida]
 *
 * Variables: `E2E_BASE_URL`, `E2E_CHROMIUM`, `E2E_IGNORAR_CONSOLA`, `E2E_SIN_ENTRAR=1`
 * (no inicia sesión: para el simulador, donde sólo interesa verlo).
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'login-cuenta-local');
const IGNORAR = process.env.E2E_IGNORAR_CONSOLA ? new RegExp(process.env.E2E_IGNORAR_CONSOLA) : null;
const VIEWPORTS = [
  { nombre: 'telefono', width: 390, height: 844 },
  { nombre: 'tableta', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 900 },
];
const fallos = [];
const falla = (d, m) => {
  fallos.push(`${d}: ${m}`);
  console.error(`  ✗ ${d}: ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

await mkdir(SALIDA, { recursive: true });
const navegador = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
for (const vp of VIEWPORTS) {
  for (const tema of ['light', 'dark']) {
    const id = `${vp.nombre}-${tema}`;
    console.log(`\n== ${id}`);
    const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'es-BO', colorScheme: tema });
    await ctx.addInitScript(([k, v]) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        /* modo privado */
      }
    }, ['mantra-core-health.theme', tema]);
    const page = await ctx.newPage();
    const consola = [];
    const salio = [];
    page.on('console', (m) => m.type() === 'error' && !IGNORAR?.test(m.text()) && consola.push(m.text().slice(0, 160)));
    page.on('pageerror', (e) => consola.push(`pageerror: ${String(e).slice(0, 160)}`));
    page.on('request', (r) => r.method() === 'POST' && r.url().includes('/iam/auth/login') && salio.push(r.url()));
    await page.goto(`${BASE}/auth`);
    await page.getByTestId('login-local-hint').waitFor({ timeout: 30_000 });
    const correo = (await page.getByTestId('login-local-correo').textContent())?.trim();
    const clave = (await page.getByTestId('login-local-clave').textContent())?.trim();
    if (correo !== 'admin@alovidasalud.com' || clave !== '12345678') falla(id, `el recuadro dice «${correo}» / «${clave}»`);
    else ok('el recuadro muestra el correo y la contraseña escritos');
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (desborde > 1) falla(id, `desborde horizontal de ${desborde}px`);
    await page.screenshot({ path: path.join(SALIDA, `login-${id}.png`), fullPage: true });

    if (vp.nombre === 'escritorio' && tema === 'light') {
      await page.getByTestId('login-local-usar').click();
      const idv = await page.getByTestId('login-identifier').inputValue();
      const pwv = await page.getByTestId('login-password').inputValue();
      if (idv !== 'admin@alovidasalud.com' || pwv !== '12345678') falla(id, 'no rellenó el formulario');
      else ok('«Usar estas credenciales» rellena el formulario');
      if (salio.length) falla(id, 'rellenar envió una petición de login');
      else ok('rellenar NO envía nada');
      if (!process.env.E2E_SIN_ENTRAR) {
        await page.getByTestId('login-submit').click();
        await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
        ok(`«Entrar» inicia sesión (${new URL(page.url()).pathname})`);
      }
    }
    if (consola.length) falla(id, `errores de consola: ${consola.join(' | ')}`);
    await ctx.close();
  }
}
await navegador.close();
if (fallos.length) {
  console.error(`\n✗ ${fallos.length} fallo(s)`);
  process.exit(1);
}
console.log('\n✓ sin fallos');
