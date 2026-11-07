// Final captures, item 1: the doctor's «Recorrido» at 390/768/1024/1440/1920, light and dark,
// at rest, with «Expandir todo», with the panel open on a study and with the axis stuck after scrolling.
// Usage: BASE=http://localhost:PORT node captura-medica.cjs <out-dir>   (static demo build). SOLO=1440-dark reruns one.
// Never `networkidle`: waits are on test ids. One browser per combination (shared, memory-starved machine).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const { sesion, abrirRed, abrirTsh, sinToasts, bitacora, nombreTema, ajenos, medirRed, afirmarRed } = require('./comun.cjs');
const OUT = process.argv[2];
const B = bitacora(`${OUT}/aserciones-medica${process.env.SOLO ? '-' + process.env.SOLO : ''}.txt`);

const alLienzo = (p, aire) => p.locator('.red').evaluate((l, a) => {
  l.scrollIntoView({ block: 'start' });
  const h = document.querySelector('header[app-header]');
  window.scrollBy(0, -((h ? h.getBoundingClientRect().bottom : 0) + a));
}, aire);

async function combinacion(b, ancho, tema) {
  const pref = `medica-${ancho}-${nombreTema(tema)}`;
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  await sinToasts(p);
  await p.mouse.move(1, 1);

  // 1 · At rest.
  await alLienzo(p, 24);
  await p.waitForTimeout(250);
  let m = await medirRed(p);
  B.anotar(`${pref} reposo: plegadas ${JSON.stringify(m.plegados ?? [])}`);
  afirmarRed(B, m, `${pref} reposo`);
  await p.screenshot({ path: `${OUT}/${pref}-1-reposo.png` });

  // 2 · «Expandir todo»: empty strips and line ends at the recent end and at the oldest end.
  await p.getByTestId('red-desplegar-todo').click();
  await p.locator('[data-testid="red-episodio"][aria-expanded="false"]').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  await p.mouse.move(1, 1);
  await alLienzo(p, 24);
  await p.waitForTimeout(500);
  m = await medirRed(p);
  afirmarRed(B, m, `${pref} expandido (final)`, ['franjas']);
  await p.screenshot({ path: `${OUT}/${pref}-2-expandido.png`, fullPage: ancho !== 390 });
  if (!m.vertical) {
    await p.locator('.red__lienzo').evaluate((l) => l.scrollTo({ left: 0 }));
    await p.waitForTimeout(500);
    afirmarRed(B, await medirRed(p), `${pref} expandido (inicio)`, ['franjas']);
    await p.locator('.red__lienzo').evaluate((l) => l.scrollTo({ left: (l.scrollWidth - l.clientWidth) / 2 }));
    await p.waitForTimeout(500);
    afirmarRed(B, await medirRed(p), `${pref} expandido (medio)`, ['franjas']);
  }

  // 3 · The axis stuck: page scrolled 400 px past the canvas top, still expanded.
  if (!m.vertical) {
    await p.locator('.red__lienzo').evaluate((l) => { const h = document.querySelector('header[app-header]'); window.scrollBy(0, l.getBoundingClientRect().top - (h ? h.getBoundingClientRect().bottom : 0) + 400); });
    await p.waitForTimeout(250);
    m = await medirRed(p);
    B.anotar(`${pref} eje pegado: ${JSON.stringify({ tope: m.tope, lienzoTop: m.lienzoTop, fechasTop: m.fechasTop, pegado: m.pegado })}`);
    B.afirmar(m.pegado && m.lienzoTop < m.tope, `${pref} eje pegado: el lienzo sube detrás de la barra (${m.lienzoTop} < ${m.tope}) y el eje se pega`);
    B.afirmar(m.fechasTop !== null && m.fechasTop >= m.tope && m.fechasTop <= m.tope + 40, `${pref} eje pegado: las fechas quedan justo bajo la barra (fechas ${m.fechasTop}, barra ${m.tope})`);
    afirmarRed(B, m, `${pref} eje pegado`);
  } else {
    await p.evaluate(() => window.scrollBy(0, 600));
    await p.waitForTimeout(250);
    B.noAplica(`${pref} eje pegado: la vista angosta no tiene eje (lista vertical); se captura la página desplazada`);
    afirmarRed(B, await medirRed(p), `${pref} desplazada`);
  }
  await p.screenshot({ path: `${OUT}/${pref}-3-eje-pegado.png` });

  // 4 · The panel open on the TSH study (collapsed network, the panel's normal entry point).
  await p.getByTestId('red-plegar-todo').click();
  await p.evaluate(() => window.scrollTo(0, 0));
  await abrirTsh(p);
  await p.getByTestId('red-panel-valor').first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(400);
  m = await medirRed(p);
  const panel = await p.evaluate(() => {
    const pan = document.querySelector('[data-testid="red-panel"]').getBoundingClientRect();
    const sale = [...document.querySelectorAll('[data-testid="red-panel"] *')].filter((e) => e.getBoundingClientRect().right > pan.right + 1 && !e.closest('.panel__tabla-caja')).length;
    return { sale, dentroDeLaVentana: pan.left >= -0.5 && pan.right <= innerWidth + 0.5 };
  });
  B.afirmar(panel.sale === 0 && panel.dentroDeLaVentana, `${pref} panel: nada del panel se sale por la derecha y el panel entra en la ventana ${JSON.stringify(panel)}`);
  if (ancho >= 650) afirmarRed(B, m, `${pref} panel abierto`);
  else B.afirmar(m.desborde[0] <= m.desborde[1], `${pref} panel abierto (hoja modal): sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/${pref}-4-panel.png` });

  const malos = ajenos(errores);
  B.afirmar(malos.length === 0, `${pref}: consola sin errores ${JSON.stringify(malos.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const tema of ['light', 'dark']) for (const ancho of [390, 768, 1024, 1440, 1920]) {
    if (process.env.SOLO && process.env.SOLO !== `${ancho}-${tema}`) continue;
    const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
    try { await combinacion(b, ancho, tema); } catch (e) { B.afirmar(false, `${ancho} ${tema}: ${e.message.split('\n')[0]}`); }
    await b.close();
  }
  B.cerrar();
})();
