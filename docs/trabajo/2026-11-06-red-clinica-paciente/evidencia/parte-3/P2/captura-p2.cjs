// Part 3, agent P2 — patient portal «Mi recorrido»: flat facts, aligned «en el camino», copy, focus ring.
// Usage: BASE=http://localhost:4382 FASE=antes|despues node captura-p2.cjs <out-dir>   (demo build, development,demo)
// Never `networkidle`: waits are on test ids.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:4382';
const FASE = process.env.FASE ?? 'despues';
const ALTO = { 390: 844, 1024: 768, 1440: 900 };
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
// Before the change the assertions are only recorded: they describe what was wrong.
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : FASE === 'antes' ? 'antes' : 'FALLA'} ${texto}`); if (!cond && FASE !== 'antes') fallas++; };

async function sesion(b, ancho, tema) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: ALTO[ancho] }, deviceScaleFactor: 1, colorScheme: tema, locale: 'es-BO', timezoneId: 'America/La_Paz' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  await p.goto(BASE + '/auth');
  await p.getByTestId('login-identifier').waitFor({ timeout: 180000 });
  await p.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await p.getByTestId('login-password').fill('mock');
  await p.getByTestId('login-submit').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 120000 });
  return { ctx, p, errores };
}

async function sinToasts(p) {
  for (const cerrar of await p.getByTestId('toast-cerrar').all()) await cerrar.click().catch(() => {});
  await p.locator('app-toast').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

async function pasada(b, ancho, tema) {
  const pref = `${FASE}-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p, errores } = await sesion(b, ancho, tema);
  await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
  await p.getByTestId('recorrido-hilos').waitFor({ timeout: 120000 });
  await sinToasts(p);
  const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
  await hilo.locator('.accordion-panel__trigger').first().click();
  const atenciones = hilo.getByTestId('recorrido-atencion');
  await atenciones.first().waitFor();
  for (let i = 0; i < Math.min(await atenciones.count(), 2); i++) await atenciones.nth(i).locator('.accordion-panel__trigger').first().click();
  await hilo.locator('.recorrido__hecho').first().waitFor();

  const m = await hilo.evaluate((h) => {
    const px = (v) => parseFloat(v) || 0;
    const hechos = [...h.querySelectorAll('.recorrido__linea .recorrido__hecho')];
    const caja = hechos.map((e) => getComputedStyle(e)).map((c) => ({
      lados: px(c.borderTopWidth) + px(c.borderLeftWidth) + px(c.borderRightWidth), radio: px(c.borderTopLeftRadius),
    }));
    const lista = h.querySelector('.recorrido__linea .recorrido__hechos');
    const rielX = h.querySelector('.recorrido__punto > app-accordion-panel')?.getBoundingClientRect().left ?? null;
    const camino = h.querySelector('[data-testid="recorrido-descartados-en-el-camino"]');
    const barra = h.querySelector('.recorrido__hilo-barra');
    const guiar = h.querySelector('[data-testid="recorrido-empezar-guiado"]');
    const cuerpo = h.querySelector('.recorrido__hilo-cuerpo');
    return {
      hechos: hechos.length,
      cajasConBordeLateral: caja.filter((c) => c.lados > 0).length,
      radioMax: Math.max(0, ...caja.map((c) => c.radio)),
      gapLista: lista ? getComputedStyle(lista).rowGap : null,
      rielX, caminoX: camino ? camino.getBoundingClientRect().left : null,
      guiarIzq: guiar && cuerpo ? Math.round(guiar.getBoundingClientRect().left - cuerpo.getBoundingClientRect().left) : null,
      barraJustify: barra ? getComputedStyle(barra).justifyContent : null,
      marcas: [...h.querySelectorAll('.recorrido__hecho-marca')].map((e) => e.textContent.trim()),
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  anotar(`${pref}: ${JSON.stringify(m)}`);
  afirmar(m.hechos > 0 && m.cajasConBordeLateral === 0, `${pref}: ${m.hechos} hechos sin caja propia (bordes laterales/superior = 0 en ${m.hechos - m.cajasConBordeLateral})`);
  afirmar(m.radioMax <= 8, `${pref}: radio de los hechos ≤ --r-sm (${m.radioMax}px)`);
  afirmar(m.gapLista === '0px' || m.gapLista === 'normal', `${pref}: los hechos se agrupan sin hueco entre cajas (gap ${m.gapLista})`);
  if (m.caminoX !== null) afirmar(Math.abs(m.caminoX - m.rielX) <= 1, `${pref}: «Lo que se descartó en el camino» arranca en el riel de consultas (x ${m.caminoX.toFixed(1)} vs ${m.rielX.toFixed(1)})`);
  else anotar(`${pref}: sin «en el camino» en este hilo`);
  if (m.guiarIzq !== null) afirmar(m.guiarIzq <= 1, `${pref}: «Ver paso a paso» al inicio de la fila (a ${m.guiarIzq}px del borde izquierdo; justify ${m.barraJustify})`);
  afirmar(!m.marcas.some((t) => /vínculo|asociada/.test(t)), `${pref}: marcas sin jerga ${JSON.stringify(m.marcas)}`);
  afirmar(!m.desborde, `${pref}: sin desplazamiento horizontal`);

  await hilo.scrollIntoViewIfNeeded();
  await atenciones.first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-1-hilo.png` });

  // Keyboard focus on a fact row: the ring has to be drawn (a bare colour in box-shadow is dropped).
  const primero = hilo.locator('.recorrido__linea .recorrido__hecho').first();
  await primero.focus();
  await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('Tab');
  // The ring fades in with the row's `box-shadow` transition (--dur-fast): read it once it settled.
  await p.waitForTimeout(400);
  const foco = await primero.evaluate((e) => ({ activo: document.activeElement === e, visible: e.matches(':focus-visible'), sombra: getComputedStyle(e).boxShadow, outline: getComputedStyle(e).outlineStyle }));
  afirmar(foco.activo && foco.visible && /3px/.test(foco.sombra), `${pref}: foco por teclado visible en el hecho (activo ${foco.activo}, :focus-visible ${foco.visible}, box-shadow «${foco.sombra}», outline ${foco.outline})`);
  if (ancho === 1440) await primero.locator('xpath=ancestor::ul[1]').screenshot({ path: `${OUT}/${pref}-2-foco.png` });
  afirmar(errores.length === 0, `${pref}: sin errores de página ${JSON.stringify(errores.slice(0, 2))}`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  for (const tema of ['light', 'dark']) for (const ancho of [390, 1024, 1440]) {
    await pasada(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA ${FASE} ${ancho} ${tema}: ${e.message.split('\n')[0]}`); });
  }
  await b.close();
  fs.writeFileSync(`${OUT}/aserciones-${FASE}.txt`, log.join('\n') + `\n\nfallas: ${fallas}\n`);
  process.exit(fallas ? 1 : 0);
})();
