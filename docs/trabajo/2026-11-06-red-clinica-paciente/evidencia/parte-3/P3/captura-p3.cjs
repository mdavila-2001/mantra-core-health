// Part 3, agent P3 — minimal browser checks of the panel, the surface and the focus ring.
// Usage: BASE=http://localhost:4381 FASE=antes|despues node captura-p3.cjs <out-dir>   (demo build, development,demo)
// Never `networkidle`: waits are on test ids.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const t3 = require('../../tanda-visual-3/captura-tanda-3.cjs');

const OUT = process.argv[2];
const FASE = process.env.FASE ?? 'despues';
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

async function ronda(b, ancho, tema) {
  const pref = `${FASE}-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p } = await t3.sesion(b, 'medica@alovida.mock', ancho, tema);
  await t3.abrirRed(p);
  await t3.sinToasts(p);

  // Surface: which outline frames the controls, and how far the controls sit from it.
  // The pointer is left where the toast's close button was, often over the card, and
  // the shell lifts a hovered card: move it off, and measure once the transitions settle.
  await p.mouse.move(1, 1);
  await p.waitForTimeout(400);
  await p.evaluate(() => Promise.all(document.querySelector('[data-testid="red-superficie"]').getAnimations().map((a) => a.finished)));
  const borde = await p.evaluate(() => {
    const sup = document.querySelector('[data-testid="red-superficie"]');
    const visible = (e) => { const cs = getComputedStyle(e); return parseFloat(cs.borderLeftWidth) > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.borderLeftColor); };
    let marco = null;
    for (let e = sup; e && e !== document.body; e = e.parentElement) if (visible(e) || getComputedStyle(e).boxShadow !== 'none') { marco = e; break; }
    const m = marco.getBoundingClientRect();
    const ids = ['red-filtro-hilo', 'red-guiado-alternar', 'red-desplegar-todo'];
    const holgura = Math.min(...ids.map((id) => document.querySelector(`[data-testid="${id}"]`)).filter(Boolean).map((e) => e.getBoundingClientRect().left - m.left));
    return { marco: marco === sup ? 'app-card.superficie' : marco.className.toString().split(' ')[0], holgura: Math.round(holgura * 10) / 10 };
  });
  anotar(`     ${pref} superficie: contorno de «${borde.marco}», controles a ${borde.holgura} px de él`);
  if (ancho === 390) afirmar(borde.holgura >= 16, `${pref} #16: los controles quedan a ≥ 16 px del contorno visible (${borde.holgura} px, de ${borde.marco})`);
  const sup = await p.getByTestId('red-superficie').boundingBox();
  await p.screenshot({ path: `${OUT}/${pref}-superficie.png`, clip: { x: 0, y: Math.max(0, sup.y - 40), width: ancho, height: Math.min(560, sup.height + 40) } });

  // Panel: result before order, a consistent values table.
  await t3.abrirTsh(p);
  await p.getByTestId('red-panel-valor').first().waitFor();
  const panel = p.getByTestId('red-panel');
  const tabla = await panel.evaluate((root) => {
    const titulos = [...root.querySelectorAll('.panel__seccion-titulo')].map((h) => h.textContent.trim());
    const filas = [...root.querySelectorAll('[data-testid="red-panel-valor"]')].map((tr) => {
      const valor = tr.cells[1].querySelector('.panel__valor').getBoundingClientRect();
      const chip = tr.cells[1].querySelector('.panel__lectura');
      const c = chip?.getBoundingClientRect();
      const ref = tr.cells[2];
      const lh = parseFloat(getComputedStyle(ref).lineHeight);
      const rr = document.createRange(); rr.selectNodeContents(ref);
      const lineas = new Set([...rr.getClientRects()].map((x) => Math.round(x.top))).size;
      return { chip: c ? { debajo: c.top >= valor.bottom - 0.5, izq: Math.round(c.left - valor.left) } : null, lineas, lh, num: getComputedStyle(tr.cells[2]).fontVariantNumeric };
    });
    return { titulos, filas };
  });
  afirmar(tabla.titulos.indexOf('Resultado') > -1 && tabla.titulos.indexOf('Resultado') < tabla.titulos.indexOf('Pedido'), `${pref} #9: «Resultado» antes que «Pedido» (${tabla.titulos.join(' › ')})`);
  const chips = tabla.filas.filter((f) => f.chip);
  afirmar(chips.length > 0 && chips.every((f) => f.chip.debajo && f.chip.izq === 0), `${pref} #10: cada chip Alto/Bajo bajo su valor, alineado a su izquierda ${JSON.stringify(chips.map((f) => f.chip))}`);
  afirmar(tabla.filas.every((f) => f.lineas === 1), `${pref} #10: ninguna referencia se parte (líneas: ${tabla.filas.map((f) => f.lineas).join(', ')})`);
  afirmar(tabla.filas.every((f) => /tabular-nums/.test(f.num)), `${pref} #10: cifras tabulares en la tabla (${tabla.filas[0]?.num})`);
  await panel.screenshot({ path: `${OUT}/${pref}-panel.png` });

  // Focus ring, by keyboard (a scripted focus after a click is not :focus-visible):
  // Enter on the node opens the panel with the focus on its title; Tab reaches the panel's links.
  await p.getByTestId('red-panel-cerrar').click();
  await panel.waitFor({ state: 'detached' });
  const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await tsh.focus();
  await p.keyboard.press('Enter');
  await panel.waitFor();
  await p.waitForFunction(() => document.activeElement?.classList.contains('panel__titulo'), null, { timeout: 5000 }).catch(() => {});
  const anillo = await p.evaluate(() => { const a = document.activeElement; return { cls: a.className, sombra: getComputedStyle(a).boxShadow, visible: a.matches(':focus-visible') }; });
  afirmar(/panel__titulo/.test(anillo.cls) && anillo.visible && /\b3px\b/.test(anillo.sombra), `${pref} #11: el título enfocado por teclado pinta el anillo de 3 px (${anillo.sombra})`);
  await panel.locator('.panel__cabecera').screenshot({ path: `${OUT}/${pref}-foco-titulo.png` }).catch(() => {});
  // Tab on to the first link of the panel body that carries the ring (in-text link or link card).
  let enlace = null;
  for (let i = 0; i < 12 && !enlace; i++) {
    await p.keyboard.press('Tab');
    enlace = await p.evaluate(() => { const a = document.activeElement; return a.matches('.panel__enlace, button.panel__vinculo') ? { cls: a.className.split(' ')[0], sombra: getComputedStyle(a).boxShadow } : null; });
  }
  afirmar(enlace !== null && /\b3px\b/.test(enlace.sombra), `${pref} #11: un vínculo del panel enfocado por Tab pinta el anillo (${JSON.stringify(enlace)})`);
  if (enlace) await p.locator(':focus').screenshot({ path: `${OUT}/${pref}-foco-vinculo.png` }).catch(() => {});
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  for (const ancho of [390, 1440]) for (const tema of ['light', 'dark']) {
    await ronda(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA ${ancho} ${tema}: ${e.message.split('\n').slice(0, 3).join(' | ')}`); });
  }
  await b.close();
  anotar(`\n${FASE}: ${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/aserciones-p3-${FASE}.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
