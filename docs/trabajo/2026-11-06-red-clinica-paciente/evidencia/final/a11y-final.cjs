// Final captures, item 6: axe-core (WCAG 2.2 AA tags, injected from the repo's node_modules as in
// tanda-visual-3/a11y-tanda-3.cjs) and a keyboard-only pass over the network and the panel.
// Usage: BASE=http://localhost:PORT node a11y-final.cjs <out-dir>   (static demo build). Never `networkidle`.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const { sesion, abrirRed, abrirTsh, sinToasts, AXE, BASE, bitacora, nombreTema, ajenos, foco } = require('./comun.cjs');
const OUT = process.argv[2];
const B = bitacora(`${OUT}/aserciones-a11y.txt`);
const lanzar = () => chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });

async function axe(p, selector, etiqueta) {
  await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(async (sel) => {
    const r = await window.axe.run(document.querySelector(sel), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map((x) => ({ id: x.id, impact: x.impact, nodos: x.nodes.map((n) => `${n.target.join(' ')} — ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`) }));
  }, selector);
  for (const x of v) B.anotar(`  - ${x.id} [${x.impact}] ×${x.nodos.length}\n      ${x.nodos.slice(0, 6).join('\n      ')}`);
  B.afirmar(v.length === 0, `axe ${etiqueta} (${selector}): ${v.length} reglas con violaciones WCAG 2.2 AA`);
}

async function axeMedica(ancho, tema) {
  const b = await lanzar();
  const et = `médica ${ancho} ${nombreTema(tema)}`;
  try {
    const { ctx, p } = await sesion(b, 'medica@alovida.mock', ancho, tema);
    await abrirRed(p);
    await sinToasts(p);
    await axe(p, '[data-testid="red-superficie"]', `${et} red plegada`);
    await p.getByTestId('red-desplegar-todo').click();
    await p.waitForTimeout(500);
    await axe(p, '[data-testid="red-superficie"]', `${et} red expandida`);
    await p.getByTestId('red-plegar-todo').click();
    await abrirTsh(p);
    await p.getByTestId('red-panel-valor').first().waitFor();
    await axe(p, '[data-testid="red-panel"]', `${et} panel del estudio TSH`);
    await ctx.close();
  } catch (e) { B.afirmar(false, `axe ${et}: ${e.message.split('\n')[0]}`); }
  await b.close();
}

async function axePaciente(ancho, tema) {
  const b = await lanzar();
  const et = `paciente ${ancho} ${nombreTema(tema)}`;
  try {
    const { ctx, p } = await sesion(b, 'paciente@alovida.mock', ancho, tema);
    await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
    await p.getByTestId('recorrido-hilos').waitFor({ timeout: 120000 });
    await sinToasts(p);
    const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
    await hilo.locator('.accordion-panel__trigger').first().click();
    await hilo.getByTestId('recorrido-atencion').first().locator('.accordion-panel__trigger').first().click();
    await axe(p, '[data-testid="mi-recorrido"]', `${et} «Mi recorrido»`);
    await ctx.close();
  } catch (e) { B.afirmar(false, `axe ${et}: ${e.message.split('\n')[0]}`); }
  await b.close();
}

/** Keyboard only. After every key the focus is read: it must never fall on <body>. */
async function teclado(ancho, tema) {
  const b = await lanzar();
  const pref = `teclado-${ancho}-${nombreTema(tema)}`;
  try {
    const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, tema);
    await abrirRed(p);
    await sinToasts(p);
    const enBody = [];
    const tecla = async (k, donde) => { await p.keyboard.press(k); await p.waitForTimeout(120); const f = await foco(p); if (f === 'body') enBody.push(`${donde}: ${k}`); return f; };

    // Tab walk through the bar, the edge jump, the canvas and the episode headers.
    await p.getByTestId('red-desplegar-todo').focus();
    const camino = [];
    for (let i = 0; i < 16; i++) camino.push(await tecla('Tab', `recorrido Tab ${i + 1}`));
    B.anotar(`${pref} Tab desde «Expandir todo»:\n  ${camino.join('\n  ')}`);

    // «Expandir todo» / «Contraer todo» by keyboard: each disables itself once used.
    await p.getByTestId('red-desplegar-todo').focus();
    const trasExpandir = await tecla('Enter', '«Expandir todo» con Enter');
    B.afirmar(trasExpandir !== 'body', `${pref}: tras «Expandir todo» con Enter el foco no cae en body (${trasExpandir})`);
    await p.getByTestId('red-plegar-todo').focus();
    const trasContraer = await tecla('Enter', '«Contraer todo» con Enter');
    B.afirmar(trasContraer !== 'body', `${pref}: tras «Contraer todo» con Enter el foco no cae en body (${trasContraer})`);

    // «Lo más antiguo» with Enter: the button goes away at the edge; the focus goes to the canvas.
    const salto = p.getByTestId('red-borde-inicio').getByRole('button');
    if (await salto.count()) {
      await salto.focus();
      const tras = await tecla('Enter', '«Lo más antiguo»');
      await p.getByTestId('red-borde-inicio').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      const ahora = await foco(p);
      B.afirmar(ahora !== 'body' && /region|lienzo|Recorrido clínico/i.test(ahora), `${pref}: «Lo más antiguo» con Enter deja el foco en el lienzo (${tras} → ${ahora})`);
    } else B.noAplica(`${pref}: sin «Lo más antiguo» (vista angosta o ya en el inicio)`);

    // Episode, node, panel.
    const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
    await hipo.focus();
    await tecla('Enter', 'episodio');
    const abierto = await p.locator('[data-testid="red-episodio"][aria-expanded="true"]').filter({ hasText: 'Hipotiroidismo' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
    B.afirmar(abierto, `${pref}: Enter despliega el episodio (aria-expanded=true)`);
    const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
    await tsh.focus();
    const entero = await tsh.evaluate((n) => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
    B.afirmar(entero, `${pref}: el nodo con foco queda entero en la pantalla`);
    await p.screenshot({ path: `${OUT}/${pref}-1-foco-en-nodo.png` });
    await tecla('Enter', 'nodo');
    await p.getByTestId('red-panel').waitFor();
    await p.waitForTimeout(300);
    const enPanel = await foco(p);
    B.afirmar(/panel|TSH/i.test(enPanel) && enPanel !== 'body', `${pref}: Enter sobre el nodo abre el panel con el foco dentro (${enPanel})`);
    // Tab through the panel until the focus leaves it (the panel is not modal at this width), then back with Shift+Tab.
    const dentro = [];
    const enElPanel = () => p.evaluate(() => !!document.activeElement?.closest('[data-testid="red-panel"]'));
    for (let i = 0; i < 14; i++) {
      dentro.push(await tecla('Tab', `panel Tab ${i + 1}`));
      if (!(await enElPanel())) break;
    }
    B.anotar(`${pref} Tab dentro del panel y la salida:\n  ${dentro.join('\n  ')}`);
    await tecla('Shift+Tab', 'vuelta al panel');
    B.afirmar(await enElPanel(), `${pref}: Shift+Tab devuelve el foco al último vínculo del panel (${await foco(p)})`);
    await p.screenshot({ path: `${OUT}/${pref}-2-panel-teclado.png` });
    await tecla('Escape', 'Escape en el panel');
    await p.getByTestId('red-panel').waitFor({ state: 'detached' });
    const vuelta = await foco(p);
    B.afirmar(/recorrido-nodo/.test(vuelta) && /TSH/.test(vuelta), `${pref}: Escape cierra el panel y el foco vuelve al nodo (${vuelta})`);
    B.afirmar(enBody.length === 0, `${pref}: el foco nunca cayó en body en ${camino.length + dentro.length + 5} pulsaciones ${JSON.stringify(enBody)}`);
    const malos = ajenos(errores);
    B.afirmar(malos.length === 0, `${pref}: consola sin errores ${JSON.stringify(malos.slice(0, 3))}`);
    await ctx.close();
  } catch (e) { B.afirmar(false, `${pref}: ${e.message.split('\n')[0]}`); }
  await b.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [a, t] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) await axeMedica(a, t);
  for (const [a, t] of [[1440, 'light'], [1440, 'dark'], [390, 'light']]) await axePaciente(a, t);
  for (const [a, t] of [[1440, 'light'], [1440, 'dark']]) await teclado(a, t);
  B.cerrar();
})();
