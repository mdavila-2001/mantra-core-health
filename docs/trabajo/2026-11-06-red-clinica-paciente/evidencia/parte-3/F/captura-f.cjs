// Part 3, agent F: edge jumps vs axis marks (H-1), axis under the app header (H-2),
// year on the first visible column (M-5), demo badges (L-4), collapsed band height (M-9),
// full-network shot and real horizontal overflow (M-8).
// Usage: BASE=http://localhost:PORT node captura-f.cjs <out-dir>   (static demo build). Never `networkidle`.
const { sesion, abrirRed, sinToasts } = require('../../tanda-visual-3/captura-tanda-3.cjs');
const { capturaCompleta } = require('../../parte-2/D/captura-d.cjs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

/** Everything measured in one pass, in viewport pixels. */
const medir = (p) => p.evaluate(() => {
  const caja = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const cruza = (a, b) => a.r > b.l + 0.5 && a.l < b.r - 0.5 && a.b > b.t + 0.5 && a.t < b.b - 0.5;
  const texto = (e) => { const g = document.createRange(); g.selectNodeContents(e); return caja(g); };
  const lienzo = document.querySelector('.red__lienzo');
  const vista = caja(lienzo);
  const dentro = (r) => r.r > vista.l + 1 && r.l < vista.r - 1;
  const header = document.querySelector('header[app-header]');
  const tope = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const marcas = [...document.querySelectorAll('.red__marca-eje')].map(caja).filter(dentro);
  const etiquetas = [...document.querySelectorAll('.red__columna p')].map((e) => ({ t: e.textContent.trim(), c: texto(e) })).filter((x) => dentro(x.c));
  const saltos = [...document.querySelectorAll('.red__borde-salto')].map((b) => ({ t: b.textContent.trim(), c: caja(b) }));
  const choques = saltos.flatMap((s) => [
    ...marcas.filter((m) => cruza(s.c, m)).map((m) => `${s.t} × punto@${Math.round(m.l)}`),
    ...etiquetas.filter((e) => cruza(s.c, e.c)).map((e) => `${s.t} × «${e.t}»`),
  ]);
  // The first column whose centre is in view, and every «mismo día» whose reference day is out of view.
  const cols = [...document.querySelectorAll('.red__columna')].map((li) => ({ c: caja(li), ps: [...li.querySelectorAll('p')].map((e) => e.textContent.trim()) }));
  const visible = (c) => (c.l + c.r) / 2 >= vista.l;
  const primera = cols.find((x) => visible(x.c));
  const huerfanos = cols.filter((x, i) => visible(x.c) && /mismo día/i.test(x.ps.join(' ')) && (i === 0 || !visible(cols[i - 1].c))).map((x) => x.ps.join(' / '));
  const eje = document.querySelector('.red__eje');
  const fechas = [...document.querySelectorAll('.red__columna .red__fecha')].map(texto).filter(dentro);
  const badges = [...document.querySelectorAll('app-mock-banner *')].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0).map(caja);
  const chips = [...document.querySelectorAll('[data-testid="red-fuera"]')].map((b) => ({ t: b.textContent.trim(), c: caja(b) }));
  const plegados = [...document.querySelectorAll('[data-testid="red-hilo"]:not(.red__hilo--desplegado)')].map((h) => Math.round(h.getBoundingClientRect().height));
  return {
    tope: Math.round(tope),
    scrollLeft: Math.round(lienzo.scrollLeft),
    choques,
    saltos: saltos.map((s) => `${s.t}@${Math.round(s.c.t)}-${Math.round(s.c.b)}`),
    primera: primera ? primera.ps.join(' / ') : null,
    huerfanos,
    ejeTop: Math.round(eje.getBoundingClientRect().top),
    fechasTop: fechas.length ? Math.round(Math.min(...fechas.map((f) => f.t))) : null,
    lienzoTop: Math.round(vista.t), lienzoBottom: Math.round(vista.b),
    pegado: lienzo.parentElement.hasAttribute('data-eje-pegado'),
    tapaChip: chips.flatMap((c) => badges.filter((b) => cruza(c.c, b)).map(() => c.t)),
    plegados,
    desborde: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
  };
});

const sinChoques = (m, pref, momento) => afirmar(m.choques.length === 0, `${pref} ${momento}: ningún salto pisa un punto del eje ni una fecha (${m.saltos.join(', ')}) ${JSON.stringify(m.choques)}`);
const conAnio = (m, pref, momento) => afirmar(/\b20\d\d\b/.test(m.primera ?? '') && m.huerfanos.length === 0, `${pref} ${momento} (scrollLeft ${m.scrollLeft}): la primera columna visible dice el año «${m.primera}», «mismo día» sin su día a la vista: ${JSON.stringify(m.huerfanos)}`);

async function medica(b, ancho) {
  const pref = `medica-${ancho}-claro`;
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, 'light');
  await abrirRed(p);
  await sinToasts(p);
  // At rest: the canvas whole below the app header, with some air.
  await p.locator('.red__lienzo').evaluate((l) => { l.scrollIntoView({ block: 'start' }); const h = document.querySelector('header[app-header]'); window.scrollBy(0, -((h ? h.getBoundingClientRect().bottom : 0) + 40)); });
  await p.waitForTimeout(150);
  // At rest, scrolled to the end: the canvas top is under the header's bottom plus the scroll margin, the axis is not stuck.
  let m = await medir(p);
  anotar(`${pref} reposo: ${JSON.stringify(m)}`);
  afirmar(!m.pegado && m.lienzoTop > m.tope, `${pref}: en reposo el eje está en su lugar (lienzo ${m.lienzoTop} bajo la barra ${m.tope}, sin pegar)`);
  sinChoques(m, pref, 'abierto al final');
  conAnio(m, pref, 'abierto al final');
  afirmar(m.desborde[0] <= m.desborde[1], `${pref}: el documento no desborda a lo ancho (scrollWidth ${m.desborde[0]} ≤ clientWidth ${m.desborde[1]})`);
  anotar(`${pref}: alto de cada franja plegada ${JSON.stringify(m.plegados)} (M-9, geometría de G)`);
  anotar(`${pref}: chips «N antes/después» tapados por las insignias de demostración: ${JSON.stringify(m.tapaChip)} (L-4)`);
  await p.screenshot({ path: `${OUT}/${pref}-01-reposo.png` });

  // Every scroll position along the canvas, in steps: no jump on a mark, the first column always has its year.
  const total = await p.locator('.red__lienzo').evaluate((l) => l.scrollWidth - l.clientWidth);
  let peores = [];
  for (let x = 0; x <= total; x += Math.max(60, Math.round(total / 24))) {
    await p.locator('.red__lienzo').evaluate((l, v) => { l.scrollLeft = v; }, x);
    await p.waitForTimeout(60);
    const k = await medir(p);
    if (k.choques.length || k.huerfanos.length || !/\b20\d\d\b/.test(k.primera ?? '')) peores.push({ x: k.scrollLeft, choques: k.choques, primera: k.primera, huerfanos: k.huerfanos });
  }
  afirmar(peores.length === 0, `${pref}: recorriendo el lienzo de 0 a ${total} px, ninguna posición con un salto sobre un punto ni una primera columna sin año ${JSON.stringify(peores.slice(0, 3))}`);

  // «Lo más antiguo»: the review's capture 02.
  await p.locator('.red__lienzo').evaluate((l) => { l.scrollLeft = l.scrollWidth; });
  // With the keyboard (MED-1): the button that had the focus goes away at the edge; the focus lands on the canvas, not on <body>.
  await p.getByTestId('red-borde-inicio').getByRole('button').focus();
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelector('.red__lienzo').scrollLeft <= 1, null, { timeout: 5000 });
  await p.getByTestId('red-borde-inicio').waitFor({ state: 'detached', timeout: 5000 });
  const foco = await p.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : `${a.tagName}.${a.className}`; });
  afirmar(foco !== 'body' && foco.includes('red__lienzo'), `${pref}: «Lo más antiguo» con Enter deja el foco en el lienzo (${foco})`);
  const orden = await p.evaluate(() => [...document.querySelectorAll('[data-testid="red-borde-final"] button, .red__lienzo, [data-testid="red-episodio"]')].map((e) => e.classList.contains('red__lienzo') ? 'lienzo' : e.dataset.testid ?? 'salto').slice(0, 3));
  afirmar(orden[0] === 'salto' && orden[1] === 'lienzo', `${pref}: orden de tabulación salto → lienzo → episodios ${JSON.stringify(orden)}`);
  m = await medir(p);
  sinChoques(m, pref, 'tras «Lo más antiguo»');
  conAnio(m, pref, 'tras «Lo más antiguo»');
  await p.screenshot({ path: `${OUT}/${pref}-02-lo-mas-antiguo.png` });

  // H-2: everything expanded (a canvas several screens tall) and the page scrolled 400 px past the
  // canvas top; the axis stays right under the header. Collapsed, at 1920×1080 the page is too short to get there.
  await p.getByTestId('red-desplegar-todo').click();
  await p.locator('.red__hilo--desplegado').first().waitFor();
  await p.locator('.red__lienzo').evaluate((l) => { l.scrollLeft = l.scrollWidth / 2; });
  await p.waitForTimeout(150);
  await p.locator('.red__lienzo').evaluate((l) => { const h = document.querySelector('header[app-header]'); window.scrollBy(0, l.getBoundingClientRect().top - (h ? h.getBoundingClientRect().bottom : 0) + 400); });
  await p.waitForTimeout(150);
  m = await medir(p);
  anotar(`${pref} página desplazada: ${JSON.stringify({ tope: m.tope, lienzoTop: m.lienzoTop, ejeTop: m.ejeTop, fechasTop: m.fechasTop, pegado: m.pegado, saltos: m.saltos })}`);
  afirmar(m.lienzoTop < m.tope && m.pegado, `${pref}: el lienzo sube detrás de la barra (lienzo ${m.lienzoTop} < barra ${m.tope}) y el eje queda pegado`);
  afirmar(m.fechasTop !== null && m.fechasTop >= m.tope && m.fechasTop <= m.tope + 40, `${pref}: las fechas del eje quedan debajo de la barra, no detrás (fechas ${m.fechasTop} ≥ barra ${m.tope})`);
  afirmar(m.saltos.every((s) => +s.split('@')[1].split('-')[0] >= m.tope - 1), `${pref}: los saltos siguen al eje y no quedan bajo la barra ${JSON.stringify(m.saltos)}`);
  sinChoques(m, pref, 'con el eje pegado');
  await p.screenshot({ path: `${OUT}/${pref}-03-eje-pegado.png` });

  // The canvas' bottom: the axis stops inside it and never runs over the next block.
  await p.locator('.red__lienzo').evaluate((l) => window.scrollBy(0, l.getBoundingClientRect().bottom - 120));
  await p.waitForTimeout(150);
  m = await medir(p);
  afirmar(m.ejeTop >= m.lienzoTop && m.ejeTop + 76 <= m.lienzoBottom + 1, `${pref}: al final del lienzo el eje se detiene dentro de él (eje ${m.ejeTop}, lienzo ${m.lienzoTop}–${m.lienzoBottom})`);

  if (ancho === 1440) {
    // The review's capture 03: the whole network, collapsed.
    await p.getByTestId('red-plegar-todo').click();
    await p.locator('.red__hilo--desplegado').first().waitFor({ state: 'detached' });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.red__lienzo').evaluate((l) => { l.scrollLeft = l.scrollWidth; });
    const cap = await capturaCompleta(p, 'red-superficie', `${OUT}/${pref}-04-red-completa.png`);
    anotar(`${pref} captura completa: ${JSON.stringify(cap)}`);
    afirmar(cap.desborde[0] <= cap.desborde[1] && cap.dentro, `${pref}: la red completa entra en la página sin desborde horizontal y el recorte la contiene entera ${JSON.stringify(cap)}`);
  }
  afirmar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const ancho of [768, 1024, 1440, 1920]) {
    if (process.env.SOLO && process.env.SOLO !== String(ancho)) continue;
    // One browser per width: a renderer crash (shared, memory-starved machine) does not take the rest down.
    const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
    try { await medica(b, ancho); } catch (e) { afirmar(false, `${ancho}: ${e.message.split('\n')[0]}`); }
    await b.close();
  }
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLAS'}`);
  fs.writeFileSync(`${OUT}/aserciones-f${process.env.SOLO ? '-' + process.env.SOLO : ''}.txt`, log.join('\n') + '\n');
})();
