/**
 * Evidencia de mdavila-2001/mantra-core-health#1866: en «Sistema de la
 * farmacia», guardar y enseguida quitar deja **un** aviso, no dos apilados
 * encima de la acción principal (el de «guardado» ya no aplica).
 *
 * Contra `ng serve` (`real-api`), la API con C9-3 y el simulador de farmacia,
 * como `far-c9-sistema-de-la-farmacia.mjs`. Cuenta los avisos visibles después
 * de cada paso y los anota en `avisos.txt`. No espera `networkidle`.
 *
 * Uso: EMAIL=… PASSWORD=… KEY_STD=… yarn node playwright/issue-1866-avisos.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const B = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'docs/frontend/evidence/issue-1866-avisos';
const ORG = process.env.ORG ?? 'Farmacia Central C93';
const SIM = process.env.SIM ?? 'http://127.0.0.1:4100';
mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const log = [];

async function abrir(ancho, alto, tema) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto } });
  await ctx.addInitScript((modo) => {
    try {
      localStorage.setItem('mantra-core-health.theme', modo);
    } catch {
      /* sin almacenamiento: queda el tema por defecto */
    }
  }, tema);
  const pg = await ctx.newPage();
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('login-identifier').fill(process.env.EMAIL, { timeout: 120000 });
  await pg.getByTestId('login-password').fill(process.env.PASSWORD);
  await pg.getByTestId('login-submit').click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  await pg.goto(`${B}/auth/organization`, { waitUntil: 'commit' });
  await pg.getByTestId('tenant-opcion').filter({ hasText: ORG }).first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  await pg.goto(`${B}/administration/pharmacy-catalog?tab=integration`, { waitUntil: 'commit' });
  await pg.getByTestId('integration-system').waitFor({ timeout: 60000 });
  return { ctx, pg };
}

async function quitar(pg) {
  await pg.getByTestId('integration-system-remove').click();
  await pg.getByTestId('dialogo-confirmar').click();
  await pg.getByTestId('integration-system-form').waitFor({ timeout: 30000 });
}

/**
 * Cuenta los avisos en pantalla y, aparte, los que están saliendo: un aviso
 * reemplazado no desaparece de golpe, se va con su animación de salida
 * (`.toast-leaving`, `--pulse-dur-exit`) y mientras tanto sigue en el DOM.
 */
async function contar(pg, ancho, paso) {
  const avisos = await pg.locator('app-toast').evaluateAll((nodos) =>
    nodos.map((n) => ({
      texto: n.querySelector('[data-testid="toast-mensaje"]')?.textContent?.trim() ?? '',
      saliendo: n.classList.contains('toast-leaving'),
    })),
  );
  const visibles = avisos.filter((a) => !a.saliendo).map((a) => a.texto);
  const saliendo = avisos.filter((a) => a.saliendo).map((a) => a.texto);
  log.push(
    `[${ancho}] ${paso}: ${visibles.length} aviso(s) ${JSON.stringify(visibles)}` +
      (saliendo.length > 0 ? ` · saliendo ${JSON.stringify(saliendo)}` : ''),
  );
}

for (const [ancho, alto, tema] of [
  [1440, 900, 'light'],
  [390, 844, 'dark'],
]) {
  const { ctx, pg } = await abrir(ancho, alto, tema);
  if (await pg.getByTestId('integration-system-remove').isVisible()) {
    await quitar(pg);
    for (const cerrar of await pg.getByTestId('toast-cerrar').all()) await cerrar.click().catch(() => {});
  }
  await pg.getByTestId('integration-system-url').fill(`${SIM}/alovida-standard`);
  await pg.getByTestId('integration-system-code').fill('FARM-C93');
  await pg.getByTestId('integration-system-key').fill(process.env.KEY_STD);
  await pg.getByTestId('integration-system-save').click();
  await pg.getByTestId('toast-mensaje').filter({ hasText: 'quedó guardado' }).waitFor({ timeout: 30000 });
  const desde = Date.now();
  await contar(pg, ancho, 'después de guardar');
  // Enseguida, mientras el aviso de «guardado» sigue en pantalla: se cuenta
  // justo antes de confirmar para que no haya dudas de que seguía vivo.
  await pg.getByTestId('integration-system-remove').click();
  await pg.getByTestId('dialogo').waitFor();
  await contar(pg, ancho, `antes de confirmar «Quitar» (+${Date.now() - desde} ms)`);
  await pg.getByTestId('dialogo-confirmar').click();
  await pg.getByTestId('toast-mensaje').filter({ hasText: 'Quitó' }).waitFor({ timeout: 30000 });
  await contar(pg, ancho, `después de quitar (+${Date.now() - desde} ms; el de éxito dura 5000)`);
  // Terminada la salida del reemplazado, se ve uno solo (y todavía dentro de los 5 s del «guardado»).
  await pg.waitForTimeout(600);
  await contar(pg, ancho, `terminada la salida (+${Date.now() - desde} ms)`);
  await pg.screenshot({ path: `${OUT}/guardar-y-quitar-${ancho}-${tema}.jpg`, quality: 80, type: 'jpeg' });
  await ctx.close();
}
await nav.close();
writeFileSync(`${OUT}/avisos.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
