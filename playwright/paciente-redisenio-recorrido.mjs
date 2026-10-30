/**
 * Prueba del recorrido guiado del paciente (22/10/2026), con captura de cada paso.
 *
 *   node playwright/paciente-redisenio-recorrido.mjs --base http://localhost:4300 --out <carpeta>
 *
 * Entra como paciente, toca «Conozca AloVida en 1 minuto», avanza con
 * «Siguiente» hasta el final y comprueba que, al terminar, el botón de la
 * portada desaparece y el paso «Hacer el recorrido» queda hecho. Sale con 1 si
 * algo de eso no ocurre.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const arg = (nombre, defecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? defecto : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:4300');
const out = arg('out', 'artifacts/paciente-redisenio');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
try {
  await page.goto(`${base}/auth`);
  await page.getByTestId('login-identifier').fill('paciente@alovida.mock', { timeout: 60_000 });
  const clave = page.locator('input[type=password]');
  await clave.fill('demo');
  await clave.press('Enter');
  await page.waitForURL('**/dashboard', { timeout: 60_000 });
  await page.addStyleTag({ content: '[aria-label="Modo de demostración"]{display:none!important}' });
  await page.getByTestId('mi-salud-recorrido').click({ timeout: 30_000 });

  const pasos = [];
  for (let n = 1; n <= 10; n += 1) {
    await page.waitForTimeout(1200);
    const globo = page.locator('app-tutorial-overlay [role="dialog"]');
    if (!(await globo.count())) break;
    pasos.push((await globo.first().innerText()).split('\n').filter(Boolean).slice(0, 2).join(' · '));
    await page.screenshot({ path: join(out, `recorrido-paso-${n}-1440.png`) });
    const siguiente = page.locator('app-tutorial-overlay').getByRole('button', { name: /Siguiente|Terminar|Finalizar/ });
    if (!(await siguiente.count())) break;
    await siguiente.first().click();
  }
  await page.waitForTimeout(1500);
  const botonSigue = await page.getByTestId('mi-salud-recorrido').count();
  const pasoHecho = await page.getByTestId('primeros-pasos-recorrido').getAttribute('data-hecho');
  console.log(JSON.stringify({ pasos, botonSigue, pasoHecho, errores }, null, 2));
  if (pasos.length < 6 || botonSigue !== 0 || pasoHecho !== 'true' || errores.length) process.exitCode = 1;
} finally {
  await browser.close();
}
