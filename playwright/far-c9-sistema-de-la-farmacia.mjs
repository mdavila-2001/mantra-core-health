/**
 * Evidencia de FAR-C9 · C9-4: el «Sistema de la farmacia» en la pestaña
 * Integración del catálogo, contra la API real y el simulador de
 * `mock-provider-server/` (Estándar ALOVIDA y cadena simulada).
 *
 * Recorre, en orden: sin sistema → campos vacíos → clave equivocada (502) →
 * guardar → recargar la página → probar → cambiar a la cadena simulada →
 * sincronizar → quitar (con confirmación). Luego lo mismo a 390 en oscuro.
 * Anota cada petición a `/integration-connections` con su respuesta y los
 * errores de consola. No espera `networkidle` (con HMR no llega).
 *
 * Uso (API en 3093, simulador en 4100, `ng serve` en 4200):
 *   EMAIL=… PASSWORD=… ORG='Farmacia Central C93' yarn node playwright/far-c9-sistema-de-la-farmacia.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const B = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'docs/frontend/evidence/far-c9-sistema-de-la-farmacia';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const ORG = process.env.ORG ?? 'Farmacia Central C93';
const SIM = process.env.SIM ?? 'http://127.0.0.1:4100';
const STD = { url: `${SIM}/alovida-standard`, code: 'FARM-C93', key: process.env.KEY_STD };
const CHAIN = { url: `${SIM}/simulated-chain/api/v2`, code: 'CHAIN-C93', key: process.env.KEY_CHAIN };

mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const log = [];

async function abrir(ancho, alto, tema) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
  const pg = await ctx.newPage();
  pg.on('console', (m) => m.type() === 'error' && log.push(`[${ancho} consola] ${m.text().slice(0, 200)}`));
  pg.on('response', async (r) => {
    const req = r.request();
    if (!/integration-connections/.test(req.url())) return;
    const path = new URL(req.url()).pathname.replace(/[0-9a-f-]{36}/g, ':id');
    const body = req.postData() ?? '';
    // La clave nunca va al registro: se anota solo que viajó en el cuerpo.
    const conClave = /apiKey/.test(body) ? ' (cuerpo con apiKey)' : '';
    log.push(`[${ancho}] ${req.method()} ${path} → ${r.status()}${conClave}`);
  });
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('login-identifier').fill(EMAIL, { timeout: 120000 });
  await pg.getByTestId('login-password').fill(PASSWORD);
  await pg.getByTestId('login-submit').click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  await pg.goto(`${B}/auth/organization`, { waitUntil: 'commit' });
  await pg.getByTestId('tenant-opcion').filter({ hasText: ORG }).first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  await pg.goto(`${B}/administration/pharmacy-catalog?tab=integration`, { waitUntil: 'commit' });
  await pg.getByTestId('integration-system').waitFor({ timeout: 60000 });
  return { ctx, pg };
}

async function foto(pg, nombre) {
  await pg.getByTestId('integration-system').scrollIntoViewIfNeeded();
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: `${OUT}/${nombre}.jpg`, quality: 80, type: 'jpeg' });
}

async function escribir(pg, { url, code, key }, formato) {
  if (formato) {
    await pg.getByTestId('integration-system-format').click();
    await pg.getByRole('option', { name: formato }).click();
  }
  await pg.getByTestId('integration-system-url').fill(url);
  await pg.getByTestId('integration-system-code').fill(code);
  await pg.getByTestId('integration-system-key').fill(key);
}

async function guardar(pg) {
  await pg.getByTestId('integration-system-save').click();
}

async function recorrido(ancho, alto, tema) {
  const sufijo = `${ancho}-${tema}`;
  const { ctx, pg } = await abrir(ancho, alto, tema);

  // Si una corrida anterior dejó un sistema, se quita primero (también es la UI).
  if (await pg.getByTestId('integration-system-remove').isVisible()) {
    await pg.getByTestId('integration-system-remove').click();
    await pg.getByTestId('dialogo-confirmar').click();
    await pg.getByTestId('integration-system-form').waitFor();
  }
  await foto(pg, `01-sin-sistema-${sufijo}`);

  await guardar(pg);
  await pg.getByText('Escriba la clave.').waitFor();
  await foto(pg, `02-faltan-campos-${sufijo}`);

  await escribir(pg, { ...STD, key: 'una-clave-equivocada' });
  await guardar(pg);
  await pg.getByTestId('integration-system-error').waitFor({ timeout: 30000 });
  await foto(pg, `03-clave-equivocada-${sufijo}`);

  await pg.getByTestId('integration-system-key').fill(STD.key);
  await guardar(pg);
  await pg.getByTestId('integration-system-probe').waitFor({ timeout: 30000 });
  await foto(pg, `04-guardado-${sufijo}`);

  await pg.reload({ waitUntil: 'commit' });
  await pg.getByTestId('integration-system-probe').waitFor({ timeout: 60000 });
  await foto(pg, `05-tras-recargar-${sufijo}`);

  await pg.getByTestId('integration-system-probe').click();
  await pg.getByTestId('integration-system-probe-ok').waitFor({ timeout: 30000 });
  await foto(pg, `06-probado-${sufijo}`);

  await pg.getByTestId('integration-system-edit').click();
  await pg.getByTestId('integration-system-form').waitFor();
  await foto(pg, `07-cambiar-${sufijo}`);
  await escribir(pg, CHAIN, 'Cadena simulada (pruebas)');
  await guardar(pg);
  await pg.getByTestId('integration-system-probe').waitFor({ timeout: 30000 });
  await foto(pg, `08-cadena-${sufijo}`);

  await pg.getByTestId('integration-sync-button').click();
  await pg.getByTestId('integration-sync-result').waitFor({ timeout: 60000 });
  await pg.getByTestId('integration-sync-result').scrollIntoViewIfNeeded();
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: `${OUT}/09-sincronizado-${sufijo}.jpg`, quality: 80, type: 'jpeg' });

  await pg.getByTestId('integration-system-remove').click();
  await pg.getByTestId('dialogo').waitFor();
  await pg.screenshot({ path: `${OUT}/10-quitar-confirmar-${sufijo}.jpg`, quality: 80, type: 'jpeg' });
  await pg.getByTestId('dialogo-confirmar').click();
  await pg.getByTestId('integration-system-form').waitFor({ timeout: 30000 });
  await foto(pg, `11-quitado-${sufijo}`);

  await ctx.close();
}

await recorrido(1440, 900, 'light');
await recorrido(390, 844, 'dark');
await nav.close();
writeFileSync(`${OUT}/red-y-consola.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
