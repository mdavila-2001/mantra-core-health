/**
 * Mide el globo del nombre del paciente en la agenda (`/schedule`): tiene que
 * quedar entero POR ENCIMA del nombre, sin pisarlo, y centrado sobre él.
 *
 * Antes del arreglo la directiva medía el globo antes de pintar su texto: lo
 * ubicaba con el alto de una caja vacía y terminaba montado sobre el nombre.
 *
 * Uso: `yarn node playwright/tooltip-paciente-agenda.mjs [sufijo] [base]`
 * (con `yarn start` levantado).
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SUFIJO = process.argv[2] ?? 'despues';
const BASE = process.argv[3] ?? 'http://localhost:4200';
const SALIDA = fileURLToPath(new URL('../artifacts/tooltip-paciente', import.meta.url));

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();
mkdirSync(SALIDA, { recursive: true });

await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
await pagina.getByTestId('login-password').fill('mockup');
await pagina.getByTestId('login-submit').click();
await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
if (pagina.url().includes('/auth/organization')) {
  await pagina.getByTestId('tenant-opcion').first().click();
  await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

await pagina.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
const nombres = pagina.getByTestId('agenda-paciente');
await nombres.first().waitFor({ timeout: 30_000 });

let fallos = 0;
const total = Math.min(await nombres.count(), 4);
for (let i = 0; i < total; i++) {
  const nombre = nombres.nth(i);
  await nombre.scrollIntoViewIfNeeded();
  await nombre.hover();
  const globo = pagina.getByRole('tooltip');
  await globo.waitFor({ timeout: 5_000 });
  // El historial llega después: esperar a que el texto deje de decir «Buscando».
  await pagina
    .waitForFunction(() => !document.querySelector('[role=tooltip]')?.textContent?.includes('Buscando'), null, {
      timeout: 5_000,
    })
    .catch(() => undefined);

  const n = await nombre.boundingBox();
  const g = await globo.boundingBox();
  const texto = (await globo.textContent())?.trim();
  const encima = g.y + g.height <= n.y + 0.5;
  const centroN = n.x + n.width / 2;
  const centroG = g.x + g.width / 2;
  const centrado = Math.abs(centroN - centroG) <= 2 || g.x <= 1;
  if (!encima || !centrado) fallos++;
  process.stdout.write(
    `[${SUFIJO}] fila ${i}: globo bottom ${Math.round(g.y + g.height)} · nombre top ${Math.round(n.y)} · ` +
      `encima ${encima ? 'SÍ' : 'NO'} · centrado ${centrado ? 'SÍ' : 'NO'} · «${texto}»\n`,
  );
  if (i === 0) await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-fila0.png` });
  if (i === 1) await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-fila1.png` });
  await pagina.mouse.move(0, 0);
  await globo.waitFor({ state: 'detached', timeout: 5_000 });
}

process.stdout.write(`[${SUFIJO}] ${fallos === 0 ? 'PASS' : `FAIL (${fallos})`}\n`);
await navegador.close();
process.exit(fallos === 0 ? 0 : 1);
