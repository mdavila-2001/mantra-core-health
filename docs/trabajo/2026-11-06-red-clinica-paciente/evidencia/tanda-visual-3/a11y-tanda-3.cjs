// Visual batch 3 — axe-core and keyboard pass over the clinical network.
// Usage: node a11y-tanda-3.cjs <out-dir>   (ng serve on :4300). axe-core comes from the repo's node_modules
// (@axe-core/playwright is not installed): it is injected with addScriptTag and run with the WCAG 2.2 AA tags.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const { sesion, abrirRed, abrirTsh, sinToasts, AXE, BASE } = require('./captura-tanda-3.cjs');
const OUT = process.argv[2];
const log = [];
const anotar = (s) => { log.push(s); console.log(s); };
let fallas = 0;
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

async function axe(p, selector, etiqueta) {
  await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(async (sel) => {
    const r = await window.axe.run(document.querySelector(sel), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map((x) => ({ id: x.id, impact: x.impact, nodos: x.nodes.map((n) => `${n.target.join(' ')} — ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`) }));
  }, selector);
  anotar(`axe ${etiqueta} (${selector}): ${v.length} reglas con violaciones`);
  for (const x of v) anotar(`  - ${x.id} [${x.impact}] ×${x.nodos.length}\n      ${x.nodos.slice(0, 8).join('\n      ')}`);
  afirmar(v.length === 0, `axe ${etiqueta}: sin violaciones WCAG 2.2 AA`);
}

async function medica(b, ancho, tema) {
  const etiqueta = `médica ${ancho} ${tema}`;
  const { ctx, p } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  await sinToasts(p);
  await axe(p, '[data-testid="red-superficie"]', `${etiqueta} red plegada`);
  // Alerts first: below 780 px the panel is a modal sheet over them.
  await p.getByTestId('red-alertas-plegar').click();
  await abrirTsh(p);
  await p.getByTestId('red-panel-valor').first().waitFor();
  await axe(p, '[data-testid="red-superficie"]', `${etiqueta} hipotiroidismo desplegado + alertas`);
  await axe(p, '[data-testid="red-panel"]', `${etiqueta} panel del estudio TSH`);
  await ctx.close();
}

async function paciente(b, ancho, tema) {
  const { ctx, p } = await sesion(b, 'paciente@alovida.mock', ancho, tema);
  await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
  await p.getByTestId('recorrido-hilos').waitFor({ timeout: 120000 });
  await sinToasts(p);
  const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
  await hilo.locator('.accordion-panel__trigger').first().click();
  await hilo.getByTestId('recorrido-atencion').first().locator('.accordion-panel__trigger').first().click();
  await axe(p, '[data-testid="mi-recorrido"]', `paciente ${ancho} ${tema}`);
  await ctx.close();
}

/** Keyboard only: Tab to the canvas, open an episode, a node, the panel; Escape returns the focus. */
async function teclado(b) {
  const { ctx, p } = await sesion(b, 'medica@alovida.mock', 1440, 'light');
  await abrirRed(p);
  await sinToasts(p);
  const foco = () => p.evaluate(() => {
    const e = document.activeElement;
    return `${e.tagName.toLowerCase()}${e.dataset.testid ? `[${e.dataset.testid}]` : ''} «${(e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70)}»`;
  });
  await p.getByTestId('red-desplegar-todo').focus();
  const recorrido = [];
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); recorrido.push(await foco()); }
  anotar(`Tab desde «Expandir todo»:\n  ${recorrido.join('\n  ')}`);
  const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
  await hipo.focus();
  await p.keyboard.press('Enter');
  const desplegado = await p.locator('[data-testid="red-episodio"][aria-expanded="true"]').filter({ hasText: 'Hipotiroidismo' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  afirmar(desplegado, 'Enter despliega el episodio (aria-expanded=true)');
  await p.screenshot({ path: `${OUT}/teclado-1440-claro-1-episodio.png` });
  const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await tsh.focus();
  const visible = await tsh.evaluate((n) => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
  afirmar(visible, 'el nodo con foco queda entero en la pantalla');
  await p.screenshot({ path: `${OUT}/teclado-1440-claro-2-foco-en-nodo.png` });
  await p.keyboard.press('Enter');
  await p.getByTestId('red-panel').waitFor();
  anotar(`Enter sobre el nodo → foco en ${await foco()}`);
  await p.screenshot({ path: `${OUT}/teclado-1440-claro-3-panel.png` });
  await p.keyboard.press('Escape');
  await p.getByTestId('red-panel').waitFor({ state: 'detached' });
  const vuelta = await foco();
  anotar(`Escape → foco en ${vuelta}`);
  afirmar(/recorrido-nodo/.test(vuelta) && /TSH/.test(vuelta), 'Escape cierra el panel y el foco vuelve al nodo');
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  for (const [ancho, tema] of [[1440, 'light'], [1440, 'dark'], [390, 'dark']]) {
    await medica(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA axe médica ${ancho} ${tema}: ${e.message.split('\n')[0]}`); });
  }
  for (const tema of ['light', 'dark']) await paciente(b, 1440, tema).catch((e) => { fallas++; anotar(`FALLA axe paciente ${tema}: ${e.message.split('\n')[0]}`); });
  await teclado(b).catch((e) => { fallas++; anotar(`FALLA teclado: ${e.message.split('\n')[0]}`); });
  await b.close();
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/a11y-axe-y-teclado.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
