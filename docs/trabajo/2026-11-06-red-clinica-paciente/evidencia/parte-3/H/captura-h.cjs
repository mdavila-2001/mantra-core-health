// Part 3, agent H (H-3): the ruled-out diamond is struck through, on the legend,
// the collapsed strip and the node's mark; light and dark, 3:1 (WCAG 1.4.11).
// Usage: BASE=http://localhost:<port> node captura-h.cjs <out-dir>   (static demo build). Never `networkidle`.
const { sesion, abrirRed, sinToasts } = require('../../tanda-visual-3/captura-tanda-3.cjs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

/**
 * The «::after» of an element as drawn: its box, its color, and the contrast
 * of that color against what lies behind it (the nearest opaque background up
 * the tree, which is what surrounds the 2px the bar pokes out).
 */
const tachado = (loc) => loc.evaluate((el) => {
  const rgb = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const fondo = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] === 1) return c.slice(0, 3); } return [255, 255, 255]; };
  const a = getComputedStyle(el, '::after');
  const color = rgb(a.backgroundColor).slice(0, 3);
  return {
    borde: getComputedStyle(el).borderTopStyle,
    content: a.content, ancho: a.width, alto: a.height, rotacion: a.rotate, color: a.backgroundColor,
    contraFondoPadre: +ratio(color, fondo(el.parentElement)).toFixed(2),
    contraRelleno: +ratio(color, fondo(el)).toFixed(2),
  };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const tema of ['light', 'dark']) {
    const t = tema === 'light' ? 'claro' : 'oscuro';
    // 1024 is the widest viewport the shared session opens at 2x: the crops come out enlarged.
    const s = await sesion(b, 'medica@alovida.mock', 1024, tema);
    const pg = s.p;
    await abrirRed(pg);
    await sinToasts(pg);
    const leyenda = pg.getByTestId('red-leyenda');
    await leyenda.waitFor();
    const muestra = (nombre) => leyenda.locator('li').filter({ hasText: nombre }).locator('.red__muestra-hito');
    const des = await tachado(muestra('Descartado'));
    anotar(`${t} leyenda descartado ::after ${JSON.stringify(des)}`);
    afirmar(des.content !== 'none' && des.ancho === '2px', `${t} leyenda: el rombo descartado lleva el trazo (2px)`);
    afirmar(des.borde === 'solid', `${t} leyenda: el borde del rombo descartado es continuo (${des.borde}), el trazo es la señal`);
    afirmar(des.contraFondoPadre >= 3, `${t} leyenda: trazo contra el fondo ${des.contraFondoPadre}:1 ≥ 3:1`);
    for (const otro of ['Confirmado', 'Presuntivo']) {
      const o = await tachado(muestra(otro));
      afirmar(o.content === 'none', `${t} leyenda: «${otro}» sin trazo (content ${o.content})`);
    }
    await leyenda.screenshot({ path: `${OUT}/leyenda-${t}.png`, scale: 'device' });

    // The demo history has no column whose top milestone is a ruled-out one, so
    // the strip's look is checked by giving one real milestone that class
    // (marked «forzado» in the file name): same sheet, same place on the track.
    let hito = pg.locator('[data-testid="red-hito"][data-tipo="descartado"]').first();
    let forzado = '';
    if (!(await hito.count())) {
      const otro = pg.locator('[data-testid="red-hito"][data-tipo="presuntivo"], [data-testid="red-hito"][data-tipo="confirmado"]').first();
      await otro.evaluate((e) => { e.className = 'red__hito red__hito--descartado'; e.dataset.tipo = 'descartado'; e.dataset.forzado = 'si'; });
      hito = pg.locator('[data-forzado="si"]');
      forzado = '-forzado';
      anotar(`${t} franja: sin hito descartado en la demo; se fuerza la clase sobre un hito real`);
    }
    if (await hito.count()) {
      await hito.scrollIntoViewIfNeeded();
      const h = await tachado(hito);
      anotar(`${t} franja hito descartado ::after ${JSON.stringify(h)}`);
      afirmar(h.content !== 'none' && h.contraFondoPadre >= 3, `${t} franja: hito descartado tachado, ${h.contraFondoPadre}:1 contra la franja`);
      const r = await hito.boundingBox();
      await pg.screenshot({ path: `${OUT}/franja-hito-descartado${forzado}-${t}.png`, clip: { x: r.x - 60, y: r.y - 30, width: r.width + 120, height: r.height + 60 } });
    } else anotar(`${t} franja: no hay hito descartado a la vista`);

    // A ruled-out diagnosis node: expand the episodes until one shows.
    let nodo = pg.locator('[data-testid="recorrido-nodo"].red__nodo--descartado').first();
    for (const ep of await pg.getByTestId('red-episodio').all()) {
      if (await nodo.count()) break;
      if ((await ep.getAttribute('aria-expanded')) !== 'true') { await ep.click(); await pg.waitForTimeout(300); }
    }
    if (await nodo.count()) {
      await nodo.scrollIntoViewIfNeeded();
      const marca = nodo.locator('.red__marca');
      const n = await tachado(marca);
      anotar(`${t} nodo descartado marca ::after ${JSON.stringify(n)}`);
      afirmar(n.content !== 'none' && n.rotacion === '45deg' && n.contraRelleno >= 3, `${t} nodo: marca tachada, ${n.contraRelleno}:1 contra su fondo`);
      const sano = pg.locator('[data-testid="recorrido-nodo"][data-clase="diagnostico"]:not(.red__nodo--descartado) .red__marca').first();
      if (await sano.count()) afirmar((await tachado(sano)).content === 'none', `${t} nodo: un diagnóstico no descartado no va tachado`);
      await nodo.screenshot({ path: `${OUT}/nodo-descartado-${t}.png`, scale: 'device' });
    } else afirmar(false, `${t} nodo: no apareció un nodo descartado`);
    afirmar(s.errores.length === 0, `${t} sin errores de consola: ${JSON.stringify(s.errores.slice(0, 3))}`);
    await s.ctx.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/captura-h.log`, log.join('\n') + '\n');
  console.log(fallas ? `FALLAS: ${fallas}` : 'todo ok');
  process.exit(fallas ? 1 : 0);
})();
