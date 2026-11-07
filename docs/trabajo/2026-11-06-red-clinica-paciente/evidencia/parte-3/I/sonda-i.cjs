// Part 3, agent I — probe: the thread selector's shown value over time, and the S3 panel's actions.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const t3 = require('../../tanda-visual-3/captura-tanda-3.cjs');
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  const { ctx, p } = await t3.sesion(b, 'medica@alovida.mock', 1440, 'light');
  await t3.abrirRed(p);
  await t3.sinToasts(p);
  const valor = () => p.getByTestId('red-filtro-hilo').locator('.select-value').textContent();
  await p.getByTestId('red-filtro-hilo').click();
  await p.getByRole('option', { name: /^Trastorno de ansiedad/ }).first().click();
  for (const ms of [0, 200, 1000, 3000]) { await p.waitForTimeout(ms); console.log('valor tras', ms, JSON.stringify((await valor()).trim()), await p.getByTestId('red-filtro-hilo').locator('.select-trigger').getAttribute('data-value-index')); }
  console.log('cuenta', (await p.getByTestId('red-filtros-cuenta').textContent()).trim());
  await p.getByTestId('red-filtros').screenshot({ path: process.argv[2] + '/sonda-filtros.png' });
  await p.getByTestId('red-filtros-limpiar').click();
  await p.getByTestId('red-desplegar-todo').click();
  const estudios = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]');
  for (let i = 0; i < (await estudios.count()); i++) {
    await estudios.nth(i).scrollIntoViewIfNeeded(); await estudios.nth(i).click();
    await p.getByTestId('red-panel').waitFor();
    await p.getByTestId('red-panel-informe-cargando').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    if (await p.getByTestId('red-panel-sin-resultado').count()) {
      console.log('S3 nodo', (await p.locator('[data-testid="red-panel"] h2').textContent()).trim());
      console.log('acciones', await p.locator('[data-testid="red-panel"] .panel__acciones').evaluateAll((l) => l.map((e) => e.outerHTML.slice(0, 300))));
      console.log('registro completo', await p.getByTestId('red-panel-registro-completo').count());
      break;
    }
    await p.getByTestId('red-panel-cerrar').click();
  }
  await ctx.close(); await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
