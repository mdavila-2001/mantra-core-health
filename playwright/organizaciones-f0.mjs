/**
 * Evidencia F0 de la ficha de organización, el listado y la consola.
 * Uso: BASE=http://127.0.0.1:4291 OUT=<dir> node playwright/organizaciones-f0.mjs
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4291';
const OUT = process.env.OUT ?? 'artifacts';
const nav = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const pg = await ctx.newPage();
const errores = [];
pg.on('pageerror', (e) => errores.push(String(e)));
pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
const destino = /\/(dashboard|auth\/organization)/;
for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
  await pg.getByTestId('login-identifier').fill('superadmin@alovida.mock');
  await pg.getByTestId('login-password').fill('mockup');
  await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
  await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
}
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
}

const paso = async (nombre) => pg.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: true });

await pg.goto(`${B}/administration/organizations`, { waitUntil: 'domcontentloaded' });
await pg.getByTestId('organizacion-abrir-OLIVOS').waitFor({ timeout: 30000 });
await paso('01-listado');
await pg.getByTestId('organizacion-abrir-OLIVOS').click();
await pg.getByTestId('organizacion-accion-principal').waitFor({ timeout: 30000 });
await pg.waitForTimeout(800);
console.log('accion sucursales:', (await pg.getByTestId('organizacion-accion-principal').innerText()).trim());
await paso('02-ficha-sucursales');
await pg.getByRole('tab', { name: 'Plantilla' }).click();
await pg.waitForTimeout(800);
console.log('accion plantilla:', (await pg.getByTestId('organizacion-accion-principal').innerText()).trim());
await paso('03-ficha-plantilla');

// Hospital: plantilla con segunda página
await pg.goto(`${B}/administration/organizations`, { waitUntil: 'domcontentloaded' });
await pg.getByTestId('organizacion-abrir-SANLUCAS').click().catch(async () => {
  const filas = await pg.locator('[data-testid^="organizacion-abrir-"]').allInnerTexts();
  console.log('filas', filas);
});
await pg.getByRole('tab', { name: 'Plantilla' }).click();
await pg.waitForTimeout(1200);
const siguiente = pg.getByRole('button', { name: /siguiente/i });
console.log('siguiente visible:', await siguiente.count());
await paso('04-hospital-plantilla-p1');
if (await siguiente.count()) {
  await siguiente.first().click();
  await pg.waitForTimeout(1000);
  await paso('05-hospital-plantilla-p2');
}

// Ficha inexistente (S6)
await pg.goto(`${B}/administration/organizations/00000000-0000-4000-8000-000000000000`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
console.log('404 texto:', (await pg.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200));
await paso('06-ficha-inexistente');

// Consola
await pg.goto(`${B}/administration/medical-organization`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(2000);
await paso('07-consola');
const u = [...new Set(errores.map((e) => e.slice(0, 120)))]; console.log('errores únicos:', u.length, u.slice(0, 8));
await nav.close();
