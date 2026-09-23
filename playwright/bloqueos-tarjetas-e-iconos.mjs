/**
 * Evidencia de «Bloqueos de agenda»: tarjetas lado a lado y las dos acciones
 * de la cabecera como íconos con nombre accesible.
 *
 * Uso: `yarn node playwright/bloqueos-tarjetas-e-iconos.mjs` con el front
 * levantado (`BASE`, por omisión http://localhost:4231).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4287';
const nav = await chromium.launch();

for (const [nombre, ancho] of [['escritorio', 1536], ['celular', 400]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 1000 } });
  const pg = await ctx.newPage();
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  // Reintento por la hidratación: un fill hecho antes de que Angular arranque
  // se pierde. Si ya se navegó, no se vuelve a pulsar.
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
    await pg.getByTestId('login-password').fill('mockup');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
  await pg.goto(`${B}/schedule/blocks`, { waitUntil: 'commit', timeout: 180000 });
  await pg.locator('.bloqueos__item').first().waitFor({ timeout: 60000 });
  await pg.waitForTimeout(1000);

  const nuevo = pg.getByRole('button', { name: 'Bloquear días u horarios' });
  const volver = pg.getByRole('link', { name: 'Volver a mi agenda' });
  process.stdout.write(
    `[${nombre}] nuevo: visible=${await nuevo.isVisible()} texto="${(await nuevo.innerText()).trim()}"\n` +
      `[${nombre}] volver: visible=${await volver.isVisible()} texto="${(await volver.innerText()).trim()}"\n`,
  );
  const cajas = await pg
    .locator('.bloqueos__seccion')
    .first()
    .locator('.bloqueos__item')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}px`));
  process.stdout.write(`[${nombre}] tarjetas vigentes: ${cajas.join(' | ')}\n`);

  await nuevo.hover();
  await pg.waitForTimeout(900);
  process.stdout.write(`[${nombre}] tooltip: "${await pg.locator('[role=tooltip]').first().innerText().catch(() => '(no)')}"\n`);
  await pg.screenshot({ path: `artifacts/bloqueos-${nombre}.png`, fullPage: true });
  await ctx.close();
}
await nav.close();
