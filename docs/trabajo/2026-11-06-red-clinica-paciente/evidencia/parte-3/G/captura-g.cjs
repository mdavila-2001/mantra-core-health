// Part 3, agent G (H-4): empty expanded threads and lines cut at the canvas edge.
// Usage: BASE=http://localhost:4352 node captura-g.cjs <out-dir>   (static demo build). Never `networkidle`: waits are on test ids.
const { sesion, abrirRed, sinToasts } = require('../../tanda-visual-3/captura-tanda-3.cjs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };
const PLEGADA = 48 + 32; // altoCabeceraHilo + altoPista
const CABECERA = 48; // only the «N después» chip: the header's row alone (M-9)

/**
 * Per expanded thread: its height and whether any of its nodes intersects the
 * canvas viewport. Per drawn line: each end, whether it is inside the canvas
 * viewport, on the edge of a node, or carries the «sigue» marker.
 */
const medir = (p) => p.evaluate(() => {
  const lienzo = document.querySelector('.red__lienzo').getBoundingClientRect();
  const hilos = [...document.querySelectorAll('[data-testid="red-hilo"].red__hilo--desplegado')].map((li) => {
    const r = li.getBoundingClientRect();
    const nodos = [...li.querySelectorAll('[data-testid="recorrido-nodo"]')].map((b) => b.getBoundingClientRect());
    const visibles = nodos.filter((n) => n.right > lienzo.left && n.left < lienzo.right).length;
    return { episodio: li.dataset.episodio, nombre: li.querySelector('.red__cabecera-hilo')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), alto: Math.round(r.height), nodos: nodos.length, visibles };
  });
  const cajas = [...document.querySelectorAll('[data-testid="recorrido-nodo"]')].map((b) => b.getBoundingClientRect());
  const svg = document.querySelector('.red__trazos');
  const ctm = svg.getScreenCTM();
  const aPantalla = (pt) => { const q = svg.createSVGPoint(); q.x = pt.x; q.y = pt.y; return q.matrixTransform(ctm); };
  const enNodo = (q) => cajas.some((c) => Math.abs(q.x - c.left) <= 2 || Math.abs(q.x - c.right) <= 2 ? q.y >= c.top - 1 && q.y <= c.bottom + 1 : false);
  const extremos = [];
  for (const el of svg.querySelectorAll('path.red__arista')) {
    const largo = el.getTotalLength();
    if (largo === 0) continue;
    for (const [lado, en, marca] of [['inicio', 0, 'marker-start'], ['fin', largo, 'marker-end']]) {
      const q = aPantalla(el.getPointAtLength(en));
      const dentro = q.x >= lienzo.left - 0.5 && q.x <= lienzo.right + 0.5;
      const indicador = el.getAttribute(marca) === 'url(#red-sigue)';
      // LOW-6: where a line meets a card, a click 3 px inside lands on the card, not on the line.
      const caja = cajas.find((c) => (Math.abs(q.x - c.left) <= 2 || Math.abs(q.x - c.right) <= 2) && q.y >= c.top && q.y <= c.bottom && c.left >= lienzo.left && c.right <= lienzo.right);
      const clic = caja ? document.elementFromPoint(Math.abs(q.x - caja.left) <= 2 ? caja.left + 3 : caja.right - 3, q.y)?.closest('[data-testid="recorrido-nodo"]') !== null : null;
      extremos.push({ motivo: el.dataset.motivo, lado, x: Math.round(q.x), dentro, indicador, nodo: enNodo(q), clic });
    }
  }
  return { hilos, extremos, lienzo: { left: lienzo.left, right: lienzo.right } };
});

async function revisar(p, pref, donde) {
  await p.waitForTimeout(500);
  const m = await medir(p);
  const vacias = m.hilos.filter((h) => h.visibles === 0);
  anotar(`${pref} [${donde}] franjas desplegadas ${m.hilos.length}; sin registros a la vista ${vacias.length}: ${JSON.stringify(vacias.map((h) => [h.nombre, h.alto]))}`);
  for (const h of vacias) afirmar(h.alto === PLEGADA || h.alto === CABECERA, `${pref} [${donde}] «${h.nombre}» sin registros a la vista mide ${h.alto} px (plegada: ${PLEGADA}; solo «N después»: ${CABECERA})`);
  const fuera = m.extremos.filter((e) => !e.dentro);
  afirmar(fuera.length === 0, `${pref} [${donde}] extremos de línea fuera del lienzo visible: ${fuera.length} de ${m.extremos.length}`);
  const sueltos = m.extremos.filter((e) => e.dentro && !e.nodo && !e.indicador);
  afirmar(sueltos.length === 0, `${pref} [${donde}] extremos que no tocan un nodo ni llevan indicador: ${sueltos.length} ${JSON.stringify(sueltos.slice(0, 5))}`);
  const tapados = m.extremos.filter((e) => e.clic === false);
  afirmar(tapados.length === 0, `${pref} [${donde}] clics junto a la llegada de una línea que caen en la línea y no en la tarjeta: ${tapados.length} de ${m.extremos.filter((e) => e.clic !== null).length}`);
  anotar(`${pref} [${donde}] extremos con indicador «sigue»: ${m.extremos.filter((e) => e.indicador).length}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  for (const ancho of [1440, 1920]) {
    const pref = `medica-${ancho}-claro`;
    const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, 'light');
    await abrirRed(p);
    await sinToasts(p);
    await p.getByTestId('red-desplegar-todo').click();
    await p.locator('[data-testid="red-episodio"][aria-expanded="false"]').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await revisar(p, pref, 'final');
    await p.getByTestId('expediente-recorrido').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/${pref}-expandido-final.png`, fullPage: true });
    // The other end and the middle: the threads that were full shrink and the other way round.
    const lienzo = p.locator('.red__lienzo');
    await lienzo.evaluate((l) => l.scrollTo({ left: 0 }));
    await revisar(p, pref, 'inicio');
    await p.screenshot({ path: `${OUT}/${pref}-expandido-inicio.png`, fullPage: true });
    await lienzo.evaluate((l) => l.scrollTo({ left: (l.scrollWidth - l.clientWidth) / 2 }));
    await revisar(p, pref, 'medio');
    await p.screenshot({ path: `${OUT}/${pref}-expandido-medio.png`, fullPage: true });
    afirmar(errores.length === 0, `${pref} sin errores de consola: ${JSON.stringify(errores.slice(0, 3))}`);
    await ctx.close();
  }
  await b.close();
  anotar(`fallas: ${fallas}`);
  fs.writeFileSync(`${OUT}/aserciones-g.txt`, log.join('\n') + '\n');
  process.exit(fallas === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
