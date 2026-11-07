// Part 2 · agent B — patient portal «Mi recorrido» M34 states: S2 (loading), S5 (403) and S9 (500 with request id).
// Usage: node captura-b.cjs <out-dir>   (demo build served on BASE, configuration development,demo)
// Failures are forced with the simulator's own switch, `sessionStorage['mock:fallos']` (core/mock/simulated-failures.ts):
// the mock intercepts inside Angular, so `page.route` would never see the request.
// S2 is caught by delaying the simulator's timers with Playwright's fake clock. Never `networkidle`.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:4350';
const RUTA = '/my-account/medical-record?vista=recorrido';
const log = [];
let fallas = 0;
const afirmar = (cond, texto) => { const l = `${cond ? 'ok  ' : 'FALLA'} ${texto}`; log.push(l); console.log(l); if (!cond) fallas++; };

async function sesion(b, fallos) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO', timezoneId: 'America/La_Paz' });
  const p = await ctx.newPage();
  await p.goto(BASE + '/auth');
  await p.getByTestId('login-identifier').waitFor({ timeout: 180000 });
  await p.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await p.getByTestId('login-password').fill('mock');
  await p.getByTestId('login-submit').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), { timeout: 120000 });
  if (p.url().includes('organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 });
  }
  await p.evaluate((f) => sessionStorage.setItem('mock:fallos', JSON.stringify(f)), fallos);
  return { ctx, p };
}

async function cerrarToasts(p) {
  for (const x of await p.getByTestId('toast-cerrar').all()) await x.click().catch(() => {});
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  // S2 — the lazy read in flight.
  {
    const { ctx, p } = await sesion(b, []);
    await p.goto(BASE + '/my-account/medical-record');
    await p.getByTestId('historia-vista').waitFor({ timeout: 120000 });
    await cerrarToasts(p);
    // Paused fake clock: the simulator answers after a timer, so the read stays in flight for the shot.
    await p.clock.install();
    await p.clock.pauseAt(new Date(Date.now() + 60000));
    await p.getByTestId('segmentado-recorrido').click();
    const cargando = p.getByTestId('recorrido-cargando');
    // Advance fake time in small steps until the read is in flight (the simulator answers after 120 ms).
    for (let i = 0; i < 100 && !(await cargando.isVisible()); i++) await p.clock.runFor(5);
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/s2-cargando.png` });
    afirmar(await cargando.isVisible(), 'S2: «Mi recorrido» declares the read in flight (still visible after the shot)');
    await ctx.close();
  }

  // S5 — 403 on the patient's own orders.
  {
    const { ctx, p } = await sesion(b, [{ patron: '/diagnostic-results/me/orders', modo: 'forbidden' }]);
    await p.goto(BASE + RUTA);
    const falta = p.getByTestId('recorrido-fallo');
    await falta.waitFor({ timeout: 120000 });
    await cerrarToasts(p);
    const texto = (await falta.textContent()) ?? '';
    afirmar(texto.includes('No tiene acceso a esta sección'), 'S5: the host says «No tiene acceso»');
    afirmar((await falta.getByRole('button', { name: 'Reintentar' }).count()) === 0, 'S5: no retry is offered');
    afirmar((await falta.getByRole('button', { name: 'Volver a cargar' }).count()) === 0, 'S5: no «Volver a cargar» either');
    afirmar((await p.getByTestId('recorrido-hilo').count()) > 0, 'S5: what arrived is still drawn');
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/s5-403.png` });
    await ctx.close();
  }

  // S9 — 500 with the request id.
  {
    const { ctx, p } = await sesion(b, [{ patron: '/diagnostic-results/me/orders', modo: 'error' }]);
    await p.goto(BASE + RUTA);
    const falta = p.getByTestId('recorrido-fallo');
    await falta.waitFor({ timeout: 120000 });
    await cerrarToasts(p);
    const id = (await falta.locator('[data-testid="support-code"] code').textContent())?.trim();
    afirmar(id === 'mock-fallo', `S9: the request id is shown (${id})`);
    afirmar((await falta.getByRole('button', { name: 'Reintentar' }).count()) === 1, 'S9: retry is offered');
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/s9-500.png` });
    // Retry with the failure switched off: the notice goes away and the read lands.
    await p.evaluate(() => sessionStorage.removeItem('mock:fallos'));
    await falta.getByRole('button', { name: 'Reintentar' }).click();
    await p.getByTestId('recorrido-fallo').waitFor({ state: 'detached', timeout: 30000 });
    afirmar(true, 'S9: «Reintentar» asks again and the notice goes away once the read succeeds');
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/s9-reintentado.png` });
    await ctx.close();
  }

  await b.close();
  fs.writeFileSync(`${OUT}/resultado.txt`, log.join('\n') + `\n${fallas === 0 ? 'TODO OK' : `${fallas} FALLAS`}\n`);
  process.exit(fallas === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
