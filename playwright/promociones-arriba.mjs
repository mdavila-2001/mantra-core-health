/**
 * Evidencia del pedido del cliente (25/09/2026): «Promociones» sale del menú
 * lateral, va a la barra superior y la pantalla es un directorio con
 * buscador, mapa y chips.
 *
 * Uso: `yarn node playwright/promociones-arriba.mjs` con el front levantado
 * (`BASE`, por omisión http://localhost:4317).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4317';
const OUT = process.env.OUT ?? 'artifacts';
const nav = await chromium.launch();

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('paciente@alovida.mock');
    await pg.getByTestId('login-password').fill('mockup');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

const tarjetas = (pg) => pg.locator('[app-result-card]').count();

for (const [nombre, ancho, alto] of [
  ['escritorio', 1280, 800],
  ['telefono', 390, 844],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await entrar(pg);

  const enMenu = await pg.locator('[data-testid=nav-enlace][data-route="/my-account/promotions"]').count();
  const arriba = pg.getByTestId('header-promociones');
  await arriba.waitFor({ timeout: 60000 });
  process.stdout.write(`[${nombre}] en el menú lateral=${enMenu} · en la barra superior=${await arriba.count()}\n`);

  await arriba.click();
  await pg.waitForURL(/\/my-account\/promotions/, { timeout: 60000 });
  await pg.locator('[app-result-card]').first().waitFor({ timeout: 60000 });
  process.stdout.write(`[${nombre}] tarjetas=${await tarjetas(pg)} · chips=${JSON.stringify(await pg.locator('app-filter-bar button').allInnerTexts())}\n`);
  await pg.screenshot({ path: `${OUT}/promociones-${nombre}.png`, fullPage: true });

  const buscador = pg.locator('app-filter-bar input').first();
  await buscador.fill('loratadina');
  await pg.waitForFunction(() => document.querySelectorAll('[app-result-card]').length === 1, null, { timeout: 15000 }).catch(() => {});
  process.stdout.write(`[${nombre}] buscando «loratadina»: tarjetas=${await tarjetas(pg)} · url=${pg.url().replace(B, '')}\n`);
  await pg.screenshot({ path: `${OUT}/promociones-busqueda-${nombre}.png`, fullPage: true });

  await pg.goto(`${B}/my-account/promotions?vigentes=true`, { waitUntil: 'commit' });
  await pg.locator('[app-result-card]').first().waitFor({ timeout: 60000 });
  process.stdout.write(`[${nombre}] sólo vigentes: tarjetas=${await tarjetas(pg)}\n`);

  process.stdout.write(`[${nombre}] errores de consola=${errores.length} ${errores.slice(0, 3).join(' | ')}\n`);
  await ctx.close();
}
await nav.close();
