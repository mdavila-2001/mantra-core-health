// Franja 5a — evidencia de «Mi recorrido» en el portal del paciente.
// Uso: node f5-captura.cjs <carpeta-salida>
const { chromium } = require('/home/user/mantra-core-health/.claude/worktrees/agent-a5626ec4136151b13/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'http://localhost:4340';
const log = [];
const anotar = (s) => { log.push(s); console.log(s); };

async function sesion(b, ancho, alto, tema) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, colorScheme: tema });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  p.on('requestfailed', (r) => errores.push('requestfailed: ' + r.url()));
  await p.goto(BASE + '/auth');
  await p.getByTestId('login-identifier').waitFor({ timeout: 90000 });
  await p.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await p.getByTestId('login-password').fill('mock');
  await p.getByTestId('login-submit').click();
  try {
    await p.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), { timeout: 120000 });
  } catch (e) {
    await p.screenshot({ path: '/tmp/claude-0/-home-user/1f4653a6-7008-52b3-a09e-603ed43b2d0c/scratchpad/f5-debug-login.png' });
    console.log('LOGIN FALLÓ', p.url(), JSON.stringify(errores.slice(0, 10)));
    throw e;
  }
  await p.waitForTimeout(1500);
  if (p.url().includes('organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForTimeout(2000); }
  if (p.url().includes('portal-selector')) { await p.getByRole('link').first().click(); await p.waitForTimeout(2000); }
  // Tema: la app lee su propio selector; forzamos el atributo también.
  return { ctx, p, errores };
}

async function forzarTema(p, tema) {
  await p.evaluate((t) => {
    try { localStorage.setItem('mantra-core-health.theme', t); } catch {}
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-tema', t === 'dark' ? 'oscuro' : 'claro');
  }, tema);
}

async function medir(p, nombre) {
  const m = await p.evaluate(() => {
    const inner = document.querySelector('.app-main__inner');
    const card = document.querySelector('.historia__tarjeta');
    const r = (e) => e?.getBoundingClientRect();
    const a = r(inner), c = r(card);
    return {
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      holguraIzq: a && c ? Math.round(c.left - a.left) : null,
      holguraDer: a && c ? Math.round(a.right - c.right) : null,
      ancho: a && c ? Math.round((c.width / a.width) * 100) : null,
    };
  });
  anotar(`${nombre}: overflow=${m.scrollW > m.clientW} (scroll ${m.scrollW} / client ${m.clientW}), holgura izq ${m.holguraIzq} der ${m.holguraDer}, ancho ${m.ancho}%`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  for (const [ancho, alto] of [[1440, 900], [390, 844]]) {
    for (const tema of ['light', 'dark']) {
      const pref = `${process.env.HILO ? 'hilo-' + process.env.HILO.toLowerCase() + '-' : ''}${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
      if (process.env.HILO && !((ancho === 1440 && tema === 'light') || (ancho === 390 && tema === 'dark'))) continue;
      const { ctx, p, errores } = await sesion(b, ancho, alto, tema);
      await forzarTema(p, tema);
      await p.goto(BASE + '/my-account/medical-record');
      await p.getByTestId('historia-vista').waitFor({ timeout: 90000 }).catch(async (e) => {
        await p.screenshot({ path: '/tmp/claude-0/-home-user/1f4653a6-7008-52b3-a09e-603ed43b2d0c/scratchpad/f5-debug-' + pref + '.png' });
        anotar('debug url ' + p.url() + ' errores ' + JSON.stringify(errores.slice(0, 10)) + ' html ' + (await p.content()).length);
        throw e;
      });
      await forzarTema(p, tema);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${OUT}/${pref}-0-por-fecha.png` });

      await p.getByTestId('segmentado-recorrido').click();
      await p.getByTestId('mi-recorrido').waitFor();
      await p.getByTestId('recorrido-hilos').waitFor({ timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1500);
      anotar(`${pref}: URL ${new URL(p.url()).pathname}${new URL(p.url()).search}`);
      const hilos = await p.getByTestId('recorrido-hilo').count();
      const titulos = await p.locator('[data-testid="recorrido-hilo"] > h3 .accordion-panel__label, [data-testid="recorrido-hilo"] .accordion-panel__heading .accordion-panel__label').allTextContents();
      anotar(`${pref}: hilos=${hilos} → ${JSON.stringify([...new Set(titulos)].slice(0, 12))}`);
      await medir(p, pref + ' plegado');
      await p.screenshot({ path: `${OUT}/${pref}-1-plegado.png` });

      // Desplegar el primer hilo y su primera atención.
      const primero = process.env.HILO ? p.getByTestId('recorrido-hilo').filter({ hasText: process.env.HILO }).first() : p.getByTestId('recorrido-hilo').first();
      const disparador = primero.locator('.accordion-panel__trigger').first();
      anotar(`${pref}: aria-expanded antes=${await disparador.getAttribute('aria-expanded')}`);
      await disparador.focus();
      await p.keyboard.press('Enter');
      await p.waitForTimeout(400);
      anotar(`${pref}: aria-expanded después (Enter)=${await disparador.getAttribute('aria-expanded')}`);
      const atencion = primero.getByTestId('recorrido-atencion').first().locator('.accordion-panel__trigger');
      if (await atencion.count()) { await atencion.click(); await p.waitForTimeout(400); }
      await medir(p, pref + ' desplegado');
      await p.screenshot({ path: `${OUT}/${pref}-2-desplegado.png` });

      // Paso a paso.
      const guiado = primero.getByTestId('recorrido-empezar-guiado');
      if (await guiado.count()) {
        await guiado.click();
        await p.waitForTimeout(300);
        const textos = [(await p.getByTestId('recorrido-narracion').textContent())?.trim()];
        for (let i = 0; i < Number(process.env.PASOS ?? 2); i++) {
          if ((await p.getByTestId('recorrido-siguiente').getAttribute('aria-disabled')) === 'true') break;
          await p.getByTestId('recorrido-siguiente').click(); await p.waitForTimeout(250);
          textos.push((await p.getByTestId('recorrido-narracion').textContent())?.trim());
        }
        if (process.env.HILO) anotar(`${pref}: narración recorrida:\n  - ${textos.join('\n  - ')}`);
        const narr = await p.getByTestId('recorrido-narracion').textContent();
        const viva = await p.getByTestId('recorrido-narracion-viva').textContent();
        anotar(`${pref}: narración="${narr?.trim()}" | región viva="${viva?.trim()}" aria-live=${await p.getByTestId('recorrido-narracion-viva').getAttribute('aria-live')}`);
        await p.getByTestId('recorrido-guiado').scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${OUT}/${pref}-3-paso-a-paso.png` });
        await p.getByTestId('recorrido-ver-registro').click();
        await p.getByTestId('recorrido-detalle').waitFor({ timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(500);
        await p.screenshot({ path: `${OUT}/${pref}-4-hoja-detalle.png` });
        await p.keyboard.press('Escape');
        await p.waitForTimeout(300);
      }
      const enElCamino = primero.getByTestId('recorrido-descartados-en-el-camino');
      if (await enElCamino.count()) {
        await enElCamino.locator('.accordion-panel__trigger').first().click();
        await p.waitForTimeout(300);
        await enElCamino.scrollIntoViewIfNeeded();
        anotar(`${pref}: en el camino=${(await enElCamino.textContent())?.replace(/\s+/g, ' ').trim()}`);
        await p.screenshot({ path: `${OUT}/${pref}-5-descartado-en-el-camino.png` });
      }
      const pasos = await primero.getByTestId('recorrido-narracion').count();
      // Descartados.
      const desc = p.getByTestId('recorrido-descartados');
      if (await desc.count()) {
        await desc.locator('.accordion-panel__trigger').first().click();
        await p.waitForTimeout(300);
        await desc.scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${OUT}/${pref}-5-descartados.png` });
      }
      anotar(`${pref}: errores=${JSON.stringify(errores.slice(0, 8))}`);
      await ctx.close();
    }
  }
  // Reduce-motion: una toma rápida con la preferencia puesta.
  {
    const { ctx, p } = await sesion(b, 1440, 900, 'light');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
    await p.getByTestId('recorrido-hilo').first().waitFor({ timeout: 60000 });
    await p.getByTestId('recorrido-hilo').first().locator('.accordion-panel__trigger').first().click();
    await p.waitForTimeout(300);
    const t = await p.evaluate(() => {
      const h = document.querySelector('.recorrido__hecho');
      const r = document.querySelector('.accordion-panel__region');
      return { hecho: h ? getComputedStyle(h).transitionDuration : null, region: r ? getComputedStyle(r).animationDuration : null };
    });
    anotar(`reduce-motion: transition-duration hecho=${t.hecho} · animation-duration región=${t.region}`);
    // Entrada directa por URL con ?vista=recorrido (ejercita la ruta sin navegación interna).
    anotar(`entrada directa ?vista=recorrido: hilos=${await p.getByTestId('recorrido-hilo').count()}`);
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/mediciones${process.env.HILO ? '-' + process.env.HILO.toLowerCase() : ''}.txt`, log.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error(e); fs.writeFileSync(`/tmp/claude-0/-home-user/1f4653a6-7008-52b3-a09e-603ed43b2d0c/scratchpad/f5-error-${Date.now()}.txt`, log.join('\n') + '\nERROR ' + e.message + '\n'); process.exit(1); });
