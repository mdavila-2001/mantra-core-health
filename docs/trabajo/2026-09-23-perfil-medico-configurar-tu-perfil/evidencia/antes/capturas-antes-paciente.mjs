/**
 * H1.S2.M4 — la guía (`/directory` y `/directory/:profileId`) está restringida al
 * rol paciente (`app.routes.ts`, `seccionRolesGuard`): con la sesión de la médica
 * redirige al Panel. Esta pasada la mira con la cuenta sintética `paciente@alovida.mock`.
 * Uso: yarn node docs/trabajo/<carpeta>/evidencia/antes/capturas-antes-paciente.mjs <urlBase>
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) throw new Error('Falta la URL de la app como primer argumento.');
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CAPS = `${DIR}capturas`;
const ID_MEDICA = 'be0f3a66-c03e-4eac-a416-c1068238d3d2'; // uuid('hpid-medica'), ver capturas-antes.mjs

const lineas = [];
const log = (t) => {
  lineas.push(t);
  process.stdout.write(t + '\n');
};
const consola = [];
const red = [];

async function main() {
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push(`[pageerror] ${p.url()} — ${String(e).split('\n')[0]}`));
  p.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.type() === 'warning' || m.text().includes('[mock] sin manejador')) {
      consola.push(`[${m.type()}] ${p.url()} — ${m.text().slice(0, 300)}`);
    }
  });
  p.on('response', (r) => {
    if (r.status() >= 400) red.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  p.on('requestfailed', (r) => red.push(`FAILED ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));

  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization|my-account|home)/, { timeout: 90_000 }).catch(() => {});
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForTimeout(1500);
  }
  log(`paciente · tras entrar: ${p.url()}`);

  const medir = async (nombre, url) => {
    await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await p.waitForTimeout(3000);
    const insignias = await p.locator('.specialty-badge__principal').count();
    const badges = await p.locator('app-badge', { hasText: /^Principal$/ }).count();
    const texto = await p.getByText(/^Principal$/i).count();
    const nombreVisible = await p.getByText(/Valeria Rojas/).count();
    log(`M4 · ${nombre} (${url}) → ${p.url().replace(BASE, '')}: .specialty-badge__principal=${insignias} · app-badge «Principal»=${badges} · texto «Principal»=${texto} · «Valeria Rojas» visible=${nombreVisible}`);
    await p.screenshot({ path: `${CAPS}/07-principal-${nombre}.png`, fullPage: true });
  };
  await medir('directorio-lista-paciente', '/directory');
  await medir('directorio-detalle-paciente', `/directory/${ID_MEDICA}`);

  await navegador.close();
  const unicos = (xs) => [...new Set(xs)];
  writeFileSync(`${DIR}comportamiento-observado-paciente.txt`, lineas.join('\n') + '\n');
  writeFileSync(
    `${DIR}consola-red-paciente.txt`,
    `# Consola y red ANTES de tocar (sesión paciente, guía) — ${new Date().toISOString()} — ${BASE}\n\n## Consola\n${consola.length ? unicos(consola).join('\n') : 'ninguno'}\n\n## Red (>= 400 o fallida)\n${red.length ? unicos(red).join('\n') : 'ninguna'}\n`,
  );
  log(`consola: ${unicos(consola).length} distintas · red: ${unicos(red).length} distintas`);
}
main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 2;
});
