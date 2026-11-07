// Part 3, agent J — patient portal «Mi recorrido»: S5 (403) in the warning tone (M-7) and threads
// that keep their order and spans when the lazy studies arrive (L-2).
// Usage: BASE=http://localhost:PORT node captura-j.cjs <out-dir>   (static demo build, development,demo)
// Failures are forced with `sessionStorage['mock:fallos']`, as in parte-2/b/captura-b.cjs. Never `networkidle`.
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
const cerrarToasts = async (p) => { for (const x of await p.getByTestId('toast-cerrar').all()) await x.click().catch(() => {}); };
const encabezados = (p) => p.getByTestId('recorrido-hilo').locator('.accordion-panel__trigger').allTextContents()
  .then((l) => l.map((t) => t.replace(/\s+/g, ' ').trim()));
/** The computed colour of the notice's accent, to compare tones by what is painted. */
const tono = (loc) => loc.evaluate((e) => { const s = getComputedStyle(e); return `${s.backgroundColor} | ${s.borderTopColor}`; });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  // L-2 — the read in flight (S2) and after it lands: same order, same spans.
  {
    const { ctx, p } = await sesion(b, []);
    await p.goto(BASE + '/my-account/medical-record');
    await p.getByTestId('historia-vista').waitFor({ timeout: 120000 });
    await cerrarToasts(p);
    await p.clock.install();
    await p.clock.pauseAt(new Date(Date.now() + 60000));
    await p.getByTestId('segmentado-recorrido').click();
    const cargando = p.getByTestId('recorrido-cargando');
    for (let i = 0; i < 100 && !(await cargando.isVisible()); i++) await p.clock.runFor(5);
    afirmar(await cargando.isVisible(), 'S2: the lazy read is in flight for the first shot');
    const antes = await encabezados(p);
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/l2-s2-cargando.png` });
    await p.clock.runFor(5000);
    await cargando.waitFor({ state: 'detached', timeout: 30000 });
    await cerrarToasts(p);
    const despues = await encabezados(p);
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/l2-cargado.png` });
    log.push(`antes:   ${JSON.stringify(antes)}`, `despues: ${JSON.stringify(despues)}`);
    afirmar(antes.length > 1 && JSON.stringify(antes) === JSON.stringify(despues),
      `L-2: the ${antes.length} thread headings (order, status and span) are identical before and after the studies arrive`);
    await ctx.close();
  }

  // M-7 — 403 on the orders (S5) against a 500 (S9): different tone, no support code, no retry.
  const s9 = {};
  {
    const { ctx, p } = await sesion(b, [{ patron: '/diagnostic-results/me/orders', modo: 'error' }]);
    await p.goto(BASE + RUTA);
    const falta = p.getByTestId('recorrido-fallo');
    await falta.waitFor({ timeout: 120000 });
    s9.tono = await tono(falta.locator('app-alert'));
    await ctx.close();
  }
  {
    const { ctx, p } = await sesion(b, [{ patron: '/diagnostic-results/me/orders', modo: 'forbidden' }]);
    await p.goto(BASE + RUTA);
    const falta = p.getByTestId('recorrido-fallo');
    await falta.waitFor({ timeout: 120000 });
    await cerrarToasts(p);
    const muro = falta.getByTestId('recorrido-sin-acceso');
    afirmar(await muro.isVisible(), 'S5: the wall is the projected warning notice');
    afirmar(await muro.evaluate((e) => e.classList.contains('alert--warning')), 'S5: the notice is in the warning tone');
    afirmar((await falta.locator('.alert--error').count()) === 0, 'S5: nothing in the error tone');
    afirmar((await falta.getByTestId('support-code').count()) === 0, 'S5: no «Código de soporte»');
    afirmar((await falta.getByRole('button', { name: 'Reintentar' }).count()) === 0, 'S5: no retry is offered');
    const s5 = await tono(muro);
    log.push(`tono S5: ${s5}`, `tono S9: ${s9.tono}`);
    afirmar(s5 !== s9.tono, 'S5 and S9 are painted in different colours');
    afirmar((await p.getByTestId('recorrido-hilo').count()) > 0, 'S5: what arrived is still drawn');
    await p.getByTestId('mi-recorrido').screenshot({ path: `${OUT}/m7-s5-403.png` });
    await ctx.close();
  }

  await b.close();
  fs.writeFileSync(`${OUT}/resultado.txt`, log.join('\n') + `\n${fallas === 0 ? 'TODO OK' : `${fallas} FALLAS`}\n`);
  process.exit(fallas === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
