/**
 * Evidencia de dos pedidos del propietario (18/09/2026) sobre `/schedule`:
 *
 * 1. «Mi agenda» —el horario publicado— es una solapa desde la entrada, sin
 *    tener que pasar a la vista de tabla.
 * 2. En la tabla de Consultas, la columna Acciones queda fija al borde derecho
 *    y no se esconde detrás del scroll lateral.
 *
 * Uso: `yarn node playwright/agenda-pestana-horario.mjs` con el front levantado
 * (`BASE`, por omisión http://localhost:4291).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4291';
const OUT = process.env.OUT ?? 'artifacts';
const nav = await chromium.launch();

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
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
}

for (const [nombre, ancho, alto, tema] of [
  ['escritorio-oscuro', 1280, 720, 'dark'],
  ['escritorio-claro', 1280, 720, 'light'],
  ['tablet', 820, 1000, 'light'],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await entrar(pg);

  // 1 · la entrada: solapas a la vista
  await pg.goto(`${B}/schedule`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('agenda-calendario').waitFor({ timeout: 60000 });
  const solapas = await pg.getByRole('tab').allInnerTexts();
  process.stdout.write(`[${nombre}] solapas en la entrada: ${JSON.stringify(solapas)}\n`);
  await pg.screenshot({ path: `${OUT}/pestana-entrada-${nombre}.png` });

  await pg.getByRole('tab', { name: 'Mi agenda' }).click();
  await pg.locator('[data-testid=horario-barra]').waitFor({ timeout: 60000 });
  process.stdout.write(
    `[${nombre}] tras clic en «Mi agenda»: url=${pg.url().replace(B, '')} · ` +
      `seleccionada=${await pg.getByRole('tab', { name: 'Mi agenda' }).getAttribute('aria-selected')} · ` +
      `calendario en pantalla=${await pg.getByTestId('agenda-calendario').count()}\n`,
  );
  await pg.screenshot({ path: `${OUT}/pestana-mi-agenda-${nombre}.png` });

  await pg.getByRole('tab', { name: 'Calendario' }).click();
  await pg.getByTestId('agenda-calendario').waitFor({ timeout: 60000 });
  process.stdout.write(`[${nombre}] vuelta a Calendario: url=${pg.url().replace(B, '')}\n`);

  // 2 · la tabla: la columna de acciones a la vista
  await pg.goto(`${B}/schedule?vista=table`, { waitUntil: 'commit', timeout: 180000 });
  const tabla = pg.getByTestId('tabla').first();
  await tabla.locator('tbody tr').first().waitFor({ timeout: 60000 });
  const medida = await tabla.evaluate((t) => {
    const caja = t.closest('.data-table__scroll');
    const cajaR = caja.getBoundingClientRect();
    const th = [...t.querySelectorAll('thead th')].find((e) => e.textContent.trim() === 'Acciones');
    const r = th ? th.getBoundingClientRect() : null;
    return {
      desborda: caja.scrollWidth > caja.clientWidth,
      scrollWidth: caja.scrollWidth,
      clientWidth: caja.clientWidth,
      accionesDentro: r ? r.right <= cajaR.right + 1 && r.left >= cajaR.left - 1 : null,
      posicion: th ? getComputedStyle(th).position : null,
    };
  });
  process.stdout.write(`[${nombre}] tabla: ${JSON.stringify(medida)}\n`);
  await tabla.scrollIntoViewIfNeeded();
  await pg.screenshot({ path: `${OUT}/tabla-acciones-${nombre}.png` });
  process.stdout.write(`[${nombre}] errores de consola: ${errores.length}${errores.length ? ' → ' + errores.slice(0, 3).join(' | ') : ''}\n`);
  await ctx.close();
}
await nav.close();
