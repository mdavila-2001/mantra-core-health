// Part 3, agent I — minimal browser checks of the panel and the step notice (M-1, M-2, M-3, M-4, M-6, L-1, L-3).
// Usage: BASE=http://localhost:4372 node captura-i.cjs <out-dir>   (demo build, configuration development,demo)
// Never `networkidle`: waits are on test ids.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const t3 = require('../../tanda-visual-3/captura-tanda-3.cjs');

const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };
const limpio = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Each text line box of an element: whether a line holds only the given word (an orphan). */
const huerfana = (loc, palabra) => loc.evaluate((e, w) => {
  const r = document.createRange(); r.selectNodeContents(e);
  const filas = new Map();
  const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (let i = 0; i < n.textContent.length; i++) {
      if (/\s/.test(n.textContent[i])) continue;
      r.setStart(n, i); r.setEnd(n, i + 1);
      const y = Math.round(r.getBoundingClientRect().top);
      filas.set(y, (filas.get(y) ?? '') + n.textContent[i]);
    }
  }
  return [...filas.values()].some((f) => f === w);
}, palabra);

async function panel(b, ancho, tema) {
  const pref = `${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
  const { ctx, p } = await t3.sesion(b, 'medica@alovida.mock', ancho, tema);
  await t3.abrirRed(p);
  await t3.sinToasts(p);
  const fallar = (l) => p.evaluate((x) => sessionStorage.setItem('mock:fallos', JSON.stringify(x)), l);
  const cerrar = async () => { await p.getByTestId('red-panel-cerrar').click(); await p.getByTestId('red-panel').waitFor({ state: 'detached' }); };

  // L-1: the thread selector's label.
  const rotulo = limpio(await p.getByTestId('red-filtro-hilo').locator('xpath=ancestor::app-form-field//label').first().textContent());
  afirmar(rotulo === 'Hilo', `${pref} L-1: rótulo del selector «${rotulo}»`);

  // M-2: S4 from the simulator's 422.
  const tsh = await t3.abrirTsh(p);
  await p.getByTestId('red-panel-valor').first().waitFor();
  // L-3: the download button reads whole (its text box fits the button, no ellipsis).
  const archivo = p.getByTestId('red-panel-archivo').first();
  const corte = await archivo.evaluate((btn) => {
    const s = btn.querySelector('.panel__archivo-nombre'); const r = document.createRange(); r.selectNodeContents(s);
    const t = r.getBoundingClientRect(), c = btn.getBoundingClientRect(), cs = getComputedStyle(s);
    return { cabe: t.right <= c.right + 0.5 && t.bottom <= c.bottom + 0.5, elipsis: cs.textOverflow, panelDesborda: btn.closest('[data-testid="red-panel"]').scrollWidth > btn.closest('[data-testid="red-panel"]').clientWidth };
  });
  afirmar(corte.cabe && corte.elipsis !== 'ellipsis' && !corte.panelDesborda, `${pref} L-3: el botón de descarga entra entero ${JSON.stringify(corte)}`);
  await archivo.scrollIntoViewIfNeeded();
  await archivo.screenshot({ path: `${OUT}/${pref}-l3-descarga.png` });
  await cerrar();

  await fallar([{ patron: '/reports/', modo: 'validation', metodos: ['GET'] }]);
  await tsh.click();
  const error = p.getByTestId('red-panel-informe-error');
  await error.waitFor({ timeout: 15000 });
  const dice = limpio(await error.textContent());
  afirmar(dice.includes('El servidor rechazó la lectura de este informe') && !dice.includes('Elija un medicamento'), `${pref} M-2: «${dice}»`);
  afirmar((await error.getByRole('button', { name: 'Reintentar' }).count()) === 0 && (await p.getByTestId('red-panel-volver').count()) === 1, `${pref} M-2: sin «Reintentar», con «Volver a la red»`);
  await p.getByTestId('red-panel').screenshot({ path: `${OUT}/${pref}-m2-s4.png` });
  await fallar([]);
  await p.getByTestId('red-panel-volver').click();
  await p.getByTestId('red-panel').waitFor({ state: 'detached' });

  // M-1, M-3, M-6: a study without a released result.
  await p.getByTestId('red-desplegar-todo').click();
  const estudios = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]');
  let hallado = false;
  for (let i = 0; i < (await estudios.count()) && !hallado; i++) {
    await estudios.nth(i).scrollIntoViewIfNeeded();
    await estudios.nth(i).click();
    await p.getByTestId('red-panel').waitFor();
    await p.getByTestId('red-panel-informe-cargando').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    if (await p.getByTestId('red-panel-sin-resultado').count()) hallado = true; else await cerrar();
  }
  afirmar(hallado, `${pref} S3: hay un estudio sin resultado en la demo`);
  if (hallado) {
    const s3 = p.getByTestId('red-panel-sin-resultado');
    const texto = await s3.textContent();
    afirmar(/hace \d+ (días|día|meses)/.test(texto) && !/\(\d+/.test(texto), `${pref} M-6: «${limpio(texto)}» (cifra y unidad con NBSP, sin paréntesis)`);
    afirmar(!(await huerfana(s3, 'días')) && !(await huerfana(s3, 'meses')), `${pref} M-1: ninguna línea queda con «días» o «meses» sola`);
    const accion = p.locator('.panel__sin-resultado [data-testid="red-panel-sin-resultado-accion"]');
    const etiqueta = limpio(await accion.textContent().catch(() => ''));
    afirmar((await accion.count()) === 1, `${pref} M-1: S3 ofrece «${etiqueta}» bajo el aviso`);
    const badge = p.locator('[data-testid="red-panel"] .panel__hechos app-badge').first();
    const clase = await badge.getAttribute('class');
    afirmar(/warning/.test(clase) && !/info|success/.test(clase), `${pref} M-3: el estado «${limpio(await badge.textContent())}» lleva tono de aviso (${clase})`);
    await p.getByTestId('red-panel').screenshot({ path: `${OUT}/${pref}-m1-s3.png` });
    const antes = limpio(await p.locator('[data-testid="red-panel"] h2').textContent());
    await accion.click();
    await p.locator('[data-testid="red-panel"] h2').filter({ hasNotText: antes }).waitFor({ timeout: 10000 }).catch(() => {});
    const despues = limpio(await p.locator('[data-testid="red-panel"] h2').textContent());
    afirmar(despues !== antes, `${pref} M-1: la acción abre otro nodo (${antes.slice(0, 40)} → ${despues.slice(0, 40)})`);
  }
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  for (const [ancho, tema] of [[1440, 'light'], [390, 'light']]) {
    await panel(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA ${ancho} ${tema}: ${e.message.split('\n').slice(0, 4).join(' | ')}`); });
  }
  await b.close();
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/aserciones-i.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
