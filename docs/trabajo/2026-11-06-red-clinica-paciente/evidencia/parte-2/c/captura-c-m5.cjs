// Part 2, agent C — M5: the step notice offers «Quitar filtros».
// Usage: BASE=http://localhost:4371 node captura-c-m5.cjs <out-dir>   (demo build, configuration development,demo)
// Never `networkidle`: waits are on test ids. The step flow is the one of visual batch 3.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const t3 = require('../../tanda-visual-3/captura-tanda-3.cjs');

const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };
const nombreTema = (t) => (t === 'light' ? 'claro' : 'oscuro');

async function m5(b, ancho, tema) {
  const pref = `${ancho}-${nombreTema(tema)}`;
  const { ctx, p } = await t3.sesion(b, 'medica@alovida.mock', ancho, tema);
  await t3.abrirRed(p);
  await t3.sinToasts(p);
  // A 2026 thread filter while the tour narrates the whole history from 2025.
  await p.getByTestId('red-filtro-hilo').click();
  await p.getByRole('option', { name: /^Trastorno de ansiedad/ }).first().click();
  const hiloAntes = (await p.getByTestId('red-filtro-hilo').textContent()).replace(/\s+/g, ' ').trim();
  await p.getByTestId('red-guiado-alternar').click();
  await p.getByTestId('red-guiado-episodio').click();
  await p.getByRole('option', { name: /^Toda la historia/ }).first().click();
  await p.getByTestId('guiado-episodio').waitFor({ state: 'detached' });
  const contador = p.getByTestId('guiado-contador');
  await contador.filter({ hasText: /de 3\d/ }).waitFor();
  for (let i = 0; i < 40 && !/Paso 1 de/.test((await contador.textContent()) ?? ''); i++) await p.getByTestId('guiado-anterior').click({ force: true });
  const nota = p.getByTestId('red-guiado-sin-nodos');
  for (let i = 0; i < 8; i++) {
    if (await nota.waitFor({ timeout: 1500 }).then(() => true, () => false)) break;
    await p.getByTestId('guiado-siguiente').click();
  }
  const quitar = p.getByTestId('red-guiado-quitar-filtros');
  afirmar(await quitar.isVisible(), `${pref}: el aviso de paso ofrece «${((await quitar.textContent().catch(() => '')) ?? '').trim()}» (filtro: ${hiloAntes})`);
  await nota.scrollIntoViewIfNeeded();
  await p.getByTestId('red-guiado').screenshot({ path: `${OUT}/${pref}-m5-aviso-de-paso.png` });
  const paso = (await contador.textContent()).trim();

  await quitar.click();
  await nota.waitFor({ state: 'detached', timeout: 10000 });
  const hiloDespues = (await p.getByTestId('red-filtro-hilo').textContent()).replace(/\s+/g, ' ').trim();
  afirmar(hiloDespues !== hiloAntes, `${pref}: «Quitar filtros» limpia el filtro (${hiloAntes} → ${hiloDespues})`);
  afirmar((await contador.textContent()).trim() === paso, `${pref}: el recorrido sigue en el mismo paso (${paso})`);
  const foco = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);
  afirmar(foco !== 'BODY', `${pref}: el foco no se pierde al desaparecer el botón (${foco})`);
  const nodos = await p.locator('[data-testid="recorrido-nodo"]').count();
  afirmar(nodos > 0, `${pref}: lo que cuenta el paso queda a la vista (${nodos} nodos)`);
  await p.getByTestId('red-guiado').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${pref}-m5-tras-quitar-filtros.png` });

  // Leaving the guided mode does not bring back the filters removed on purpose.
  await p.getByTestId('red-guiado-alternar').click();
  await p.getByTestId('red-guiado').waitFor({ state: 'detached' });
  const hiloAlSalir = (await p.getByTestId('red-filtro-hilo').textContent()).replace(/\s+/g, ' ').trim();
  afirmar(hiloAlSalir === hiloDespues, `${pref}: al salir del paso a paso el filtro sigue quitado (${hiloAlSalir})`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  // SOLO=1440-dark reruns one combination.
  for (const [ancho, tema] of [[1440, 'light'], [1440, 'dark'], [390, 'light']].filter(([a, t]) => !process.env.SOLO || process.env.SOLO === `${a}-${t}`)) {
    await m5(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA ${ancho} ${tema}: ${e.message.split('\n').slice(0, 4).join(' | ')}`); });
  }
  await b.close();
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/aserciones-c-m5${process.env.SOLO ? '-' + process.env.SOLO : ''}.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
