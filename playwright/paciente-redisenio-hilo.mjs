/**
 * Captura de una conversación abierta del paciente (rediseño, 22/10/2026).
 *
 *   node playwright/paciente-redisenio-hilo.mjs --base http://localhost:4300 --out <carpeta>
 *
 * Entra como `paciente@alovida.mock`, abre el primer chat de la bandeja y lo
 * fotografía a 1440 y a 390 px.
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

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [ancho, alto] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: ancho, height: alto } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem('mantra-core-health.theme', 'light'); } catch { /* sin almacenamiento */ }
    });
    await page.goto(`${base}/auth`);
    await page.getByTestId('login-identifier').fill('paciente@alovida.mock', { timeout: 60_000 });
    const clave = page.locator('input[type=password]');
    await clave.fill('demo');
    await clave.press('Enter');
    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    await page.evaluate(() => {
      history.pushState({}, '', '/messaging');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(2500);
    await page.locator('.mensajeria__lista a, .mensajeria__lista [role=link], .mensajeria__lista button').first().click();
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: '[aria-label="Modo de demostración"]{display:none!important}' });
    const archivo = join(out, `chat-abierto-${ancho}.png`);
    await page.screenshot({ path: archivo });
    console.log(archivo);
    await context.close();
  }
} finally {
  await browser.close();
}
