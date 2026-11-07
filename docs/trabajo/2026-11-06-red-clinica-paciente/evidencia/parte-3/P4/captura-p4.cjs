// Part 3, agent P4 — node type color, node elevation, legend and node motion.
// Usage: BASE=http://localhost:<port> FASE=antes|despues node captura-p4.cjs <out-dir>   (static demo build). Never `networkidle`.
const { sesion, abrirRed, sinToasts } = require('../../tanda-visual-3/captura-tanda-3.cjs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const FASE = process.env.FASE ?? 'despues';
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

/** Resolves a custom property to the color the browser draws, on a probe inside the canvas. */
const resolver = (p, prop) => p.evaluate((v) => {
  const s = document.createElement('span');
  s.style.color = `var(${v})`;
  document.querySelector('.red__lienzo, [data-testid="expediente-recorrido"]').appendChild(s);
  const c = getComputedStyle(s).color;
  s.remove();
  return c;
}, prop);

async function ronda(b, ancho, tema) {
  const pref = `${FASE}-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  await sinToasts(p);
  await p.getByTestId('expediente-recorrido').scrollIntoViewIfNeeded();
  await p.getByTestId('red-leyenda').screenshot({ path: `${OUT}/${pref}-leyenda.png` });

  // Legend: one sample per milestone kind the strip really draws.
  const tiposDibujados = await p.$$eval('[data-testid="red-hito"]', (hs) => [...new Set(hs.map((h) => h.dataset.tipo))].sort());
  const muestras = await p.$$eval('[data-testid="red-leyenda"] .red__muestra-hito', (ms) => ms.map((m) => [...m.classList].find((c) => c.startsWith('red__hito--')).slice(11)).sort());
  const cubre = (t) => muestras.includes(t) || (t === 'procedimiento' && muestras.includes('derivacion'));
  anotar(`     ${pref}: hitos dibujados ${tiposDibujados.join(',')} · muestras ${muestras.join(',')}`);
  afirmar(tiposDibujados.every(cubre), `${pref}: cada tipo de hito dibujado tiene su muestra en la leyenda`);
  const momento = await p.$eval('[data-testid="red-leyenda"] .red__hito--momento', (m) => getComputedStyle(m).borderTopLeftRadius).catch(() => 'sin muestra');
  const enLienzo = await p.$eval('.red__hito.red__hito--momento', (m) => getComputedStyle(m).borderTopLeftRadius).catch(() => 'sin hito');
  afirmar(momento === enLienzo, `${pref}: la muestra «Atención o cita» tiene el radio del hito del lienzo (${momento} vs ${enLienzo})`);

  // Open the Hypothyroidism episode and read a diagnosis node at rest.
  const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
  if ((await hipo.getAttribute('aria-expanded')) !== 'true') await hipo.click();
  const dx = p.locator('[data-testid="recorrido-nodo"][data-clase="diagnostico"][data-forma="tarjeta"]').first();
  await dx.waitFor();
  await p.mouse.move(0, 0);
  const primarioBg = await resolver(p, '--st-primary-bg');
  const errorBg = await resolver(p, '--st-error-bg');
  const reposo = await dx.evaluate((n) => {
    const m = n.querySelector('.red__marca');
    return { sombra: getComputedStyle(n).boxShadow, marcaBg: getComputedStyle(m).backgroundColor, marcaFg: getComputedStyle(m).color, franja: getComputedStyle(n).borderLeftColor, translate: getComputedStyle(n).translate };
  });
  anotar(`     ${pref}: nodo diagnóstico en reposo ${JSON.stringify(reposo)}`);
  afirmar(reposo.marcaBg === primarioBg && reposo.marcaBg !== errorBg, `${pref}: el ícono del diagnóstico usa la receta de marca (${reposo.marcaBg}), no el rojo de error (${errorBg})`);
  const sombras = await p.$$eval('[data-testid="recorrido-nodo"]', (ns) => ns.filter((n) => getComputedStyle(n).boxShadow !== 'none').length);
  afirmar(sombras === 0, `${pref}: ningún nodo en reposo lleva sombra (${sombras} con sombra)`);
  await dx.scrollIntoViewIfNeeded();
  await dx.hover();
  await p.waitForTimeout(400);
  const hover = await dx.evaluate((n) => ({ sombra: getComputedStyle(n).boxShadow, translate: getComputedStyle(n).translate }));
  afirmar(hover.sombra !== 'none' && hover.translate === 'none', `${pref}: en hover el nodo gana sombra y no se mueve (${hover.translate})`);
  await p.mouse.move(0, 0);
  await dx.click();
  await p.getByTestId('red-panel').waitFor({ timeout: 15000 });
  await p.mouse.move(0, 0);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${pref}-nodo-abierto.png` });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  try {
    for (const ancho of [1024, 1440]) for (const tema of ['light', 'dark']) await ronda(b, ancho, tema);
  } finally {
    await b.close();
  }
  anotar(`${fallas} fallas`);
  fs.writeFileSync(`${OUT}/aserciones-p4-${FASE}.txt`, log.join('\n') + '\n');
})();
